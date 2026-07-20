"""Shared utilities: config loading, risk scoring, logging."""
from __future__ import annotations

import functools
import os
from pathlib import Path
from typing import Any, Dict

import yaml

# Project root = directory containing the top-level package (this file's grandparent)
ROOT = Path(__file__).resolve().parent.parent


@functools.lru_cache(maxsize=1)
def load_config(path: str | None = None) -> Dict[str, Any]:
    """Load and cache the central YAML configuration."""
    cfg_path = Path(path) if path else ROOT / "config" / "config.yaml"
    with open(cfg_path, "r", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    return cfg


def abspath(rel: str) -> Path:
    """Resolve a config-relative path against the project root."""
    p = Path(rel)
    return p if p.is_absolute() else ROOT / p


def risk_band(score: float) -> Dict[str, Any]:
    """Map a 0-100 risk score to its band + color."""
    cfg = load_config()
    score = max(0, min(100, float(score)))
    for lvl in cfg["risk_levels"]:
        if lvl["min"] <= score <= lvl["max"]:
            return {"band": lvl["band"], "color": lvl["color"]}
    return {"band": "Unknown", "color": "#95a5a6"}


def ensure_dirs() -> None:
    cfg = load_config()
    for key in ("saved_models_dir", "reports_dir", "datasets_dir"):
        abspath(cfg["paths"][key]).mkdir(parents=True, exist_ok=True)
