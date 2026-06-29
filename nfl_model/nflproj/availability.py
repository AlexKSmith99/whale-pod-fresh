"""Availability / durability model.

A fixed 16-game assumption flatters fragile and aging players. This estimates
each player's projected games from three signals:

  * position injury rate   — RBs miss more than QBs/WRs
  * age                    — durability declines past a position threshold
  * recent durability      — games played last year as a personal risk signal

It returns both a projected game count (multiplies the season total) and an
injury-risk score (widens the floor more than the ceiling — injuries are
downside). Rookies have no NFL durability history, so they fall back to the
position baseline.
"""
from __future__ import annotations


def availability_rate(player, cfg: dict) -> tuple[float, float]:
    """Return (rate, risk): fraction of the season played, and an injury-risk score.

    rate in [min_rate, ~0.97]; risk in [0, ~0.5] (0 = ironman, higher = fragile).
    """
    a = cfg["availability"]
    pos = player["pos"]
    full = a["full_season"]
    rate = a["base_rate"].get(pos, 0.88)

    # Age decline past the position threshold.
    threshold = a["age_threshold"].get(pos, 30)
    age = player.get("age", 26)
    if age > threshold:
        rate -= a["age_slope"] * (age - threshold)

    # Recent durability: games played last year vs a full slate. Rookies (no
    # history) and players with the full slate contribute no extra risk.
    is_rookie = bool(player.get("is_rookie", False))
    prior_games = player.get("games", full)
    if not is_rookie and prior_games is not None and prior_games < full:
        missed_frac = (full - prior_games) / full
        rate -= a["durability_weight"] * missed_frac

    rate = max(a["min_rate"], min(0.97, rate))
    risk = (0.93 - rate)  # how far below an ironman baseline this player sits
    return round(rate, 3), round(max(0.0, risk), 3)


def projected_games(player, cfg: dict) -> float:
    rate, _ = availability_rate(player, cfg)
    return round(cfg["availability"]["full_season"] * rate, 1)
