"""
ScamShield feature bridge.

Rather than duplicate JobShieldAI's feature logic (and risk drift), this module
re-imports the *original* feature builders, rule engine and the fitted
``FeaturePipeline`` from the reference project at
``C:\\Users\\ABHIRAM\\JobShieldAI`` via ``sys.path`` insertion.

The original project exposes everything we need:
  * training.feature_pipeline.FeaturePipeline  -> fitted TF-IDF + structured scaler
  * features.*                                 -> scam indicators / url / metadata
  * rules.rule_engine.evaluate                 -> deterministic rule layer
  * utils.*                                    -> config + risk_band

We deliberately do NOT copy any trained artifact here; only code is reused.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, List, Tuple

# --- Reference project (read-only). Inserted first so its packages win. -------
JOBSHIELD_ROOT = r"C:\Users\ABHIRAM\JobShieldAI"
if JOBSHIELD_ROOT not in sys.path:
    sys.path.insert(0, JOBSHIELD_ROOT)

# Fitted feature pipeline (TF-IDF text + scaled structured features).
from training.feature_pipeline import FeaturePipeline  # noqa: E402,F401

# Scam-indicator lexicon + detectors.
from features import (  # noqa: E402,F401
    STRUCTURED_FEATURE_NAMES,
    matched_reasons,
)
from features.build_features import (  # noqa: E402,F401
    extract_structured_dict,
    extract_structured_vector,
)
from features.scam_indicators import (  # noqa: E402,F401
    SCAM_CATEGORIES,
    SCAM_INDICATORS,
    detect_indicators,
)
from features.url_features import (  # noqa: E402,F401
    aggregate_url_features,
    analyze_url,
)
from features.metadata_features import extract_metadata_features  # noqa: E402,F401

# Deterministic rule engine (independent of the ML model).
from rules.rule_engine import evaluate as evaluate_rules  # noqa: E402,F401

# Config + risk-band mapping (kept in sync with the reference project).
from utils import abspath, load_config, risk_band  # noqa: E402,F401

# Optional company-reputation layer (offline heuristics by default).
from utils.reputation import check_reputation  # noqa: E402,F401


def find_scam_spans(text: str) -> List[Tuple[int, int, str]]:
    """Return (start, end, category) spans for scam phrases found in ``text``.

    Used to build ``highlighted_text``. Bounded to short, human-readable spans.
    """
    import re

    spans: List[Tuple[int, int, str]] = []
    seen = set()
    text = text if isinstance(text, str) else ""
    for category, patterns in SCAM_INDICATORS.items():
        for pat in patterns:
            try:
                for m in re.finditer(pat, text, re.I):
                    s, e = m.span()
                    if (s, e) not in seen and e > s:
                        seen.add((s, e))
                        spans.append((s, e, category))
            except re.error:
                continue
    spans.sort()
    return spans


def highlight_text(text: str) -> str:
    """Wrap detected scam phrases and URLs in <mark> tags for UI display."""
    import re

    text = text if isinstance(text, str) else ""
    spans = find_scam_spans(text)
    # Also flag bare URLs.
    for m in re.finditer(r"https?://\S+|www\.\S+", text, re.I):
        s, e = m.span()
        spans.append((s, e, "url"))
    spans.sort()

    # Merge overlapping spans, build output.
    out = []
    last = 0
    for s, e, cat in spans:
        if s < last:  # overlap -> skip inner
            continue
        out.append(_escape(text[last:s]))
        out.append(f'<mark class="scam" data-cat="{cat}">{_escape(text[s:e])}</mark>')
        last = e
    out.append(_escape(text[last:]))
    return "".join(out)


def _escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
