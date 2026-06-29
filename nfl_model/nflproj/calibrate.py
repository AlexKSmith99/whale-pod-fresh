"""CLI: calibrate / back-test the projection weights.

    python -m nflproj.calibrate              # synthetic self-validation demo
    python -m nflproj.calibrate --write      # also write config/weights.calibrated.yaml

The demo proves the machinery end-to-end with no network: it plants known
weights, fits them from synthetic data, and shows the calibrated model beats the
"last year's points" baseline on held-out data. To calibrate on REAL data,
assemble historical per-season (anchor, signals, realized) frames from nflverse
plus historical knowledge tables and pass them to backtest.calibrate_weights().
"""
from __future__ import annotations

import argparse
import copy
import os

import yaml

from . import backtest
from .config import CONFIG_PATH, load_config


def _fmt(d: dict) -> str:
    return "  ".join(f"{k}={v:.3f}" for k, v in d.items())


def main() -> None:
    ap = argparse.ArgumentParser(description="Calibrate / back-test projection weights")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--write", action="store_true",
                    help="write fitted weights to config/weights.calibrated.yaml")
    args = ap.parse_args()

    res = backtest.run_demo(seed=args.seed)

    print("=== WEIGHT RECOVERY (synthetic) ===")
    print(f"planted : {_fmt(res['true_weights'])}")
    print(f"fitted  : {_fmt(res['fitted_weights'])}")

    print("\n=== HELD-OUT ACCURACY (lower MAE/RMSE better, higher spearman better) ===")
    for label in ("naive", "calibrated", "oracle"):
        m = res[label]
        print(f"{label:11s} MAE={m['MAE']:6.3f}  RMSE={m['RMSE']:6.3f}  spearman={m['spearman']:.3f}")

    lift = res["naive"]["MAE"] - res["calibrated"]["MAE"]
    print(f"\nCalibrated model reduces MAE vs last-year baseline by {lift:.3f} PPG.")

    if args.write:
        cfg = copy.deepcopy(load_config())
        cfg["weights"].update(res["fitted_weights"])
        out = os.path.join(os.path.dirname(CONFIG_PATH), "weights.calibrated.yaml")
        with open(out, "w") as fh:
            yaml.safe_dump(cfg, fh, sort_keys=False)
        print(f"\nWrote calibrated config to {out}")


if __name__ == "__main__":
    main()
