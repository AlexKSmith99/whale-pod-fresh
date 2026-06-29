# nfl_model — a dynamic, weighted NFL fantasy projection engine

A from-scratch projection model that fixes the core blind spot in typical
fantasy models (e.g. [mattgilgo/fantasy_football](https://github.com/mattgilgo/fantasy_football),
[VinGuar/Fantasy-Football-Rankings-With-ML](https://github.com/VinGuar/Fantasy-Football-Rankings-With-ML)):
those models project a player almost entirely from his **own past stats**. They
do not model how a player's *environment is changing* going into the new season.

This engine does. It anchors on prior production and then applies explicit,
**tunable, multiplicative modifiers** for the factors that actually move a
player's outlook year-to-year:

| Factor | What it captures |
|---|---|
| **Coordinator / scheme** | New OC quality + pass-lean shift (e.g. Ben Johnson arriving) |
| **Roster turnover** | Targets/carries *vacated* by departures or *added* by arrivals |
| **QB profile fit** | How the attached QB's style helps/hurts the position (Tua vs Malik Willis) |
| **Strength of schedule** | Position-specific opponent strength, weighted toward fantasy-playoff weeks |
| **Vegas** | Team implied scoring environment |
| **Age** | Position-specific age curve |

## The formula

For every player:

```
proj_ppg = anchor_ppg
         × M_oc × M_roster × M_qb × M_schedule × M_vegas × M_age
```

Each modifier has the identical, inspectable shape:

```
M = 1 + weight × signal
```

- `signal` — a normalized real-world quantity (≈ [-1, 1]) computed from data.
- `weight` — the **maximum fractional swing** that factor may apply. Every weight
  lives in [`config/weights.yaml`](config/weights.yaml), so sensitivities are
  defined once and stay consistent across all players. This is deliberately
  **not** a black box — you can read off exactly why a player moved.

## Quick start

```bash
pip install -r requirements.txt

# Runs anywhere on bundled sample data (2024 anchors -> 2025 projection):
python -m nflproj.project

# On a machine with network access, build anchors from real nflverse data:
python -m nflproj.project --live 2024

# Calibrate / back-test the weights (synthetic self-validation, runs offline):
python -m nflproj.calibrate
```

Output is a ranked board (written to `output/projections.csv`) with one column
per modifier so every projection is fully auditable:

```
 player            pos team  qb                 prior_ppg M_oc  M_roster M_qb  M_sched M_vegas M_age proj_ppg vor
 Ja'Marr Chase     WR  CIN   Joe Burrow         24.2      1.000 1.000    1.053 1.091   1.098   1.00  30.52    336.5
 De'Von Achane     RB  MIA   Tua Tagovailoa     18.2      1.000 1.000    1.146 1.061   1.016   1.00  22.50    167.2
 Josh Jacobs       RB  GB    Malik Willis       17.9      1.000 1.000    0.850 0.953   1.049   0.94  14.30     36.1
 Jonathan Taylor   RB  IND   Anthony Richardson 15.3      1.000 1.000    0.780 1.058   0.984   0.97  12.04      0.0
```

Note how the **QB-profile modifier** alone separates Achane (pass-catching back
+ checkdown-heavy Tua = **+14.6%**) from Jacobs (run-first, vulturing Willis =
**−15%**) and Taylor (Richardson = **−22%**) — exactly the dynamic that
opportunity-blind models miss.

## How each modifier works

### `M_qb` — QB profile fit (`modifiers.qb_modifier`)
Reads the attached QB's profile from [`data/qb_profiles.csv`](data/qb_profiles.csv)
— `pass_att_pg`, `adot` (air yards/att), `dumpoff_rate`, `rush_att_pg`,
`rush_td`, `sack_rate` — and measures each trait *relative to a league-average
QB*. Position-specific sub-weights (in `weights.yaml → qb_environment`) decide
how each position consumes those traits:
- **WR/TE** gain from pass volume & aDOT, lose to QB scrambling (drains pass plays).
- **RB** gain from dump-off rate (scaled by the back's own target share — a pure
  early-down rusher isn't helped by checkdowns), and **lose to QB rushing TDs**
  (scaled by the back's red-zone share — goal-line vulture effect).

### `M_oc` — coordinator / scheme change (`modifiers.coordinator_modifier`)
Compares the incoming vs prior OC using [`data/coordinator_scores.csv`](data/coordinator_scores.csv)
(`oc_score` 0–100, `pass_lean` −1…+1). Signal = quality delta + pass-lean shift
weighted by position sensitivity, minus a flat `transition_penalty` for the
Year-1 noise of any scheme change. No change → `1.0` (continuity).

### `M_roster` — vacated / added opportunity (`modifiers.roster_modifier`)
From [`data/roster_changes.csv`](data/roster_changes.csv): sums the target share
(WR/TE pool) or rush share (RB pool) **vacated** by departures minus that
**added** by arrivals, and applies the net proportional change to returning
players.

### `M_schedule` — strength of schedule (`modifiers.schedule_modifier`)
Position-specific opponent strength from `team_context.csv` (`sos_wr`, `sos_rb`,
…; 1.0 = average, >1 = faces generous defenses), blended with a fantasy-playoff
(Weeks 15–17) component controlled by `schedule.playoff_weight`.

### `M_vegas` — scoring environment (`modifiers.vegas_modifier`)
Team implied point total vs league average.

### `M_age` — age curve (`modifiers.age_modifier`)
Position-specific peak age & decline span (RBs cliff early, WRs peak later).

## Calibrating the weights (turning guesses into fitted numbers)

The weights start as expert priors. To make them empirical, `nflproj/backtest.py`
exploits the model's multiplicative form:

```
proj = anchor * prod_i (1 + w_i * signal_i)
=>  log(realized / anchor) ~= sum_i w_i * signal_i
```

So the optimal weights are just the coefficients of a no-intercept ridge
regression of the log production ratio on the per-modifier signals. `modifiers.py`
exposes each factor's raw `*_signal()` (separate from its weight) precisely so it
can serve as a regression feature.

`python -m nflproj.calibrate` runs a self-contained validation: it plants known
weights, generates synthetic player-seasons, fits the weights back, and scores a
held-out set. Typical output:

```
planted : oc=0.180  roster=0.250  qb=0.220  schedule=0.100  vegas=0.150  age=0.120
fitted  : oc=0.173  roster=0.247  qb=0.219  schedule=0.110  vegas=0.154  age=0.115

naive       MAE= 2.790  RMSE= 3.876  spearman=0.768   (last-year-points baseline)
calibrated  MAE= 1.282  RMSE= 1.884  spearman=0.962   (fitted weights)
oracle      MAE= 1.271  RMSE= 1.871  spearman=0.962   (planted weights)
```

The calibrator recovers the planted weights and nearly matches the oracle,
confirming the machinery. `--write` saves the fitted set to
`config/weights.calibrated.yaml`.

**To calibrate on real data:** build historical per-season `(anchor, signals,
realized)` frames — anchors and realized PPG from `nfl_data_py`, signals via
`backtest.compute_signal_frame()` using *historical* knowledge tables (the OC /
QB / roster context as it was that offseason) — then call
`backtest.calibrate_weights()`. Assembling those historical tables is the main
remaining data-collection task.

## Data layout

```
config/weights.yaml         every tunable weight, in one place
data/
  coordinator_scores.csv    curated OC quality + scheme scores  (Ben Johnson = 95)
  qb_profiles.csv           per-QB style metrics                (Tua vs Willis)
  team_context.csv          OC change, Vegas totals, SoS per position
  roster_changes.csv        departures/arrivals with prior shares
  sample_players.csv        prior-year anchors + opportunity shares (runs offline)
nflproj/
  config.py                 loads weights.yaml
  data_sources.py           knowledge tables + live nfl_data_py anchor builder
  modifiers.py              the six modifier functions
  engine.py                 anchor x modifiers -> ranked board + VOR
  project.py                CLI entrypoint
tests/test_engine.py        directional regression guards
```

## Going live with real data

`data_sources.build_player_table_live(prior_season)` uses `nfl_data_py` to build
the anchor table (prior-year fantasy PPG + target/rush/air-yard shares + each
team's primary QB) directly from nflverse. `load_players(..., live=True)` falls
back to the bundled sample if the network is unavailable, so the pipeline runs
everywhere. The hand-curated tables (`coordinator_scores`, `qb_profiles`,
`team_context`, `roster_changes`) are where your football judgment + offseason
news live; update them each offseason.

## Roadmap / honest caveats

This is **v0.1** — a transparent skeleton, not a finished product:

- **Calibration harness exists; real-data fit pending.** The ridge back-test
  (`nflproj/calibrate.py`) is built and self-validated on synthetic data. The
  remaining work is assembling *historical* knowledge tables so the weights can
  be fit on real seasons rather than expert priors.
- **OC & QB tables are partly subjective** and small-sample; coordinator effects
  are easy to overfit (only ~32 offenses/yr). Ground the scores in measurable
  history (PROE, points/drive, fantasy points generated per position).
- **No rookie path yet** — players need a prior-year anchor; rookies need a
  draft-capital / college-projection anchor.
- **`rz_share` from live data is approximated**; a true red-zone share needs
  play-by-play (available in `nfl_data_py.import_pbp_data`).
- **Point estimates only** — a future version should output floor/ceiling
  distributions and convert to value-vs-ADP, since busts/values are where leagues
  are won.
```
