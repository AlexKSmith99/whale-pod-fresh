"""CLI entrypoint.

    python -m nflproj.project                 # sample data + rookies (runs anywhere)
    python -m nflproj.project --live 2024     # build veteran anchors from nflverse
    python -m nflproj.project --no-rookies    # veterans only

Writes a ranked projection CSV to output/ and prints the board with floor/ceiling
bands and value-vs-ADP calls.
"""
from __future__ import annotations

import argparse
import os

import pandas as pd

from . import data_sources as ds
from . import rookies as rk
from .config import OUTPUT_DIR, load_config
from .engine import project


def main() -> None:
    ap = argparse.ArgumentParser(description="NFL fantasy projection engine")
    ap.add_argument("--live", type=int, metavar="PRIOR_SEASON", default=None,
                    help="Build veteran anchors from real nflverse data for the given prior season")
    ap.add_argument("--no-rookies", action="store_true", help="exclude draft-capital rookie anchors")
    ap.add_argument("--out", default=os.path.join(OUTPUT_DIR, "projections.csv"))
    args = ap.parse_args()

    cfg = load_config()
    players = ds.load_players(prior_season=args.live, live=args.live is not None)
    if "is_rookie" not in players.columns:
        players["is_rookie"] = False
    if not args.no_rookies:
        rookies = rk.load_rookies(cfg)
        if not rookies.empty:
            players = pd.concat([players, rookies], ignore_index=True)
            players["is_rookie"] = players["is_rookie"].fillna(False)

    board = project(
        players=players,
        team_ctx=ds.load_team_context(),
        coord=ds.load_coordinator_scores(),
        qb_profiles=ds.load_qb_profiles(),
        roster_changes=ds.load_roster_changes(),
        adp=ds.load_adp(),
        cfg=cfg,
    )

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    board.to_csv(args.out, index=False)

    pd.set_option("display.width", 240, "display.max_columns", 40)
    show = ["overall_rank", "player", "pos", "team", "qb", "prior_ppg",
            "M_oc", "M_roster", "M_qb", "proj_ppg", "proj_games", "proj_season",
            "floor", "ceiling", "pos_rank", "adp", "value", "call"]
    show = [c for c in show if c in board.columns]
    print("\n=== PROJECTION BOARD (proj_season with floor/ceiling band) ===")
    print(board[show].to_string(index=False))
    print(f"\nWrote {len(board)} projections to {args.out}")


if __name__ == "__main__":
    main()
