"""Guards for scoring-format conversion."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nflproj import scoring


def test_ppr_is_unchanged():
    assert scoring.adjust_anchor(20.0, 6.0, "ppr") == 20.0


def test_half_removes_half_point_per_reception():
    assert scoring.adjust_anchor(20.0, 6.0, "half") == 17.0   # 20 - 0.5*6


def test_standard_removes_full_point_per_reception():
    assert scoring.adjust_anchor(20.0, 6.0, "standard") == 14.0  # 20 - 1.0*6


def test_nan_receptions_are_safe():
    assert scoring.adjust_anchor(15.0, float("nan"), "half") == 15.0


def test_high_reception_players_fall_more_in_non_ppr():
    """A pass-catching back should drop further than a pure rusher in standard."""
    catcher = scoring.adjust_anchor(15.0, 5.0, "standard")   # -5.0
    grinder = scoring.adjust_anchor(15.0, 1.0, "standard")   # -1.0
    assert (15.0 - catcher) > (15.0 - grinder)


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} tests passed.")
