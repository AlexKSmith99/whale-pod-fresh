"""Regression guards for the core modifier behaviors.

References the canonical 2026 data set (data/*.csv).
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


def test_run_first_qb_suppresses_passcatching_rb():
    """De'Von Achane with run-first Malik Willis should be QB-suppressed."""
    b = _board()
    assert b.loc["De'Von Achane", "M_qb"] < 1.0
    # ...and worse than a back paired with a pocket passer (Gibbs/Goff).
    assert b.loc["De'Von Achane", "M_qb"] < b.loc["Jahmyr Gibbs", "M_qb"]


def test_rushing_qb_vultures_goalline_back():
    """A heavy goal-line rushing QB (Hurts) suppresses his RB's TD value."""
    b = _board()
    assert b.loc["Saquon Barkley", "M_qb"] < 0.95


def test_oc_change_moves_modifier_continuity_is_neutral():
    """No OC change -> 1.0; a change -> non-neutral modifier."""
    b = _board()
    assert b.loc["Ja'Marr Chase", "M_oc"] == 1.0          # CIN: continuity
    assert b.loc["Amon-Ra St. Brown", "M_oc"] != 1.0      # DET: Morton -> Petzing


def test_vacated_targets_help_returning_receivers():
    """DJ Moore's vacated Bears targets should lift Rome Odunze."""
    b = _board()
    assert b.loc["Rome Odunze", "M_roster"] > 1.0


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
