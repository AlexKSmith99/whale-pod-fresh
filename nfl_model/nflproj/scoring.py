"""Scoring-format support (PPR / half-PPR / standard).

Anchors are stored as full-PPR PPG (1.0 pt per reception). Any format is derived
by removing the reception points that format doesn't award:

    format_ppg = ppr_ppg - (1.0 - reception_points[format]) * receptions_per_game

The modifiers are scoring-agnostic, so adjusting the anchor reranks the whole
board for the chosen format.
"""
from __future__ import annotations

RECEPTION_POINTS = {"ppr": 1.0, "half": 0.5, "standard": 0.0}
FORMATS = tuple(RECEPTION_POINTS)


def adjust_anchor(ppr_ppg: float, rec_pg: float, fmt: str) -> float:
    rp = RECEPTION_POINTS[fmt]
    rec = 0.0 if rec_pg is None or rec_pg != rec_pg else rec_pg  # NaN-safe
    return round(ppr_ppg - (1.0 - rp) * rec, 2)
