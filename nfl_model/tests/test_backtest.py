"""Guards for the calibration / back-test harness."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nflproj import backtest


def test_calibrator_recovers_planted_weights():
    """Fitted weights should land close to the weights used to generate data."""
    res = backtest.run_demo(seed=0)
    for name, planted in res["true_weights"].items():
        assert abs(res["fitted_weights"][name] - planted) < 0.03, name


def test_calibrated_beats_naive_baseline():
    """Modifiers must add real lift over a last-year-points baseline."""
    res = backtest.run_demo(seed=0)
    assert res["calibrated"]["MAE"] < res["naive"]["MAE"]
    assert res["calibrated"]["spearman"] > res["naive"]["spearman"]


def test_calibrated_is_near_oracle():
    res = backtest.run_demo(seed=0)
    assert res["calibrated"]["MAE"] <= res["oracle"]["MAE"] * 1.10


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} tests passed.")
