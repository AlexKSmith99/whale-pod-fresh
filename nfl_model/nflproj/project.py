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
from . import scoring
from .config import OUTPUT_DIR, load_config
from .engine import project


def main() -> None:
    ap = argparse.ArgumentParser(description="NFL fantasy projection engine")
    ap.add_argument("--live", type=int, metavar="PRIOR_SEASON", default=None,
                    help="Build veteran anchors from real nflverse data for the given prior season")
    ap.add_argument("--format", choices=scoring.FORMATS, default="ppr",
                    help="scoring format: ppr (default), half, or standard")
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

    # Convert full-PPR anchors to the requested scoring format.
    if args.format != "ppr":
        rec = players["rec_pg"] if "rec_pg" in players.columns else 0.0
        players["prior_ppg"] = [scoring.adjust_anchor(p, r, args.format)
                                for p, r in zip(players["prior_ppg"], rec)]

    board = project(
        players=players,
        team_ctx=ds.load_team_context(),
        coord=ds.load_coordinator_scores(),
        qb_profiles=ds.load_qb_profiles(),
        roster_changes=ds.load_roster_changes(),
        adp=ds.load_adp(),
        cfg=cfg,
    )

    pd.set_option("display.width", 240, "display.max_columns", 40)
    fmt = args.format.upper()
    print(f"\n=== {fmt} POSITIONAL RANKINGS ===")
    cols = ["pos_rank", "player", "team", "qb", "proj_ppg", "proj_games",
            "proj_season", "floor", "ceiling", "adp", "value", "call"]
    cols = [c for c in cols if c in board.columns]
    for pos in ["QB", "RB", "WR", "TE"]:
        sub = board[board["pos"] == pos].sort_values("pos_rank")
        if sub.empty:
            continue
        print(f"\n--- {pos} ({fmt}) ---")
        print(sub[cols].to_string(index=False))

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    board.to_csv(args.out, index=False)
    print(f"\nWrote {len(board)} projections ({fmt}) to {args.out}")


if __name__ == "__main__":
    main()
