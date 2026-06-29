"""Historical back-testing on real data.

Calibrating on real seasons needs, for each past season N:
  * anchors    — prior (N-1) production + opportunity shares      (from nflverse)
  * signals    — the modifier signals as the world looked entering N
                 (from HISTORICAL knowledge tables in data/history/)
  * realized   — season-N fantasy PPG                             (from nflverse)

This module wires those three together across seasons and hands the combined
(signals, anchor, realized) frame to backtest.calibrate_weights().

Network is only needed for anchors + realized. The signal-building core
(`signal_frame_for_season`) is network-free and unit-tested offline, so the
data-engineering and the modeling logic are validated independently.
"""
from __future__ import annotations

import os

import pandas as pd

from . import data_sources as ds
from .backtest import calibrate_weights, compute_signal_frame, evaluate, predict_from_weights
from .config import DATA_DIR

HISTORY_DIR = os.path.join(DATA_DIR, "history")


# --- Season-aware knowledge tables ------------------------------------------
def _read_or_fallback(history_dir: str, season: int, base: str, fallback: pd.DataFrame) -> pd.DataFrame:
    """Load data/history/<base>_<season>.csv, else fall back to the global table."""
    path = os.path.join(history_dir, f"{base}_{season}.csv")
    if os.path.exists(path):
        return pd.read_csv(path)
    if "season" in fallback.columns:
        sub = fallback[fallback["season"] == season]
        if not sub.empty:
            return sub
    return fallback


def load_season_context(season: int, history_dir: str = HISTORY_DIR) -> dict:
    """Knowledge tables as they were entering `season` (with global fallbacks)."""
    return {
        "team_ctx": _read_or_fallback(history_dir, season, "team_context", ds.load_team_context()),
        "roster": _read_or_fallback(history_dir, season, "roster_changes", ds.load_roster_changes()),
        "qb": _read_or_fallback(history_dir, season, "qb_profiles", ds.load_qb_profiles()),
        "coord": _read_or_fallback(history_dir, season, "coordinator_scores", ds.load_coordinator_scores()),
    }


# --- Network-free signal core ------------------------------------------------
def signal_frame_for_season(players: pd.DataFrame, season: int, cfg: dict,
                            history_dir: str = HISTORY_DIR) -> pd.DataFrame:
    """Signals + anchor for a player set, using `season`'s historical tables.

    `players` must carry the same columns as sample_players.csv. This is the
    deterministic, testable heart of the historical pipeline — no network.
    """
    ctx = load_season_context(season, history_dir)
    frame = compute_signal_frame(players, ctx["team_ctx"], ctx["coord"], ctx["qb"], ctx["roster"], cfg)
    frame["season"] = season
    return frame


# --- Live realized PPG -------------------------------------------------------
def realized_ppg_live(season: int) -> pd.DataFrame:
    """Season-N fantasy PPG per player from nflverse (for the target column)."""
    import nfl_data_py as nfl
    wk = nfl.import_weekly_data([season])
    skill = wk[wk["position"].isin(["QB", "RB", "WR", "TE"])]
    g = skill.groupby("player_display_name").agg(
        pts=("fantasy_points_ppr", "sum"), games=("week", "nunique")).reset_index()
    g["realized_ppg"] = g["pts"] / g["games"].clip(lower=1)
    return g.rename(columns={"player_display_name": "player"})[["player", "realized_ppg", "games"]]


# --- Multi-season live frame -------------------------------------------------
def build_backtest_frame_live(seasons: list[int], cfg: dict,
                              history_dir: str = HISTORY_DIR, min_games: int = 6) -> pd.DataFrame:
    """Combined (signals, anchor, realized) across seasons, built from real data."""
    frames = []
    for season in seasons:
        anchors = ds.build_player_table_live(season - 1)        # production entering season
        sigs = signal_frame_for_season(anchors, season, cfg, history_dir)
        realized = realized_ppg_live(season)
        merged = sigs.merge(realized, on="player", how="inner")
        merged = merged[merged["games"] >= min_games]
        frames.append(merged)
    if not frames:
        raise RuntimeError("no seasons produced data")
    return pd.concat(frames, ignore_index=True)


def run_live_calibration(seasons: list[int], cfg: dict, history_dir: str = HISTORY_DIR,
                         alpha: float = 1.0) -> dict:
    """Fit weights on all-but-last season, evaluate on the held-out last season."""
    frame = build_backtest_frame_live(seasons, cfg, history_dir)
    test_season = max(seasons)
    train = frame[frame["season"] != test_season]
    test = frame[frame["season"] == test_season]
    if train.empty or test.empty:           # single season -> evaluate in-sample
        train = test = frame

    fitted = calibrate_weights(train, train["realized_ppg"], cfg, alpha=alpha)
    naive_pred = test["anchor"]
    cal_pred = predict_from_weights(test, fitted, cfg)
    return {
        "seasons": seasons, "n_rows": int(len(frame)), "test_season": test_season,
        "fitted_weights": fitted,
        "naive": evaluate(naive_pred, test["realized_ppg"]),
        "calibrated": evaluate(cal_pred, test["realized_ppg"]),
    }
