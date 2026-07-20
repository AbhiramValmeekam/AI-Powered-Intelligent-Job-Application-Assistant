"""
Company reputation check for JobShield AI.

Offline mode (default): heuristic trust score from domain characteristics.
Online mode (config.reputation.online_checks: true): live WHOIS domain-age +
HTTP reachability + careers-page probe. Network failures degrade gracefully.
Returns a 0-100 trust score (higher = more trustworthy).
"""
from __future__ import annotations

import re
import socket
from dataclasses import dataclass, field
from typing import List, Optional

from features.metadata_features import FREE_EMAIL_PROVIDERS
from features.url_features import SUSPICIOUS_TLDS
from utils import load_config


@dataclass
class ReputationResult:
    trust_score: float                       # 0-100
    signals: List[str] = field(default_factory=list)
    domain: Optional[str] = None
    online: bool = False


def _extract_domain(url_or_email: str) -> str:
    s = (url_or_email or "").strip().lower()
    m = re.search(r"@([\w.-]+)", s)
    if m:
        return m.group(1)
    m = re.search(r"https?://([^/]+)", s)
    if m:
        return m.group(1)
    m = re.match(r"([\w.-]+\.[a-z]{2,})", s)
    return m.group(1) if m else ""


def check_reputation(domain_or_url: str) -> ReputationResult:
    cfg = load_config()["reputation"]
    domain = _extract_domain(domain_or_url)
    signals: List[str] = []
    score = 60.0  # neutral baseline

    if not domain:
        return ReputationResult(trust_score=40.0,
                                signals=["No domain provided"], domain=None)

    tld = domain.rsplit(".", 1)[-1]
    if domain in FREE_EMAIL_PROVIDERS:
        score -= 25; signals.append("Free email provider, not a company domain")
    if tld in SUSPICIOUS_TLDS:
        score -= 25; signals.append(f"Suspicious TLD .{tld}")
    if re.search(r"\d{1,3}(?:\.\d{1,3}){3}", domain):
        score -= 30; signals.append("IP-address host")
    if len(domain) > 30:
        score -= 5; signals.append("Unusually long domain")
    if re.search(r"(careers|hiring|jobs|recruit)[-.]", domain):
        score -= 10; signals.append("Generic recruitment-style domain")

    online = False
    if cfg.get("online_checks"):
        online = True
        timeout = cfg.get("timeout_seconds", 5)
        # DNS resolution
        try:
            socket.setdefaulttimeout(timeout)
            socket.gethostbyname(domain)
            score += 5; signals.append("Domain resolves via DNS")
        except Exception:
            score -= 20; signals.append("Domain does not resolve")
        # HTTP reachability + careers page
        try:
            import requests
            r = requests.get(f"https://{domain}", timeout=timeout)
            if r.status_code < 400:
                score += 10; signals.append("Website reachable over HTTPS")
            cr = requests.get(f"https://{domain}/careers", timeout=timeout)
            if cr.status_code < 400:
                score += 5; signals.append("Careers page exists")
        except Exception:
            score -= 10; signals.append("Website unreachable")
        # WHOIS domain age
        try:
            import whois  # python-whois
            w = whois.whois(domain)
            cd = w.creation_date
            if isinstance(cd, list):
                cd = cd[0]
            if cd:
                from datetime import datetime
                age_days = (datetime.now() - cd).days
                if age_days > 730:
                    score += 15; signals.append(f"Domain age {age_days // 365}y (established)")
                elif age_days < 90:
                    score -= 15; signals.append("Domain registered very recently")
        except Exception:
            pass

    score = max(0.0, min(100.0, score))
    return ReputationResult(trust_score=round(score, 1), signals=signals,
                            domain=domain, online=online)
