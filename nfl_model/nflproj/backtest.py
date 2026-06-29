"""Back-testing and weight calibration.

The projection is multiplicative:

    proj_ppg = anchor * prod_i (1 + w_i * signal_i)

Taking logs and using log(1+x) ~= x for small x:

    log(realized / anchor) ~= sum_i w_i * signal_i

so the weights `w_i` are just the coefficients of a (no-intercept) linear
regression of the log production ratio on the per-modifier signals. That makes
calibration a one-line ridge fit instead of a guess — and back-testing it
against held-out seasons tells us whether the modifiers actually beat a naive
"last year's points" baseline.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from .modifiers import SIGNAL_NAMES, compute_signals


# --- Build the signal feature frame -----------------------------------------
def compute_signal_frame(players, team_ctx, coord, qb_profiles, roster_changes, cfg) -> pd.DataFrame:
    """One row per player: the six raw signals + anchor + the OC-change flag."""
    rows = []
    for _, p in players.iterrows():
        s = compute_signals(p, team_ctx, coord, qb_profiles, roster_changes, cfg)
        s.update(player=p["player"], pos=p["pos"], anchor=p["prior_ppg"])
        rows.append(s)
    return pd.DataFrame(rows)


# --- Apply a weight set ------------------------------------------------------
def predict_from_weights(frame: pd.DataFrame, weights: dict, cfg: dict) -> pd.Series:
    """Replicate the engine's multiplier product for an arbitrary weight set."""
    penalty = cfg["coordinator"]["transition_penalty"]
    mult = pd.Series(1.0, index=frame.index)
    for name in SIGNAL_NAMES:
        w = weights.get(name, 0.0)
        m = 1.0 + w * frame[name]
        if name == "oc":  # flat transition penalty only when the OC changed
            m = m - penalty * frame["oc_changed"].astype(float)
        mult *= m
    return frame["anchor"] * mult


# --- Fit weights -------------------------------------------------------------
def calibrate_weights(frame: pd.DataFrame, realized: pd.Series, cfg: dict,
                      alpha: float = 1.0, non_negative: bool = True) -> dict:
    """Ridge-fit the six weights to historical realized PPG."""
    penalty = cfg["coordinator"]["transition_penalty"]
    y = np.log(realized.to_numpy() / frame["anchor"].to_numpy())
    # Move the known, fixed OC transition penalty to the LHS so it doesn't
    # distort the fitted weights.
    y = y + penalty * frame["oc_changed"].astype(float).to_numpy()
    X = frame[SIGNAL_NAMES].to_numpy()
    model = Ridge(alpha=alpha, fit_intercept=False, positive=non_negative)
    model.fit(X, y)
    return {name: round(float(c), 4) for name, c in zip(SIGNAL_NAMES, model.coef_)}


# --- Scoring -----------------------------------------------------------------
def evaluate(pred: pd.Series, realized: pd.Series) -> dict:
    err = pred.to_numpy() - realized.to_numpy()
    return {
        "MAE": round(float(np.mean(np.abs(err))), 3),
        "RMSE": round(float(np.sqrt(np.mean(err ** 2))), 3),
        "spearman": round(float(pd.Series(pred.to_numpy()).corr(
            pd.Series(realized.to_numpy()), method="spearman")), 3),
    }


# --- Synthetic history (lets the harness run + self-validate offline) --------
def make_synthetic(n: int, true_weights: dict, noise_sd: float = 0.12, seed: int = 0):
    """Generate (signal_frame, realized) from known weights.

    Used to prove the calibrator recovers planted weights and that calibrated
    predictions beat the anchor-only baseline. On a networked machine, replace
    this with real per-season (anchor, signals, realized) built from nflverse.
    """
    rng = np.random.default_rng(seed)
    anchor = np.exp(rng.normal(np.log(12), 0.4, n))          # ~12 PPG, lognormal
    signals = {name: rng.uniform(-1, 1, n) for name in SIGNAL_NAMES}
    frame = pd.DataFrame(signals)
    frame["anchor"] = anchor
    frame["oc_changed"] = False
    frame["player"] = [f"P{i}" for i in range(n)]
    frame["pos"] = "WR"

    log_mult = sum(true_weights[name] * frame[name] for name in SIGNAL_NAMES)
    noise = rng.normal(0, noise_sd, n)
    realized = pd.Series(anchor * np.exp(log_mult + noise), index=frame.index)
    return frame, realized


def run_demo(seed: int = 0) -> dict:
    """Self-contained demo: plant weights -> fit -> show recovery + lift."""
    from .config import load_config
    cfg = load_config()

    true_w = {"oc": 0.18, "roster": 0.25, "qb": 0.22,
              "schedule": 0.10, "vegas": 0.15, "age": 0.12}

    train_frame, train_real = make_synthetic(800, true_w, seed=seed)
    test_frame, test_real = make_synthetic(400, true_w, seed=seed + 1)

    fitted = calibrate_weights(train_frame, train_real, cfg, alpha=1.0)

    naive_pred = test_frame["anchor"]                              # last-year baseline
    cal_pred = predict_from_weights(test_frame, fitted, cfg)       # calibrated model
    true_pred = predict_from_weights(test_frame, true_w, cfg)      # oracle (planted)

    return {
        "true_weights": true_w,
        "fitted_weights": fitted,
        "naive": evaluate(naive_pred, test_real),
        "calibrated": evaluate(cal_pred, test_real),
        "oracle": evaluate(true_pred, test_real),
    }
