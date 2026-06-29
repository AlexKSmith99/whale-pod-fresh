"""Projection engine — combine anchor x modifiers into ranked projections.

Beyond a point estimate, the engine reports:
  * floor / ceiling — a lognormal outcome band whose width grows with position
    volatility, rookie status, and scheme/roster change (uncertainty model).
  * value vs ADP    — where our rank sits relative to the draft market, so the
    output is a *decision* (draft / fade), not just a number.
"""
from __future__ import annotations

import math

import pandas as pd

from . import modifiers as M
from .config import load_config

PROJECTED_GAMES = 16.0  # season-total assumption; availability modeling is future work


def project(players: pd.DataFrame, team_ctx: pd.DataFrame, coord: pd.DataFrame,
            qb_profiles: pd.DataFrame, roster_changes: pd.DataFrame,
            adp: pd.DataFrame | None = None, cfg: dict | None = None) -> pd.DataFrame:
    """Run every modifier for every player and return a ranked projection table."""
    cfg = cfg or load_config()
    rows = []
    for _, p in players.iterrows():
        m_oc = M.coordinator_modifier(p, team_ctx, coord, cfg)
        m_roster = M.roster_modifier(p, roster_changes, cfg)
        m_qb = M.qb_modifier(p, qb_profiles, cfg)
        m_sched = M.schedule_modifier(p, team_ctx, cfg)
        m_vegas = M.vegas_modifier(p, team_ctx, cfg)
        m_age = M.age_modifier(p, cfg)

        total = m_oc * m_roster * m_qb * m_sched * m_vegas * m_age
        proj_ppg = p["prior_ppg"] * total
        rows.append({
            "player": p["player"], "pos": p["pos"], "team": p["team"],
            "age": p["age"], "qb": p["qb_name"],
            "is_rookie": bool(p.get("is_rookie", False)),
            "prior_ppg": round(p["prior_ppg"], 2),
            "M_oc": round(m_oc, 3), "M_roster": round(m_roster, 3),
            "M_qb": round(m_qb, 3), "M_sched": round(m_sched, 3),
            "M_vegas": round(m_vegas, 3), "M_age": round(m_age, 3),
            "total_mult": round(total, 3),
            "proj_ppg": round(proj_ppg, 2),
            "proj_season": round(proj_ppg * PROJECTED_GAMES, 1),
        })

    df = pd.DataFrame(rows)
    df = _add_distribution(df, cfg)
    df = _add_ranks_and_vor(df, cfg)
    if adp is not None:
        df = _add_value_vs_adp(df, adp, cfg)
    return df.sort_values(["proj_season"], ascending=False).reset_index(drop=True)


def _add_distribution(df: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Lognormal floor/ceiling band per player."""
    u = cfg["uncertainty"]
    z = u["z"]
    floors, ceils, sigmas = [], [], []
    for _, r in df.iterrows():
        cv = u["cv_base"].get(r["pos"], 0.30)
        change_risk = abs(r["M_oc"] - 1) + abs(r["M_roster"] - 1)
        sigma = cv + u["rookie_bump"] * r["is_rookie"] + u["change_sensitivity"] * change_risk
        floors.append(round(r["proj_season"] * math.exp(-z * sigma), 1))
        ceils.append(round(r["proj_season"] * math.exp(z * sigma), 1))
        sigmas.append(round(sigma, 3))
    df["sigma"] = sigmas
    df["floor"] = floors
    df["ceiling"] = ceils
    return df


def _add_ranks_and_vor(df: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Positional rank, overall rank, and Value Over Replacement."""
    df["pos_rank"] = df.groupby("pos")["proj_season"].rank(ascending=False, method="min").astype(int)
    repl = cfg["replacement_rank"]
    vor = []
    for _, r in df.iterrows():
        pos_df = df[df["pos"] == r["pos"]].sort_values("proj_season", ascending=False)
        k = repl.get(r["pos"], len(pos_df))
        baseline = pos_df["proj_season"].iloc[min(k, len(pos_df)) - 1] if len(pos_df) else 0.0
        vor.append(round(r["proj_season"] - baseline, 1))
    df["vor"] = vor
    df["overall_rank"] = df["vor"].rank(ascending=False, method="min").astype(int)
    return df


def _add_value_vs_adp(df: pd.DataFrame, adp: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Compare our overall rank to the draft market; flag VALUE / FADE."""
    df = df.merge(adp[["player", "adp"]], on="player", how="left")
    drafted = df["adp"].notna()
    # Rank ADP within the pool so it is comparable to our overall_rank.
    df["adp_rank"] = df["adp"].rank(method="min")
    df["value"] = (df["adp_rank"] - df["overall_rank"]).where(drafted)
    edge = cfg["value_vs_adp"]["edge_threshold"]
    df["call"] = df["value"].apply(
        lambda v: "" if pd.isna(v) else ("VALUE" if v >= edge else ("FADE" if v <= -edge else "fair")))
    df["adp"] = df["adp"].astype("Int64")
    df["adp_rank"] = df["adp_rank"].astype("Int64")
    df["value"] = df["value"].astype("Int64")
    return df
