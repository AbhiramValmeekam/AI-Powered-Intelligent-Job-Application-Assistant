"""
Background scheduler for real-time job alerts.

Uses APScheduler to periodically scan live job sources for each user and push
new matching jobs into their notifications collection. Designed to be started
once from the FastAPI lifespan.

- Each registered user profile is checked on an interval (default 15 min).
- Only NEW jobs (by URL) are notified, to avoid duplicates.
- Resilient: one user's failure never stops the loop.
"""
import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.database import coll
from app.engines.job_discovery import search_jobs, JobDiscoveryError

log = logging.getLogger("careeros.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _check_user(profile: dict, settings):
    email = profile.get("email")
    if not email:
        return
    p_skills = set(s.lower() for s in (profile.get("skills") or []))
    prefs = profile.get("careerPreferences") or {}
    query = prefs.get("goal") or profile.get("fullName", "")
    if not query:
        return
    try:
        result = search_jobs(
            query,
            adzuna_app_id=settings.ADZUNA_APP_ID,
            adzuna_app_key=settings.ADZUNA_APP_KEY,
        )
    except JobDiscoveryError as e:
        log.warning("job scan failed for %s: %s", email, e)
        return

    # Already-notified URLs for this user
    seen = set()
    async for n in coll("notifications").find({"email": email, "type": "job_match"}):
        if n.get("url"):
            seen.add(n["url"])

    inserted = 0
    for j in result["jobs"]:
        url = j.get("url")
        if not url or url in seen:
            continue
        j_skills = set(s.lower() for s in j.get("skills", []))
        overlap = sorted(p_skills & j_skills)
        if not overlap:
            continue
        await coll("notifications").insert_one({
            "email": email,
            "type": "job_match",
            "title": j.get("title"),
            "company": j.get("company"),
            "url": url,
            "location": j.get("location"),
            "matchedSkills": overlap,
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
        seen.add(url)
        inserted += 1
    if inserted:
        log.info("pushed %d new job alerts for %s", inserted, email)


async def _scan_all_users():
    from app.core.config import settings
    count = 0
    async for profile in coll("profiles").find({}):
        try:
            await _check_user(profile, settings)
            count += 1
        except Exception as e:  # never kill the loop
            log.exception("alert scan error for a user: %s", e)
    log.info("job-alert scan complete: %d profiles checked", count)


def start_scheduler(interval_minutes: int = 15):
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        lambda: asyncio.create_task(_scan_all_users()),
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="job_alert_scan",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.start()
    log.info("job-alert scheduler started (every %d min)", interval_minutes)
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("job-alert scheduler stopped")
