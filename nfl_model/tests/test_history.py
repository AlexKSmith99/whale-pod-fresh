"""Offline guards for the historical signal pipeline (no network)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nflproj import data_sources as ds
from nflproj import history
from nflproj.backtest import predict_from_weights
from nflproj.config import load_config
from nflproj.modifiers import SIGNAL_NAMES


def test_signal_frame_for_season_builds():
    cfg = load_config()
    players = ds.load_sample_players()
    frame = history.signal_frame_for_season(players, 2024, cfg)
    assert len(frame) == len(players)
    for col in SIGNAL_NAMES + ["anchor", "season"]:
        assert col in frame.columns
    assert (frame["season"] == 2024).all()


def test_predict_runs_on_historical_frame():
    cfg = load_config()
    frame = history.signal_frame_for_season(ds.load_sample_players(), 2024, cfg)
    pred = predict_from_weights(frame, cfg["weights"], cfg)
    assert (pred > 0).all()


def test_season_override_changes_oc_signal():
    """2024 history table (Bears: Waldron) should differ from global 2025 (Ben Johnson)."""
    cfg = load_config()
    players = ds.load_sample_players()
    f2024 = history.signal_frame_for_season(players, 2024, cfg).set_index("player")
    f2025 = history.signal_frame_for_season(players, 2025, cfg).set_index("player")
    # DJ Moore's OC signal should be much stronger in 2025 (Ben Johnson arrives).
    assert f2025.loc["DJ Moore", "oc"] > f2024.loc["DJ Moore", "oc"]


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} tests passed.")
