"""ScamShieldEngine - scam-detection engine for CareerOS.

Exposes a single class, ``ScamShieldEngine``::

    from app.engines.scamshield import ScamShieldEngine
    engine = ScamShieldEngine()
    result = engine.analyze(text, url="https://...")

``result`` is a dict with keys: prediction ("scam"|"legit"|"suspicious"),
confidence (0-1), risk_score (0-100), reasons (list[str]),
highlighted_text (str|None), model ("best_model").
"""
from .engine import ScamShieldEngine

__all__ = ["ScamShieldEngine"]
