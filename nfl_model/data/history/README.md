# Historical knowledge tables (for real-data calibration)

To calibrate the weights on actual past seasons, the engine needs the modifier
inputs **as they looked entering each historical season** — because that's the
information a projection would have had at draft time.

Drop season-stamped copies of any knowledge table here and they override the
global `data/*.csv` for that season:

```
data/history/team_context_2024.csv        # OC change, Vegas total, SoS entering 2024
data/history/roster_changes_2024.csv      # departures/arrivals before 2024
data/history/qb_profiles_2024.csv         # (optional) QB profiles as of 2024
data/history/coordinator_scores_2024.csv  # (optional) OC scores as of 2024
```

Each file uses the **same schema** as its global counterpart in `data/`. If a
season file is missing, `history.load_season_context()` falls back to the global
table, so you can start with just `team_context_<year>.csv` and
`roster_changes_<year>.csv` (the two that change most year to year) and refine
later.

Anchors (prior-year production + shares) and realized PPG are pulled
automatically from nflverse via `nfl_data_py` — you only curate the tables here.

## Run it

```bash
# Fit on 2022-2023, evaluate held-out 2024:
python -m nflproj.calibrate --live 2022,2023,2024

# Then write the fitted weights:
python -m nflproj.calibrate --live 2022,2023,2024 --write
```

The included `*_2024.csv` files are **partial templates** (a few teams +
`League_Average`). Complete all 32 teams for a clean back-test.
