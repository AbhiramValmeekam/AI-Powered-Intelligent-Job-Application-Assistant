"""
ScamShieldEngine - clean, importable scam-detection engine for CareerOS.

Ports JobShieldAI's trained ML model into the CareerOS backend. It loads the
*original* trained artifacts (best_model + feature_pipeline + label_encoder)
directly from ``C:\\Users\\ABHIRAM\\JobShieldAI\\saved_models`` (no copies -> no
drift) and reuses the reference project's feature builders / rule engine via
``sys.path`` insertion (see ``.features``).

Public API
----------
    from app.engines.scamshield import ScamShieldEngine

    engine = ScamShieldEngine()                      # models loaded lazily
    result = engine.analyze(text, url="https://...") # -> dict

Returned dict keys
------------------
    prediction     : "scam" | "legit" | "suspicious"
    confidence     : float, 0-1  (model class probability / band confidence)
    risk_score     : int, 0-100
    reasons        : list[str]   (human-readable red flags)
    highlighted_text: str|None   (HTML with <mark> on scam phrases / URLs)
    model          : "best_model" (always, since we load best_model.joblib)

The engine is resilient: model loading is wrapped in try/except and raises a
clear ``RuntimeError`` with remediation steps if the artifacts are missing or
incompatible.
"""
from __future__ import annotations

import joblib
import numpy as np
import pandas as pd
from pathlib import Path

from . import features as js  # reference-project bridge (sys.path injected)

# --- Configuration -----------------------------------------------------------
# --- Configuration ----------------------------------------------------------- # Load trained artifacts. We search a list of candidate directories (in order)
# so the engine works both locally (JobShieldAI project) and in deployment
# (Render: JOBSHIELD_MODEL_DIR -> /app/backend/models, which is committed into
# the repo at backend/models/). Falling back across several locations makes the
# deploy robust to env-path drift.
import os as _os

def _candidate_model_dirs() -> list[str]:
    cands: list[str] = []
    env = _os.environ.get("JOBSHIELD_MODEL_DIR")
    if env:
        cands.append(env)
    # Deployed location (rootDir=backend -> /app/backend/models).
    cands.append("/app/backend/models")
    # Repo-relative location (backend/models) resolved from this file.
    here = _os.path.dirname(_os.path.abspath(__file__))
    cands.append(_os.path.join(here, "..", "..", "models"))  # backend/models
    cands.append(_os.path.join(here, "models"))              # scamshield/models
    # Local dev fallback.
    cands.append(r"C:\Users\ABHIRAM\JobShieldAI\saved_models")
    # de-dup, keep order
    seen, out = set(), []
    for c in cands:
        rc = _os.path.normpath(c)
        if rc not in seen:
            seen.add(rc)
            out.append(rc)
    return out

MODEL_DIR_CANDIDATES = _candidate_model_dirs()

# Canonical 3-class labels used by the trained model + label encoder.
_LABEL_CLASSES = ("Fraudulent", "Legitimate", "Suspicious")

# Map the model's 3-class labels onto the simpler CareerOS vocab.
_LABEL_TO_VERDICT = {
    "Fraudulent": "scam",
    "Legitimate": "legit",
    "Suspicious": "suspicious",
}

# Ensemble weights (from JobShieldAI config; components auto-renormalised over
# whatever is available). The ML best_model is included when present.
_ENSEMBLE_WEIGHTS = {
    "best_model": 0.40,
    "svm": 0.20,
    "xgboost": 0.20,
    "rule_engine": 0.10,
    "metadata": 0.10,
}


class ScamShieldEngine:
    """Detect scam / fraudulent job offers, internships and recruitment emails."""

    def __init__(self, model_dir: str | None = None):
        # If a specific dir is given, use only it; otherwise search candidates.
        self.model_dir = model_dir
        self._artifacts = None  # lazily loaded + cached

    # ------------------------------------------------------------------ #
    # Artifact loading (resilient)
    # ------------------------------------------------------------------ #
    def _resolve_dir(self) -> str:
        """Return the first candidate dir that has all required artifacts."""
        if self.model_dir:
            return self.model_dir
        required = [
            "feature_pipeline.joblib",
            "label_encoder.joblib",
            "best_model.joblib",
        ]
        for d in MODEL_DIR_CANDIDATES:
            if all(_exists(d, n) for n in required):
                return d
        # None matched — return the preferred (env or first) for the error msg.
        return MODEL_DIR_CANDIDATES[0]

    def _load(self) -> dict:
        if self._artifacts is not None:
            return self._artifacts
        d = self._resolve_dir()
        required = [
            "feature_pipeline.joblib",
            "label_encoder.joblib",
            "best_model.joblib",
        ]
        missing = [n for n in required if not _exists(d, n)]
        if missing:
            # Report what IS present in each candidate dir to aid diagnosis.
            found_report = []
            for cd in MODEL_DIR_CANDIDATES:
                try:
                    present = [f for f in _os.listdir(cd) if f.endswith(".joblib")]
                except Exception:
                    present = ["<unreadable>"]
                found_report.append(f"'{cd}' -> {present}")
            raise RuntimeError(
                "ScamShieldEngine: required model artifacts are missing from "
                f"'{d}': {missing}. Searched candidates:\n"
                + "\n".join(found_report)
                + "\nRestore the trained .joblib artifacts (feature_pipeline, "
                "label_encoder, best_model) to one of these directories."
            )

        try:
            pipe = joblib.load(_join(d, "feature_pipeline.joblib"))
            le = joblib.load(_join(d, "label_encoder.joblib"))
            best = joblib.load(_join(d, "best_model.joblib"))
        except Exception as e:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "ScamShieldEngine: failed to load model artifacts from "
                f"'{d}': {type(e).__name__}: {e}. "
                "Ensure scikit-learn, lightgbm and joblib are installed and "
                "that the JobShieldAI reference project is importable (its "
                "features/ and training/ packages are reused via sys.path)."
            ) from e

        # Optional secondary models (improve ensemble, but not required).
        svm = _try_load(d, "model_linear_svm.joblib")
        xgb = _try_load(d, "model_xgboost.joblib")

        # Validate label encoder classes.
        try:
            classes = [str(c) for c in le.classes_]
            if not set(_LABEL_CLASSES).issubset(set(classes)):
                raise RuntimeError(
                    "ScamShieldEngine: label_encoder classes "
                    f"{classes} do not match expected {_LABEL_CLASSES}."
                )
        except AttributeError as e:
            raise RuntimeError(
                "ScamShieldEngine: label_encoder artifact is not a fitted "
                f"LabelEncoder: {e}"
            ) from e

        self._artifacts = {
            "pipe": pipe,
            "le": le,
            "best": best,
            "svm": svm,
            "xgb": xgb,
        }
        return self._artifacts

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def analyze(
        self,
        text: str,
        url: str | None = None,
        sender: str = "",
        reply_to: str = "",
        *,
        with_reputation: bool = False,
        with_highlights: bool = True,
    ) -> dict:
        """Analyse a job offer / email / message.

        Parameters
        ----------
        text : str
            The message / job description / offer body.
        url : str | None
            An explicit URL associated with the offer (link, careers page, ...).
        sender, reply_to : str
            Email metadata (used by the rule + metadata feature layers).
        with_reputation : bool
            Run the (offline-by-default) company reputation check and fold its
            signals into ``reasons``.
        with_highlights : bool
            Build an HTML ``highlighted_text`` marking detected scam phrases.

        Returns
        -------
        dict with keys: prediction, confidence, risk_score, reasons,
        highlighted_text, model.
        """
        art = self._load()
        le = art["le"]
        text = text if isinstance(text, str) else ""
        url = url if isinstance(url, str) else ""
        sender = sender if isinstance(sender, str) else ""
        reply_to = reply_to if isinstance(reply_to, str) else ""

        # ---- feature transform (same pipeline as training) ----
        df = pd.DataFrame(
            [{"text": text, "sender": sender, "reply_to": reply_to, "url": url}]
        )
        X = art["pipe"].transform(df)

        # ---- component fraud-axis scores (P(fraud) on a single 0-1 axis) ----
        comp: dict[str, float] = {}

        p_best = _proba(art["best"], X)
        comp["best_model"] = _fraud_axis(p_best, le) if p_best is not None else 0.0

        p_xgb = _proba(art["xgb"], X)
        if p_xgb is not None:
            comp["xgboost"] = _fraud_axis(p_xgb, le)

        p_svm = _proba(art["svm"], X)
        if p_svm is not None:
            comp["svm"] = _fraud_axis(p_svm, le)

        rule_res = js.evaluate_rules(text, sender, reply_to, url)
        comp["rule_engine"] = float(rule_res.probability)

        meta = js.extract_metadata_features(sender, reply_to, text)
        meta_signals = [
            "meta_free_email",
            "meta_reply_to_mismatch",
            "meta_brand_domain_mismatch",
            "meta_no_company_address",
        ]
        meta_score = min(1.0, sum(meta[k] for k in meta_signals) / 3.0)
        comp["metadata"] = float(meta_score)

        # ---- weighted ensemble over available components ----
        avail = {k: v for k, v in comp.items() if k in _ENSEMBLE_WEIGHTS}
        wsum = sum(_ENSEMBLE_WEIGHTS[k] for k in avail) or 1.0
        fraud_axis = sum(avail[k] * _ENSEMBLE_WEIGHTS[k] for k in avail) / wsum
        risk_score = int(round(max(0.0, min(1.0, fraud_axis)) * 100))

        # ---- class prediction (blend ML class proba + rule signal) ----
        base_proba = p_best if p_best is not None else np.array([1 / 3, 1 / 3, 1 / 3])
        proba = np.array(base_proba, dtype=float).copy()
        idx_fraud = _class_index(le, "Fraudulent")
        idx_susp = _class_index(le, "Suspicious")
        proba[idx_fraud] += 0.5 * rule_res.probability
        proba[idx_susp] += 0.2 * rule_res.probability
        proba = proba / proba.sum()
        pred_idx = int(np.argmax(proba))
        pred_label = str(le.classes_[pred_idx])

        # Reconcile the label with the risk band so they always agree.
        band = js.risk_band(risk_score)["band"]
        band_to_label = {
            "Safe": "Legitimate",
            "Low Risk": "Legitimate",
            "Suspicious": "Suspicious",
            "Fraudulent": "Fraudulent",
        }
        pred_label = band_to_label.get(band, pred_label)

        # Confidence: how firmly the risk score sits inside its band.
        if pred_label == "Fraudulent":
            confidence = round(risk_score, 1)
        elif pred_label == "Legitimate":
            confidence = round(100 - risk_score, 1)
        else:  # Suspicious band spans 51-75, centre ~63
            confidence = round(100 - abs(risk_score - 63) * (100 / 37), 1)
        confidence = max(0.0, min(100.0, confidence)) / 100.0  # -> 0-1

        # ---- reasons ----
        reasons = list(dict.fromkeys(list(rule_res.reasons) + js.matched_reasons(text)))
        if not reasons and pred_label == "Legitimate":
            reasons = [
                "No fraud indicators detected",
                "Sender/domain consistent",
                "Standard interview process described",
            ]

        if with_reputation and (url or sender):
            rep = js.check_reputation(url or sender)
            for s in rep.signals:
                if s not in reasons:
                    reasons.append(s)

        result = {
            "prediction": _LABEL_TO_VERDICT.get(pred_label, "suspicious"),
            "confidence": round(float(confidence), 4),
            "risk_score": risk_score,
            "reasons": reasons[:10],
            "highlighted_text": js.highlight_text(text) if with_highlights else None,
            "model": "best_model",
        }
        return result

    # Convenience alias mirroring the requested function signature.
    def __call__(self, text: str, url: str | None = None, **kw) -> dict:
        return self.analyze(text, url=url, **kw)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _exists(d: str, name: str) -> bool:
    try:
        return Path(d).joinpath(name).exists()
    except Exception:
        return False


def _join(d: str, name: str) -> str:
    return str(Path(d).joinpath(name))


def _try_load(d: str, name: str):
    if not _exists(d, name):
        return None
    try:
        return joblib.load(_join(d, name))
    except Exception:
        return None


def _class_index(le, name: str) -> int:
    return int(np.where([str(c) == name for c in le.classes_])[0][0])


def _fraud_axis(proba: np.ndarray, le) -> float:
    """Map 3-class proba onto a single 0-1 fraud-risk scalar.

    P(Suspicious)*0.5 + P(Fraudulent)*1.0 (from JobShieldAI ensemble.py).
    """
    idx_susp = _class_index(le, "Suspicious")
    idx_fraud = _class_index(le, "Fraudulent")
    return float(proba[idx_susp] * 0.5 + proba[idx_fraud] * 1.0)


def _proba(model, X):
    if model is None:
        return None
    if hasattr(model, "predict_proba"):
        try:
            # Silence sklearn's "X does not have valid feature names" warning
            # (the pipeline already produced the correct numeric features).
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                return model.predict_proba(X)[0]
        except Exception:
            return None
    return None
