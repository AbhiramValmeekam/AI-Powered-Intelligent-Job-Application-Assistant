"""
Unified structured-feature extractor for JobShield AI.

Combines scam-indicator counts + URL features + email-metadata features into a
single ordered numeric vector. Also exposes the TF-IDF text pipeline builder.
The classical models train on hstack([TF-IDF, structured]) features.
"""
from __future__ import annotations

from typing import Dict, List

import numpy as np
import pandas as pd

from features.metadata_features import extract_metadata_features
from features.scam_indicators import SCAM_CATEGORIES, detect_indicators
from features.url_features import aggregate_url_features

# Deterministic feature ordering ------------------------------------------------
_SCAM_KEYS = [f"scam::{c}" for c in SCAM_CATEGORIES]
_URL_KEYS = [
    "url_is_ip", "url_shortened", "url_suspicious_tld", "url_no_https",
    "url_typosquat", "url_has_at", "url_num_dots", "url_len", "url_count",
]
_META_KEYS = [
    "meta_free_email", "meta_reply_to_mismatch", "meta_brand_domain_mismatch",
    "meta_has_sender", "meta_subdomain_depth", "meta_no_company_address",
]
STRUCTURED_FEATURE_NAMES: List[str] = _SCAM_KEYS + _URL_KEYS + _META_KEYS


def extract_structured_dict(
    text: str, sender: str = "", reply_to: str = "", url: str = ""
) -> Dict[str, float]:
    """Return the full structured feature dict for one record."""
    d: Dict[str, float] = {}
    scam = detect_indicators(text)
    for cat in SCAM_CATEGORIES:
        d[f"scam::{cat}"] = float(scam.get(cat, 0))
    for k, v in aggregate_url_features(text, explicit_url=url).items():
        d[k] = float(v)
    for k, v in extract_metadata_features(sender, reply_to, text).items():
        d[k] = float(v)
    return d


def extract_structured_vector(
    text: str, sender: str = "", reply_to: str = "", url: str = ""
) -> np.ndarray:
    """Ordered numeric vector matching STRUCTURED_FEATURE_NAMES."""
    d = extract_structured_dict(text, sender, reply_to, url)
    return np.array([d[name] for name in STRUCTURED_FEATURE_NAMES], dtype=np.float32)


def structured_matrix(df: pd.DataFrame) -> np.ndarray:
    """Build the structured feature matrix for a DataFrame.

    Expects columns: text, and optionally sender, reply_to, url.
    """
    sender = df["sender"] if "sender" in df else [""] * len(df)
    reply = df["reply_to"] if "reply_to" in df else [""] * len(df)
    url = df["url"] if "url" in df else [""] * len(df)
    rows = [
        extract_structured_vector(t, s, r, u)
        for t, s, r, u in zip(df["text"], sender, reply, url)
    ]
    return np.vstack(rows) if rows else np.zeros((0, len(STRUCTURED_FEATURE_NAMES)))
