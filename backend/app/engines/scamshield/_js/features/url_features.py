"""
URL feature extraction: suspicious TLDs, shorteners, IP-based URLs, SSL,
typosquatting against a set of known-legit brand domains.
"""
from __future__ import annotations

import re
from typing import Dict, List
from urllib.parse import urlparse

SUSPICIOUS_TLDS = {
    "xyz", "top", "club", "online", "info", "site", "click", "work", "loan",
    "gq", "tk", "ml", "cf", "ga", "country", "stream", "download",
}
SHORTENERS = {
    "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
    "rebrand.ly", "cutt.ly", "shorturl.at",
}
KNOWN_BRANDS = [
    "google", "microsoft", "amazon", "infosys", "tcs", "wipro", "accenture",
    "deloitte", "zoho", "flipkart", "linkedin",
]

_IP_RE = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def extract_urls(text: str) -> List[str]:
    return _URL_RE.findall(text if isinstance(text, str) else "")


def analyze_url(url: str) -> Dict[str, int]:
    """Return a dict of binary/numeric URL risk features for a single URL."""
    feats = {
        "url_is_ip": 0, "url_shortened": 0, "url_suspicious_tld": 0,
        "url_no_https": 0, "url_typosquat": 0, "url_has_at": 0,
        "url_num_dots": 0, "url_len": 0,
    }
    if not url or not isinstance(url, str):
        return feats
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    try:
        p = urlparse(url)
    except Exception:
        return feats
    host = (p.hostname or "").lower()
    feats["url_len"] = len(url)
    feats["url_num_dots"] = host.count(".")
    feats["url_has_at"] = int("@" in url)
    feats["url_no_https"] = int(p.scheme != "https")
    if _IP_RE.match(host):
        feats["url_is_ip"] = 1
    if host in SHORTENERS:
        feats["url_shortened"] = 1
    tld = host.rsplit(".", 1)[-1] if "." in host else ""
    if tld in SUSPICIOUS_TLDS:
        feats["url_suspicious_tld"] = 1
    # typosquatting: hostname label close to but not equal a known brand
    labels = host.split(".")
    for lbl in labels:
        for brand in KNOWN_BRANDS:
            d = _levenshtein(lbl, brand)
            if 0 < d <= 2 and lbl != brand:
                feats["url_typosquat"] = 1
                break
    return feats


def aggregate_url_features(text: str, explicit_url: str = "") -> Dict[str, int]:
    """Aggregate URL features over all URLs found in text (+ an explicit URL)."""
    urls = extract_urls(text)
    if explicit_url and isinstance(explicit_url, str):
        urls.append(explicit_url)
    agg = {
        "url_is_ip": 0, "url_shortened": 0, "url_suspicious_tld": 0,
        "url_no_https": 0, "url_typosquat": 0, "url_has_at": 0,
        "url_num_dots": 0, "url_len": 0, "url_count": len(urls),
    }
    for u in urls:
        f = analyze_url(u)
        for k in ("url_is_ip", "url_shortened", "url_suspicious_tld",
                  "url_no_https", "url_typosquat", "url_has_at"):
            agg[k] = max(agg[k], f[k])
        agg["url_num_dots"] = max(agg["url_num_dots"], f["url_num_dots"])
        agg["url_len"] = max(agg["url_len"], f["url_len"])
    return agg
