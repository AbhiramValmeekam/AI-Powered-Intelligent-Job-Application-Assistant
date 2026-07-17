"""
Job Discovery engine — fetch REAL job postings from free job APIs and normalize them.

Sources:
- Remotive  : https://remotive.com/api/remote-jobs  (no API key, remote jobs)
- Adzuna    : https://api.adzuna.com/v1/api/jobs/{country}/search/1  (free key required)

Both are wrapped so a failure in one source never breaks the others. Results are
normalized to a common dict:
    {
      source, title, company, location, url, salary, type,
      description, skills[], postedAt
    }
"""
import json
import time
import httpx
from typing import Optional


class JobDiscoveryError(RuntimeError):
    pass


def _normalize_common(raw: dict, source: str) -> dict:
    return {
        "source": source,
        "title": raw.get("title", ""),
        "company": raw.get("company", ""),
        "location": raw.get("location", ""),
        "url": raw.get("url", ""),
        "salary": raw.get("salary", ""),
        "type": raw.get("type", ""),
        "description": (raw.get("description") or "")[:2000],
        "skills": raw.get("skills", []) or [],
        "postedAt": raw.get("postedAt", ""),
    }


# --------------------------------------------------------------------------- #
# Remotive (no key)
# --------------------------------------------------------------------------- #
def fetch_remotive(query: str = "", category: str = "") -> list[dict]:
    """Fetch remote jobs from Remotive. Free, no auth."""
    try:
        resp = httpx.get(
            "https://remotive.com/api/remote-jobs",
            params={"search": query, "category": category} if (query or category) else {},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        jobs = data.get("jobs", [])
    except Exception as e:
        raise JobDiscoveryError(f"Remotive fetch failed: {e}")

    out = []
    for j in jobs:
        out.append(_normalize_common({
            "title": j.get("title"),
            "company": j.get("company_name"),
            "location": j.get("candidate_required_location", "Remote"),
            "url": j.get("url"),
            "salary": j.get("salary", ""),
            "type": "Remote",
            "description": j.get("description", ""),
            # Remotive tags are free-text; we expose them as skills hints
            "skills": j.get("tags", []) or [],
            "postedAt": j.get("publication_date", ""),
        }, "remotive"))
    return out


# --------------------------------------------------------------------------- #
# Adzuna (free key: APP_ID + APP_KEY)
# --------------------------------------------------------------------------- #
def fetch_adzuna(query: str, country: str = "us", location: str = "",
                 app_id: str = "", app_key: str = "", max_results: int = 20) -> list[dict]:
    """Fetch jobs from Adzuna. Requires a free API id+key (https://developer.adzuna.com)."""
    if not app_id or not app_key:
        raise JobDiscoveryError(
            "Adzuna requires a free API key (ADZUNA_APP_ID + ADZUNA_APP_KEY). "
            "Get one at https://developer.adzuna.com — or use Remotive (no key)."
        )
    params = {
        "app_id": app_id,
        "app_key": app_key,
        "results_per_page": max_results,
        "what": query,
        "content-type": "application/json",
    }
    if location:
        params["where"] = location
    try:
        resp = httpx.get(
            f"https://api.adzuna.com/v1/api/jobs/{country}/search/1",
            params=params, timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        jobs = data.get("results", [])
    except Exception as e:
        raise JobDiscoveryError(f"Adzuna fetch failed: {e}")

    out = []
    for j in jobs:
        salary = ""
        if j.get("salary_min") or j.get("salary_max"):
            salary = f"{j.get('salary_min') or ''}-{j.get('salary_max') or ''}"
        out.append(_normalize_common({
            "title": j.get("title"),
            "company": (j.get("company") or {}).get("display_name", ""),
            "location": (j.get("location") or {}).get("display_name", ""),
            "url": j.get("redirect_url", ""),
            "salary": salary,
            "type": (j.get("contract_type") or ""),
            "description": j.get("description", ""),
            "skills": [],
            "postedAt": j.get("created", ""),
        }, "adzuna"))
    return out


# --------------------------------------------------------------------------- #
# Aggregator — try all enabled sources, never fail hard
# --------------------------------------------------------------------------- #
def search_jobs(query: str, location: str = "", category: str = "",
                adzuna_app_id: str = "", adzuna_app_key: str = "",
                include_adzuna: bool = True) -> dict:
    """Return {'sources': {...}, 'jobs': [...], 'errors': [...]} — resilient."""
    sources = {}
    all_jobs = []
    errors = []

    # Remotive (always, no key)
    try:
        rem = fetch_remotive(query, category)
        sources["remotive"] = len(rem)
        all_jobs.extend(rem)
    except JobDiscoveryError as e:
        errors.append(str(e))

    # Adzuna (optional)
    if include_adzuna:
        try:
            adz = fetch_adzuna(query, location=location,
                               app_id=adzuna_app_id, app_key=adzuna_app_key)
            sources["adzuna"] = len(adz)
            all_jobs.extend(adz)
        except JobDiscoveryError as e:
            errors.append(str(e))

    return {"sources": sources, "count": len(all_jobs), "jobs": all_jobs, "errors": errors}
