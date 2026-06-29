"""Guards for the availability / durability model."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nflproj import availability as av
from nflproj.config import load_config

CFG = load_config()
FULL = CFG["availability"]["full_season"]


def _p(**kw):
    base = dict(pos="WR", age=26, games=FULL, is_rookie=False)
    base.update(kw)
    return base


def test_rb_plays_fewer_games_than_wr():
    assert av.projected_games(_p(pos="RB"), CFG) < av.projected_games(_p(pos="WR"), CFG)


def test_recent_missed_games_lowers_availability():
    healthy = av.projected_games(_p(games=FULL), CFG)
    fragile = av.projected_games(_p(games=10), CFG)
    assert fragile < healthy


def test_age_past_threshold_lowers_availability():
    young = av.projected_games(_p(pos="RB", age=24), CFG)
    old = av.projected_games(_p(pos="RB", age=31), CFG)
    assert old < young


def test_rookie_ignores_missing_durability_history():
    """A rookie's low 'games' shouldn't be read as injury risk."""
    rookie = av.projected_games(_p(games=12, is_rookie=True), CFG)
    vet = av.projected_games(_p(games=12, is_rookie=False), CFG)
    assert rookie > vet


def test_rate_respects_floor():
    rate, _ = av.availability_rate(_p(pos="RB", age=40, games=5), CFG)
    assert rate >= CFG["availability"]["min_rate"]


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} tests passed.")
