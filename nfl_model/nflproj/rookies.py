"""Rookie draft-capital anchors.

Rookies have no prior-year NFL production to anchor on, so a backward-looking
model simply omits them. Instead we derive an anchor PPG from draft slot using a
position-specific decay curve (early picks earn opportunity + capital investment;
Day-3 picks rarely produce as rookies). Once anchored, rookies flow through the
exact same modifier engine as veterans — their projected role (shares), QB,
scheme, schedule, and Vegas environment all still apply.
"""
from __future__ import annotations

import math
import os

import pandas as pd

from .config import DATA_DIR


def rookie_anchor_ppg(pos: str, draft_pick: int, cfg: dict) -> float:
    """Expected rookie-year PPG from draft slot via exponential decay."""
    curve = cfg["rookie_anchor"].get(pos)
    if not curve:
        return 0.0
    peak, floor, scale = curve["peak"], curve["floor"], curve["scale"]
    return round(floor + (peak - floor) * math.exp(-(draft_pick - 1) / scale), 2)


def load_rookies(cfg: dict) -> pd.DataFrame:
    """Load rookies.csv and synthesize the standard player-frame columns.

    rookies.csv carries draft_pick + projected shares; we compute prior_ppg from
    draft capital and flag the rows so the uncertainty model widens their bands.
    """
    path = os.path.join(DATA_DIR, "rookies.csv")
    if not os.path.exists(path):
        return pd.DataFrame()
    r = pd.read_csv(path)
    r["prior_ppg"] = [rookie_anchor_ppg(p, int(pk), cfg)
                      for p, pk in zip(r["pos"], r["draft_pick"])]
    r["is_rookie"] = True
    # Rookies sit at/below positional peak age -> age modifier stays neutral.
    if "age" not in r.columns:
        r["age"] = 22
    cols = ["player", "pos", "team", "age", "qb_name", "prior_ppg", "games",
            "target_share", "rush_share", "rz_share", "air_yards_share", "is_rookie"]
    return r[[c for c in cols if c in r.columns]]
