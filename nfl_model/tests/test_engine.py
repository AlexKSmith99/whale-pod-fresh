"""Regression guards for the core modifier behaviors.

Run: python -m pytest nfl_model/tests  (or: python nfl_model/tests/test_engine.py)
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nflproj import data_sources as ds
from nflproj.config import load_config
from nflproj.engine import project


def _board():
    cfg = load_config()
    return project(
        players=ds.load_sample_players(),
        team_ctx=ds.load_team_context(),
        coord=ds.load_coordinator_scores(),
        qb_profiles=ds.load_qb_profiles(),
        roster_changes=ds.load_roster_changes(),
        cfg=cfg,
    ).set_index("player")


def test_qb_profile_helps_passcatching_rb_more_than_runfirst_qb():
    """Tua's checkdown profile should lift a pass-catching RB above a Willis RB."""
    b = _board()
    assert b.loc["De'Von Achane", "M_qb"] > 1.0      # Tua: checkdowns help
    assert b.loc["Josh Jacobs", "M_qb"] < 1.0        # Willis: run-first hurts RB
    assert b.loc["De'Von Achane", "M_qb"] > b.loc["Josh Jacobs", "M_qb"]


def test_rushing_qb_vultures_goalline_back():
    """A heavy goal-line rushing QB (Hurts) suppresses his RB's TD value."""
    b = _board()
    assert b.loc["Saquon Barkley", "M_qb"] < 0.95


def test_new_elite_oc_boosts_skill_players():
    """Ben Johnson arriving in CHI lifts the Bears; leaving DET hurts the Lions."""
    b = _board()
    assert b.loc["DJ Moore", "M_oc"] > 1.0
    assert b.loc["Amon-Ra St. Brown", "M_oc"] < 1.0


def test_vacated_targets_help_returning_receivers():
    b = _board()
    assert b.loc["Tyreek Hill", "M_roster"] > 1.0


def test_high_vegas_total_boosts_offense():
    """Detroit's high implied total should give a positive Vegas modifier."""
    b = _board()
    assert b.loc["Jahmyr Gibbs", "M_vegas"] > 1.0


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} tests passed.")
