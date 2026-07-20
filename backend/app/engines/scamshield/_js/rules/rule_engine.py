"""
Cybersecurity rule engine for JobShield AI.

A transparent, deterministic layer that runs independently of the ML models.
Each rule contributes a weighted risk contribution and a human-readable reason.
Returns a normalized 0-1 fraud probability plus the fired reasons, which feed
both the ensemble and the explainability output.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Dict, List

from features.metadata_features import extract_metadata_features
from features.scam_indicators import detect_indicators
from features.url_features import aggregate_url_features


@dataclass
class Rule:
    name: str
    weight: float          # contribution to risk when fired (0-1 scale)
    reason: str
    test: Callable[[dict], bool]


def _has(ctx: dict, key: str) -> bool:
    return ctx.get(key, 0) and ctx[key] > 0


# ---------------------------------------------------------------------------
# Rule definitions
# ---------------------------------------------------------------------------
def _build_rules() -> List[Rule]:
    R: List[Rule] = []

    def scam(cat, weight, reason):
        R.append(Rule(cat, weight, reason,
                      lambda ctx, c=cat: ctx["scam"].get(c, 0) > 0))

    scam("Requested payment / fee", 0.30, "Requests an upfront payment or fee")
    scam("Pay-to-work / fee-before-offer", 0.32,
         "Pay-to-work pattern: fee/deposit or performance-based stipend before a real offer")
    scam("Fill-form / data-harvest before offer", 0.12,
         "Asks you to fill a form (data harvest) before any verified offer")
    scam("Personal banking / financial request", 0.25,
         "Asks for personal banking/financial details")
    scam("OTP request", 0.25, "Requests an OTP / verification code")
    scam("Aadhaar / PAN misuse", 0.20, "Requests Aadhaar/PAN identity documents")
    scam("Password request", 0.25, "Requests a password or login credentials")
    scam("Telegram / WhatsApp-only recruitment", 0.15,
         "Recruitment conducted only via WhatsApp/Telegram")
    scam("Crypto / gift-card payment", 0.25, "Asks for crypto or gift-card payment")
    scam("Unrealistic salary", 0.15, "Advertises unrealistic salary/earnings")
    scam("No interview process", 0.15, "Offers a job with no real interview process")
    scam("Urgent / pressure language", 0.10, "Uses urgency/pressure tactics")
    scam("Too-good-to-be-true selection", 0.10,
         "Claims instant selection without applying")
    scam("Free email / unofficial domain", 0.08,
         "Uses a free/personal email instead of an official company domain")

    # Metadata rules
    R.append(Rule("free_email", 0.10, "Sent from a free email provider (not a company domain)",
                  lambda ctx: _has(ctx["meta"], "meta_free_email")))
    R.append(Rule("reply_to_mismatch", 0.15, "Reply-To domain differs from sender domain",
                  lambda ctx: _has(ctx["meta"], "meta_reply_to_mismatch")))
    R.append(Rule("brand_mismatch", 0.15, "Claims a known brand but uses an unrelated email domain",
                  lambda ctx: _has(ctx["meta"], "meta_brand_domain_mismatch")))
    R.append(Rule("no_address", 0.05, "No verifiable company address provided",
                  lambda ctx: _has(ctx["meta"], "meta_no_company_address")))

    # URL rules
    R.append(Rule("ip_url", 0.20, "Contains an IP-address-based URL",
                  lambda ctx: _has(ctx["url"], "url_is_ip")))
    R.append(Rule("short_url", 0.10, "Contains a shortened URL",
                  lambda ctx: _has(ctx["url"], "url_shortened")))
    R.append(Rule("susp_tld", 0.10, "Links use a suspicious top-level domain",
                  lambda ctx: _has(ctx["url"], "url_suspicious_tld")))
    R.append(Rule("no_https", 0.05, "Website link is not served over HTTPS",
                  lambda ctx: _has(ctx["url"], "url_no_https")))
    R.append(Rule("typosquat", 0.20, "URL appears to typosquat a known brand",
                  lambda ctx: _has(ctx["url"], "url_typosquat")))

    return R


_RULES = _build_rules()

# Grammar-anomaly & suspicious-attachment heuristics (regex-based)
_ATTACH_RE = re.compile(r"\.(exe|scr|js|vbs|jar|zip|rar|docm|xlsm)\b", re.I)
_GRAMMAR_RE = re.compile(r"(kindly do the needful|revert back|dear winner|"
                         r"your good self|do the needful)", re.I)


@dataclass
class RuleResult:
    risk_score: float                      # 0-100
    probability: float                     # 0-1
    reasons: List[str] = field(default_factory=list)
    fired: List[str] = field(default_factory=list)


def evaluate(text: str, sender: str = "", reply_to: str = "", url: str = "") -> RuleResult:
    """Run all rules and return an aggregated risk result."""
    ctx = {
        "scam": detect_indicators(text),
        "meta": extract_metadata_features(sender, reply_to, text),
        "url": aggregate_url_features(text, explicit_url=url),
        "text": text or "",
    }

    total = 0.0
    reasons: List[str] = []
    fired: List[str] = []
    for rule in _RULES:
        try:
            if rule.test(ctx):
                total += rule.weight
                reasons.append(rule.reason)
                fired.append(rule.name)
        except Exception:
            continue

    # Extra heuristic rules
    if _ATTACH_RE.search(ctx["text"]):
        total += 0.15
        reasons.append("Contains a potentially dangerous attachment type")
        fired.append("suspicious_attachment")
    if _GRAMMAR_RE.search(ctx["text"]):
        total += 0.05
        reasons.append("Grammar/style anomalies typical of scam emails")
        fired.append("grammar_anomaly")

    # Saturating transform -> 0..1 (diminishing returns after several hits)
    probability = 1.0 - (1.0 / (1.0 + total * 1.6))
    risk_score = round(probability * 100, 1)
    return RuleResult(risk_score=risk_score, probability=probability,
                      reasons=reasons, fired=fired)
