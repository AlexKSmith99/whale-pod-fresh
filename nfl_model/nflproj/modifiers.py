"""Projection modifiers.

Each function returns a multiplier centered on 1.0 for one player, of the form

        M = 1 + weight * signal

where `signal` is a normalized real-world quantity (roughly in [-1, 1]) and
`weight` comes from config/weights.yaml. A value > 1 boosts the projection,
< 1 suppresses it. Every modifier is independent and individually inspectable,
which is the whole point: you can see *why* a player moved.
"""
from __future__ import annotations

import pandas as pd


def _clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _oc_score(coord: pd.DataFrame, name: str, league_avg: float) -> tuple[float, float]:
    """Return (score, pass_lean) for a coordinator, defaulting to league average."""
    row = coord[coord["oc_name"] == name]
    if row.empty:
        return league_avg, 0.0
    return float(row.iloc[0]["oc_score"]), float(row.iloc[0]["pass_lean"])


# --- 1. Coordinator / scheme change -----------------------------------------
def coordinator_modifier(player, team_ctx, coord, cfg) -> float:
    w = cfg["weights"]["oc"]
    c = cfg["coordinator"]
    tc = team_ctx[team_ctx["team"] == player["team"]]
    if tc.empty:
        return 1.0
    tc = tc.iloc[0]
    new_name, prev_name = tc["oc_name"], tc["prev_oc_name"]

    # No change -> continuity, no transition risk.
    if new_name == prev_name:
        return 1.0

    avg = c["league_avg_score"]
    new_score, new_lean = _oc_score(coord, new_name, avg)
    prev_score, prev_lean = _oc_score(coord, prev_name, avg)

    # Quality delta (scores span ~65-96; /50 keeps a big swing near full scale).
    sig_quality = (new_score - prev_score) / 50.0
    # Scheme pass-lean shift, weighted by how much this position cares.
    lean_sens = c["pass_lean_sensitivity"].get(player["pos"], 0.0)
    sig_lean = (new_lean - prev_lean) * lean_sens

    signal = _clamp(sig_quality + sig_lean)
    return 1.0 + w * signal - c["transition_penalty"]


# --- 2. Roster turnover (vacated / added opportunity) ------------------------
_SHARE_LEVERAGE = 3.0  # a 1pt share swing moves fantasy output by ~3x its size


def roster_modifier(player, roster_changes, cfg) -> float:
    w = cfg["weights"]["roster"]
    rc = roster_changes[roster_changes["team"] == player["team"]]
    rc = rc[rc["player_name"] != player["player"]]  # don't count the player's own move
    if rc.empty:
        return 1.0

    pos = player["pos"]
    # Targets are a shared WR/TE pool; carries are the RB pool.
    if pos in ("WR", "TE"):
        share_col = "target_share"
    elif pos == "RB":
        share_col = "rush_share"
    else:  # QB opportunity is largely role-locked
        return 1.0

    vacated = rc[rc["direction"] == "out"][share_col].sum()
    added = rc[rc["direction"] == "in"][share_col].sum()

    # Returning players see a uniform *proportional* change in opportunity equal
    # to (vacated - added); scale by leverage to reach fantasy-point space.
    signal = _clamp((vacated - added) * _SHARE_LEVERAGE)
    return 1.0 + w * signal


# --- 3. QB-profile fit -------------------------------------------------------
def _qb_row(qb_profiles, name):
    row = qb_profiles[qb_profiles["qb_name"] == name]
    base = qb_profiles[qb_profiles["qb_name"] == "League_Average"].iloc[0]
    return (row.iloc[0] if not row.empty else base), base


def qb_modifier(player, qb_profiles, cfg) -> float:
    """How the attached QB's playing style helps or hurts THIS position.

    A high-volume, checkdown-heavy pocket passer (Tua) lifts pass-catching RBs
    and WR target volume. A run-first, low-dumpoff, goal-line-rushing QB
    (Malik Willis / A. Richardson) drains pass volume and vultures RB TDs.
    """
    pos = player["pos"]
    if pos == "QB" or pos not in cfg["qb_environment"]:
        return 1.0

    w = cfg["weights"]["qb"]
    sens = cfg["qb_environment"][pos]
    qb, base = _qb_row(qb_profiles, player["qb_name"])

    def rel(field):  # relative deviation from the league-average QB
        b = float(base[field])
        return (float(qb[field]) - b) / b if b else 0.0

    pass_volume = rel("pass_att_pg")
    downfield = rel("adot")
    dumpoff = rel("dumpoff_rate")
    scramble = rel("rush_att_pg")        # more QB rushing -> fewer team pass plays
    vulture = rel("rush_td")             # QB rush TDs steal RB goal-line scores

    parts = []
    if "pass_volume" in sens:
        parts.append(sens["pass_volume"] * pass_volume)
    if "downfield" in sens:
        parts.append(sens["downfield"] * downfield)
    if "dumpoff" in sens:
        # Only pass-catching backs benefit from checkdowns; scale by target share.
        scale = player["target_share"] / 0.10 if pos == "RB" else 1.0
        parts.append(sens["dumpoff"] * dumpoff * scale)
    if "scramble_drain" in sens:
        parts.append(sens["scramble_drain"] * scramble)
    if "goalline_vulture" in sens:
        # Only goal-line backs lose scores to a rushing QB; scale by RZ share.
        scale = player["rz_share"] / 0.20 if pos == "RB" else 1.0
        parts.append(sens["goalline_vulture"] * vulture * scale)

    signal = _clamp(sum(parts))
    return 1.0 + w * signal


# --- 4. Strength of schedule -------------------------------------------------
_SOS_NORM = 0.06  # typical max season SoS deviation -> maps to full signal scale


def schedule_modifier(player, team_ctx, cfg) -> float:
    w = cfg["weights"]["schedule"]
    pw = cfg["schedule"]["playoff_weight"]
    tc = team_ctx[team_ctx["team"] == player["team"]]
    if tc.empty:
        return 1.0
    tc = tc.iloc[0]
    pos_col = f"sos_{player['pos'].lower()}"
    season_sig = (float(tc[pos_col]) - 1.0)
    playoff_sig = (float(tc["sos_playoff_mult"]) - 1.0)
    blended = season_sig * (1 - pw) + playoff_sig * pw
    signal = _clamp(blended / _SOS_NORM)
    return 1.0 + w * signal


# --- 5. Team scoring environment (Vegas) ------------------------------------
_VEGAS_NORM = 0.20  # ~max relative deviation of implied team total from average


def vegas_modifier(player, team_ctx, cfg) -> float:
    w = cfg["weights"]["vegas"]
    avg = team_ctx[team_ctx["team"] == "League_Average"]["implied_total"]
    league_avg = float(avg.iloc[0]) if not avg.empty else team_ctx["implied_total"].mean()
    tc = team_ctx[team_ctx["team"] == player["team"]]
    if tc.empty:
        return 1.0
    implied = float(tc.iloc[0]["implied_total"])
    signal = _clamp(((implied - league_avg) / league_avg) / _VEGAS_NORM)
    return 1.0 + w * signal


# --- 6. Age curve ------------------------------------------------------------
def age_modifier(player, cfg) -> float:
    w = cfg["weights"]["age"]
    curve = cfg["age_curve"].get(player["pos"])
    if not curve:
        return 1.0
    dev = player["age"] - curve["peak"]
    # Younger-than-peak is treated as neutral; decline accelerates past the peak.
    signal = 0.0 if dev <= 0 else _clamp(-(dev / curve["span"]))
    return 1.0 + w * signal
