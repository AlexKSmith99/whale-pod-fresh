# Runbook — projecting the 2026 season on your machine

This walks the full workflow end-to-end. It assumes a machine with **outbound
internet** (the cloud sandbox this was built in blocks the nflverse data host, so
`--live` only works locally).

---

## 0. Setup

```bash
cd nfl_model
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Sanity check (offline, uses bundled sample data):

```bash
python -m nflproj.project          # prints the projection board
python -m nflproj.calibrate        # synthetic calibration self-test
```

---

## 1. Update the knowledge tables for the 2026 offseason

These are the curated, judgment-driven inputs — refresh them each offseason.
All live in `data/`:

| File | Update with |
|---|---|
| `team_context.csv` | Each team's 2026 OC + the 2025 OC (`prev_oc_name`), Vegas implied team total (from a sportsbook win-total / over-under), and position strength-of-schedule. |
| `coordinator_scores.csv` | Any new coordinators; score 0–100 + pass-lean. |
| `qb_profiles.csv` | Each team's projected 2026 starter and their style metrics. |
| `roster_changes.csv` | Free-agency / trade / draft arrivals & departures, with the player's prior target/rush share. |
| `rookies.csv` | The 2026 draft class: pick number + projected role shares. |
| `adp.csv` | Current best-ball / redraft ADP. |

Tip: `data/team_context.csv` and `qb_profiles.csv` shipped fully populated for
2025 — use them as the template and edit in place.

---

## 2. Project with live veteran anchors

`--live 2025` builds each returning player's anchor (2025 production + opportunity
shares + age + team QB) straight from nflverse; rookies come from `rookies.csv`:

```bash
python -m nflproj.project --live 2025 --out output/proj_2026.csv
```

Output columns: per-modifier multipliers (`M_oc`, `M_roster`, `M_qb`, …),
`proj_ppg`, `proj_games` (availability), `proj_season`, `floor`/`ceiling`,
`pos_rank`, `vor`, and `value`/`call` vs ADP.

---

## 3. (Recommended) Calibrate the weights on real history

Out of the box the weights are expert priors. To fit them to reality, populate
`data/history/` for a few past seasons (see `data/history/README.md`) — the OC /
QB / roster / Vegas / SoS context **as it was entering** each season — then:

```bash
python -m nflproj.calibrate --live 2022,2023,2024,2025          # fit + back-test
python -m nflproj.calibrate --live 2022,2023,2024,2025 --write  # save weights
```

This writes `config/weights.calibrated.yaml`. To project with it, point the
config loader at that file (or copy it over `weights.yaml`). The back-test prints
MAE / RMSE / Spearman vs a last-year-points baseline so you can confirm the
modifiers add lift before trusting them.

---

## 4. Read the board

- **Draft by `vor`** (value over replacement), not raw points — it's positional.
- **`value` / `call`** flags where you disagree with the market (`VALUE` = the
  model ranks a player ahead of his ADP; `FADE` = behind).
- **`floor` / `ceiling`** is your risk read: tight band = safe floor pick; wide
  band (rookies, scheme changes, injury risk) = upside swing.
- **`proj_games`** shows the availability haircut baked into the season total.

---

## Workflow at a glance

```
update data/*.csv  ->  --live 2025 anchors  ->  modifiers  ->  availability  ->
floor/ceiling  ->  VOR + value vs ADP  ->  output/proj_2026.csv
        ^                                                              |
        +----------- calibrate weights on data/history/ --------------+
```
