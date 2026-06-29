"""Projection modifiers.

Each factor is split into two layers:

  * a `*_signal(...)` function -> the normalized real-world quantity (~[-1, 1]),
    independent of any weight. These are the regression features used to
    *calibrate* the weights (see backtest.py).
  * a `*_modifier(...)` function -> the multiplier actually applied to a
    projection, of the form  M = 1 + weight * signal  (weights from weights.yaml).

Keeping signal and weight separate is what lets us fit the weights from data
instead of guessing them, while still applying them transparently.
"""
from __future__ import annotations

import pandas as pd

# Calibrated/applied constants that are not themselves weights.
_SHARE_LEVERAGE = 3.0   # a 1pt share swing moves fantasy output ~3x its size
_SOS_NORM = 0.06        # typical max season SoS deviation -> full signal scale
_VEGAS_NORM = 0.20      # ~max relative deviation of implied team total from avg


def _clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _oc_score(coord: pd.DataFrame, name: str, league_avg: float) -> tuple[float, float]:
    row = coord[coord["oc_name"] == name]
    if row.empty:
        return league_avg, 0.0
    return float(row.iloc[0]["oc_score"]), float(row.iloc[0]["pass_lean"])


# --- 1. Coordinator / scheme change -----------------------------------------
def coordinator_signal(player, team_ctx, coord, cfg) -> tuple[float, bool]:
    """Return (signal, changed). `changed` flags a scheme transition (penalty)."""
    c = cfg["coordinator"]
    tc = team_ctx[team_ctx["team"] == player["team"]]
    if tc.empty:
        return 0.0, False
    tc = tc.iloc[0]
    if tc["oc_name"] == tc["prev_oc_name"]:
        return 0.0, False
    avg = c["league_avg_score"]
    new_score, new_lean = _oc_score(coord, tc["oc_name"], avg)
    prev_score, prev_lean = _oc_score(coord, tc["prev_oc_name"], avg)
    sig_quality = (new_score - prev_score) / 50.0
    lean_sens = c["pass_lean_sensitivity"].get(player["pos"], 0.0)
    sig_lean = (new_lean - prev_lean) * lean_sens
    return _clamp(sig_quality + sig_lean), True


def coordinator_modifier(player, team_ctx, coord, cfg) -> float:
    signal, changed = coordinator_signal(player, team_ctx, coord, cfg)
    if not changed:
        return 1.0
    return 1.0 + cfg["weights"]["oc"] * signal - cfg["coordinator"]["transition_penalty"]


# --- 2. Roster turnover (vacated / added opportunity) ------------------------
def roster_signal(player, roster_changes, cfg) -> float:
    rc = roster_changes[roster_changes["team"] == player["team"]]
    rc = rc[rc["player_name"] != player["player"]]
    if rc.empty:
        return 0.0
    pos = player["pos"]
    if pos in ("WR", "TE"):
        share_col = "target_share"
    elif pos == "RB":
        share_col = "rush_share"
    else:
        return 0.0
    vacated = rc[rc["direction"] == "out"][share_col].sum()
    added = rc[rc["direction"] == "in"][share_col].sum()
    return _clamp((vacated - added) * _SHARE_LEVERAGE)


def roster_modifier(player, roster_changes, cfg) -> float:
    return 1.0 + cfg["weights"]["roster"] * roster_signal(player, roster_changes, cfg)


# --- 3. QB-profile fit -------------------------------------------------------
def _qb_row(qb_profiles, name):
    row = qb_profiles[qb_profiles["qb_name"] == name]
    base = qb_profiles[qb_profiles["qb_name"] == "League_Average"].iloc[0]
    return (row.iloc[0] if not row.empty else base), base


def qb_signal(player, qb_profiles, cfg) -> float:
    pos = player["pos"]
    if pos == "QB" or pos not in cfg["qb_environment"]:
        return 0.0
    sens = cfg["qb_environment"][pos]
    qb, base = _qb_row(qb_profiles, player["qb_name"])

    def rel(field):
        b = float(base[field])
        return (float(qb[field]) - b) / b if b else 0.0

    parts = []
    if "pass_volume" in sens:
        parts.append(sens["pass_volume"] * rel("pass_att_pg"))
    if "downfield" in sens:
        parts.append(sens["downfield"] * rel("adot"))
    if "dumpoff" in sens:
        scale = player["target_share"] / 0.10 if pos == "RB" else 1.0
        parts.append(sens["dumpoff"] * rel("dumpoff_rate") * scale)
    if "scramble_drain" in sens:
        parts.append(sens["scramble_drain"] * rel("rush_att_pg"))
    if "goalline_vulture" in sens:
        scale = player["rz_share"] / 0.20 if pos == "RB" else 1.0
        parts.append(sens["goalline_vulture"] * rel("rush_td") * scale)
    return _clamp(sum(parts))


def qb_modifier(player, qb_profiles, cfg) -> float:
    return 1.0 + cfg["weights"]["qb"] * qb_signal(player, qb_profiles, cfg)


# --- 4. Strength of schedule -------------------------------------------------
def schedule_signal(player, team_ctx, cfg) -> float:
    pw = cfg["schedule"]["playoff_weight"]
    tc = team_ctx[team_ctx["team"] == player["team"]]
    if tc.empty:
        return 0.0
    tc = tc.iloc[0]
    season_sig = float(tc[f"sos_{player['pos'].lower()}"]) - 1.0
    playoff_sig = float(tc["sos_playoff_mult"]) - 1.0
    blended = season_sig * (1 - pw) + playoff_sig * pw
    return _clamp(blended / _SOS_NORM)


def schedule_modifier(player, team_ctx, cfg) -> float:
    return 1.0 + cfg["weights"]["schedule"] * schedule_signal(player, team_ctx, cfg)


# --- 5. Team scoring environment (Vegas) ------------------------------------
def vegas_signal(player, team_ctx, cfg) -> float:
    avg = team_ctx[team_ctx["team"] == "League_Average"]["implied_total"]
    league_avg = float(avg.iloc[0]) if not avg.empty else team_ctx["implied_total"].mean()
    tc = team_ctx[team_ctx["team"] == player["team"]]
    if tc.empty:
        return 0.0
    implied = float(tc.iloc[0]["implied_total"])
    return _clamp(((implied - league_avg) / league_avg) / _VEGAS_NORM)


def vegas_modifier(player, team_ctx, cfg) -> float:
    return 1.0 + cfg["weights"]["vegas"] * vegas_signal(player, team_ctx, cfg)


# --- 6. Age curve ------------------------------------------------------------
def age_signal(player, cfg) -> float:
    curve = cfg["age_curve"].get(player["pos"])
    if not curve:
        return 0.0
    dev = player["age"] - curve["peak"]
    return 0.0 if dev <= 0 else _clamp(-(dev / curve["span"]))


def age_modifier(player, cfg) -> float:
    return 1.0 + cfg["weights"]["age"] * age_signal(player, cfg)


# --- Signal vector (features for calibration) --------------------------------
SIGNAL_NAMES = ["oc", "roster", "qb", "schedule", "vegas", "age"]


def compute_signals(player, team_ctx, coord, qb_profiles, roster_changes, cfg) -> dict:
    """All six raw signals for one player, plus the OC-change flag.

    These are the regression features the calibrator fits weights against.
    """
    oc_sig, oc_changed = coordinator_signal(player, team_ctx, coord, cfg)
    return {
        "oc": oc_sig,
        "roster": roster_signal(player, roster_changes, cfg),
        "qb": qb_signal(player, qb_profiles, cfg),
        "schedule": schedule_signal(player, team_ctx, cfg),
        "vegas": vegas_signal(player, team_ctx, cfg),
        "age": age_signal(player, cfg),
        "oc_changed": oc_changed,
    }
