"""CLI entrypoint.

    python -m nflproj.project                 # sample data (runs anywhere)
    python -m nflproj.project --live 2024     # build anchors from real nflverse data

Writes a ranked projection CSV to output/ and prints the board.
"""
from __future__ import annotations

import argparse
import os

import pandas as pd

from . import data_sources as ds
from .config import OUTPUT_DIR, load_config
from .engine import project


def main() -> None:
    ap = argparse.ArgumentParser(description="NFL fantasy projection engine")
    ap.add_argument("--live", type=int, metavar="PRIOR_SEASON", default=None,
                    help="Build player anchors from real nflverse data for the given prior season")
    ap.add_argument("--out", default=os.path.join(OUTPUT_DIR, "projections.csv"))
    args = ap.parse_args()

    cfg = load_config()
    players = ds.load_players(prior_season=args.live, live=args.live is not None)
    board = project(
        players=players,
        team_ctx=ds.load_team_context(),
        coord=ds.load_coordinator_scores(),
        qb_profiles=ds.load_qb_profiles(),
        roster_changes=ds.load_roster_changes(),
        cfg=cfg,
    )

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    board.to_csv(args.out, index=False)

    pd.set_option("display.width", 200, "display.max_columns", 30)
    show = ["overall_rank", "player", "pos", "team", "qb", "prior_ppg",
            "M_oc", "M_roster", "M_qb", "M_sched", "M_vegas", "M_age",
            "proj_ppg", "proj_season", "pos_rank", "vor"]
    print("\n=== PROJECTION BOARD ===")
    print(board[show].to_string(index=False))
    print(f"\nWrote {len(board)} projections to {args.out}")


if __name__ == "__main__":
    main()
