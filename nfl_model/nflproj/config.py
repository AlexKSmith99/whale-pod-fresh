"""Configuration loading.

All tunable weights live in config/weights.yaml so the formula's sensitivities
are defined in exactly one place and stay consistent across every player.
"""
from __future__ import annotations

import os
from functools import lru_cache

import yaml

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(_ROOT, "config", "weights.yaml")
DATA_DIR = os.path.join(_ROOT, "data")
OUTPUT_DIR = os.path.join(_ROOT, "output")


@lru_cache(maxsize=1)
def load_config(path: str | None = None) -> dict:
    """Load and cache the master weight config."""
    with open(path or CONFIG_PATH, "r") as fh:
        return yaml.safe_load(fh)
