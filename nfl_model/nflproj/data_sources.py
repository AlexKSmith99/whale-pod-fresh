"""Data sources.

Two modes:
  * Knowledge tables (coordinator scores, QB profiles, team context, roster
    moves, sample players) — bundled CSVs you curate by hand / semi-automate.
  * Live nflverse data via `nfl_data_py` — used to AUTO-BUILD the player anchor
    table (prior-year fantasy PPG + opportunity shares) when network is
    available. Falls back to the bundled sample when it is not.

The live builder (`build_player_table_live`) is what you run on your own machine;
the sample loader keeps the whole pipeline runnable anywhere (e.g. CI / sandbox).
"""
from __future__ import annotations

import os

import pandas as pd

from .config import DATA_DIR


# --- Knowledge tables --------------------------------------------------------
def load_coordinator_scores() -> pd.DataFrame:
    return pd.read_csv(os.path.join(DATA_DIR, "coordinator_scores.csv"))


def load_qb_profiles() -> pd.DataFrame:
    return pd.read_csv(os.path.join(DATA_DIR, "qb_profiles.csv"))


def load_team_context() -> pd.DataFrame:
    return pd.read_csv(os.path.join(DATA_DIR, "team_context.csv"))


def load_roster_changes() -> pd.DataFrame:
    return pd.read_csv(os.path.join(DATA_DIR, "roster_changes.csv"))


def load_sample_players() -> pd.DataFrame:
    return pd.read_csv(os.path.join(DATA_DIR, "sample_players.csv"))


def load_adp() -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "adp.csv")
    return pd.read_csv(path) if os.path.exists(path) else pd.DataFrame(columns=["player", "adp"])


# --- Live anchor builder (nfl_data_py) --------------------------------------
def build_player_table_live(prior_season: int) -> pd.DataFrame:
    """Build the player anchor table from real nflverse data.

    Produces the same schema as sample_players.csv:
      player, pos, team, age, qb_name, prior_ppg, games,
      target_share, rush_share, rz_share, air_yards_share

    Requires outbound network access to the nflverse data releases. Raises a
    RuntimeError (caught by callers) if the fetch is blocked.
    """
    try:
        import nfl_data_py as nfl
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("nfl_data_py not installed") from exc

    try:
        wk = nfl.import_weekly_data([prior_season])
        rosters = nfl.import_seasonal_rosters([prior_season])
    except Exception as exc:  # network blocked, etc.
        raise RuntimeError(f"live fetch failed: {exc}") from exc

    skill = wk[wk["position"].isin(["QB", "RB", "WR", "TE"])].copy()

    # Per-player season aggregates.
    grp = skill.groupby(["player_id", "player_display_name", "position", "recent_team"])
    agg = grp.agg(
        fantasy_points_ppr=("fantasy_points_ppr", "sum"),
        games=("week", "nunique"),
        targets=("targets", "sum"),
        receptions=("receptions", "sum"),
        carries=("carries", "sum"),
        air_yards=("receiving_air_yards", "sum"),
    ).reset_index()
    agg["prior_ppg"] = agg["fantasy_points_ppr"] / agg["games"].clip(lower=1)
    agg["rec_pg"] = agg["receptions"] / agg["games"].clip(lower=1)

    # Team-level totals to convert raw counts into shares.
    team_tot = skill.groupby("recent_team").agg(
        team_targets=("targets", "sum"),
        team_carries=("carries", "sum"),
        team_air=("receiving_air_yards", "sum"),
    ).reset_index()
    agg = agg.merge(team_tot, on="recent_team", how="left")
    agg["target_share"] = agg["targets"] / agg["team_targets"].clip(lower=1)
    agg["rush_share"] = agg["carries"] / agg["team_carries"].clip(lower=1)
    agg["air_yards_share"] = agg["air_yards"] / agg["team_air"].clip(lower=1)
    # rz_share requires play-by-play; approximate with target/rush share for v0.1.
    agg["rz_share"] = agg[["target_share", "rush_share"]].max(axis=1)

    # Attach age and the team's primary QB.
    rosters = rosters.rename(columns={"player_name": "player_display_name"})
    age_map = rosters.set_index("player_display_name")["age"].to_dict()
    agg["age"] = agg["player_display_name"].map(age_map).fillna(26).astype(int)

    qbs = skill[skill["position"] == "QB"]
    qb1 = (qbs.groupby(["recent_team", "player_display_name"])["attempts"].sum()
           .reset_index().sort_values("attempts", ascending=False)
           .drop_duplicates("recent_team"))
    qb_map = qb1.set_index("recent_team")["player_display_name"].to_dict()
    agg["qb_name"] = agg["recent_team"].map(qb_map).fillna("League_Average")

    out = agg.rename(columns={
        "player_display_name": "player", "position": "pos", "recent_team": "team",
    })[["player", "pos", "team", "age", "qb_name", "prior_ppg", "games",
        "target_share", "rush_share", "rz_share", "air_yards_share", "rec_pg"]]
    return out[out["games"] >= 4].reset_index(drop=True)


def load_players(prior_season: int | None = None, live: bool = False) -> pd.DataFrame:
    """Load the player anchor table, preferring live data when requested."""
    if live and prior_season is not None:
        try:
            return build_player_table_live(prior_season)
        except RuntimeError as exc:
            print(f"[data_sources] live fetch unavailable ({exc}); using sample data")
    return load_sample_players()
