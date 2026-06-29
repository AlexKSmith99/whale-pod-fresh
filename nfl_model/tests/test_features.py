"""Guards for rookie anchors, floor/ceiling bands, and value-vs-ADP."""
from __future__ import annotations

import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nflproj import data_sources as ds
from nflproj import rookies as rk
from nflproj.config import load_config
from nflproj.engine import project


def _board():
    cfg = load_config()
    players = ds.load_sample_players()
    players["is_rookie"] = False
    players = pd.concat([players, rk.load_rookies(cfg)], ignore_index=True)
    players["is_rookie"] = players["is_rookie"].fillna(False)
    return project(
        players=players, team_ctx=ds.load_team_context(),
        coord=ds.load_coordinator_scores(), qb_profiles=ds.load_qb_profiles(),
        roster_changes=ds.load_roster_changes(), adp=ds.load_adp(), cfg=cfg,
    ).set_index("player")


def test_rookie_anchor_decreases_with_draft_pick():
    cfg = load_config()
    early = rk.rookie_anchor_ppg("RB", 5, cfg)
    late = rk.rookie_anchor_ppg("RB", 150, cfg)
    assert early > late > 0


def test_rookies_are_projected_and_flagged():
    b = _board()
    assert b.loc["Ashton Jeanty", "is_rookie"]
    assert b.loc["Ashton Jeanty", "proj_season"] > 0


def test_floor_below_projection_below_ceiling():
    b = _board()
    for name in ("Ja'Marr Chase", "Ashton Jeanty"):
        assert b.loc[name, "floor"] < b.loc[name, "proj_season"] < b.loc[name, "ceiling"]


def test_rookie_has_wider_band_than_comparable_veteran():
    """Rookie uncertainty bump should widen sigma vs an established player."""
    b = _board()
    assert b.loc["Ashton Jeanty", "sigma"] > b.loc["Jonathan Taylor", "sigma"]


def test_value_call_flags_market_gaps():
    b = _board()
    # D'Andre Swift: model rank far ahead of his ADP -> VALUE.
    assert b.loc["D'Andre Swift", "call"] == "VALUE"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} tests passed.")
