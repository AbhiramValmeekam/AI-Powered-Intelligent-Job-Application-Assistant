"""
Email metadata features: free-email detection, reply-to mismatch, brand/domain
mismatch, sender-domain heuristics.
"""
from __future__ import annotations

import re
from typing import Dict

FREE_EMAIL_PROVIDERS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com",
    "protonmail.com", "aol.com", "icloud.com", "yandex.com", "mail.com",
    "gmx.com", "zoho.com",
}
KNOWN_BRANDS = [
    "google", "microsoft", "amazon", "infosys", "tcs", "wipro", "accenture",
    "deloitte", "zoho", "flipkart",
]

_EMAIL_RE = re.compile(r"[\w.+-]+@([\w.-]+)")


def _domain(addr: str) -> str:
    if not addr or not isinstance(addr, str):
        return ""
    m = _EMAIL_RE.search(addr)
    return m.group(1).lower() if m else ""


def extract_metadata_features(
    sender: str = "", reply_to: str = "", text: str = ""
) -> Dict[str, int]:
    """Return numeric metadata features from sender / reply-to / body."""
    sender_dom = _domain(sender)
    reply_dom = _domain(reply_to)

    feats = {
        "meta_free_email": 0,
        "meta_reply_to_mismatch": 0,
        "meta_brand_domain_mismatch": 0,
        "meta_has_sender": int(bool(sender_dom)),
        "meta_subdomain_depth": sender_dom.count(".") if sender_dom else 0,
        "meta_no_company_address": 0,
    }

    if sender_dom in FREE_EMAIL_PROVIDERS:
        feats["meta_free_email"] = 1

    if sender_dom and reply_dom and sender_dom != reply_dom:
        feats["meta_reply_to_mismatch"] = 1

    # brand mentioned in body but sender domain doesn't contain that brand
    low = (text if isinstance(text, str) else "").lower()
    for brand in KNOWN_BRANDS:
        if brand in low and brand not in sender_dom:
            feats["meta_brand_domain_mismatch"] = 1
            break

    # crude "no company address" signal
    if not re.search(r"\b(street|road|floor|tower|city|pin ?code|\d{6})\b", low):
        feats["meta_no_company_address"] = 1

    return feats
