"""
CareerOS API router — all 15 core modules wired as real endpoints.

Auth is stubbed (AUTH_ENABLED=False) for Phase 1: endpoints are functional without
login. The `userId` is accepted in bodies where needed; a real auth middleware
(Clerk/Firebase) slots in later without changing the engine logic.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.deps import get_gemini
from app.engines.job_discovery import search_jobs, JobDiscoveryError
from app.engines.gemini_client import GeminiClient, QuotaError
from app.engines.resume.parser import parse_resume
from app.engines.resume.engine import ResumeEngine
from app.engines.intelligence import IntelligenceEngine
from app.schemas import (
    ProfileIn, JobAnalyzeIn, JobUrlIn, TailorIn, AnalyzeAtsIn, ScamCheckIn,
    InterviewQIn, InterviewFeedbackIn, LearningIn, AdvisorIn,
)

router = APIRouter()


def _gemini_or_quota(gemini: GeminiClient = Depends(get_gemini)):
    return gemini


# Helper: convert engine/quota errors into HTTP responses
def _run(fn):
    try:
        return fn()
    except QuotaError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)[:300]}")


# ===================================================================== #
# 1. Master Career Profile
# ===================================================================== #
@router.post("/profiles")
async def upsert_profile(profile: ProfileIn):
    from app.core.database import coll
    doc = profile.model_dump()
    existing = await coll("profiles").find_one({"email": doc["email"]})
    if existing:
        await coll("profiles").update_one({"_id": existing["_id"]}, {"$set": doc})
        return {"ok": True, "id": str(existing["_id"]), "created": False}
    res = await coll("profiles").insert_one(doc)
    return {"ok": True, "id": str(res.inserted_id), "created": True}


@router.get("/profiles/{email}")
async def get_profile(email: str):
    from app.core.database import coll
    doc = await coll("profiles").find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    doc["_id"] = str(doc["_id"])
    return doc


# ===================================================================== #
# 2 & 3. AI Job Discovery + Job Description Intelligence
# ===================================================================== #
@router.post("/jobs/analyze")
async def analyze_job(body: JobAnalyzeIn, gemini: GeminiClient = Depends(get_gemini)):
    engine = ResumeEngine(gemini)

    def fn():
        jd = engine.analyze_job_description(body.jobDescription)
        # persist the analyzed job
        import asyncio
        return jd
    jd = _run(fn)
    # store in jobs collection (asyncio-safe: schedule without awaiting in sync helper)
    from app.core.database import coll
    try:
        await coll("jobs").insert_one({"jd": jd, "raw": body.jobDescription})
    except Exception:
        pass
    return {"ok": True, "data": jd}


@router.post("/jobs/from-url")
async def job_from_url(body: JobUrlIn):
    """Queue a company career URL for scraping (Playwright, Phase 2) and immediately
    run a live search for that company name so results appear now."""
    from app.core.database import coll
    doc = {"url": body.url, "notes": body.notes, "status": "queued"}
    res = await coll("jobs").insert_one(doc)
    # Best-effort live search by company name (no LLM needed)
    try:
        company = body.url.split("//")[-1].split("/")[0].replace("www.", "")
        live = search_jobs(company, adzuna_app_id=settings.ADZUNA_APP_ID,
                           adzuna_app_key=settings.ADZUNA_APP_KEY)
        return {"ok": True, "id": str(res.inserted_id),
                "message": "URL queued. Live matching jobs returned below.",
                "liveResults": live}
    except JobDiscoveryError as e:
        return {"ok": True, "id": str(res.inserted_id),
                "message": "URL queued (live search unavailable).", "warn": str(e)}


# --------------------------------------------------------------------------- #
# 2. AI Job Discovery — LIVE job search (Remotive + Adzuna)
# --------------------------------------------------------------------------- #
@router.get("/jobs/search")
async def jobs_search(q: str, location: str = "", category: str = "",
                      use_adzuna: bool = True):
    """Live job search across free APIs. Returns real, current postings."""
    try:
        result = search_jobs(
            q, location=location, category=category,
            adzuna_app_id=settings.ADZUNA_APP_ID,
            adzuna_app_key=settings.ADZUNA_APP_KEY,
            include_adzuna=use_adzuna,
        )
    except JobDiscoveryError as e:
        raise HTTPException(status_code=502, detail=str(e))
    # Persist fetched jobs for later analytics/alerts
    from app.core.database import coll
    try:
        docs = [dict(j) for j in result["jobs"]]
        if docs:
            await coll("jobs").insert_many(docs, ordered=False)
    except Exception:
        pass
    return {"ok": True, "data": result}


@router.get("/jobs/alerts")
async def job_alerts(email: str, q: str = "", location: str = ""):
    """Match live jobs against the user's stored profile skills → alerts.

    Returns jobs whose skills overlap the profile, sorted by match, and writes
    any new matches to the notifications collection.
    """
    from app.core.database import coll
    profile = await coll("profiles").find_one({"email": email})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    p_skills = set(s.lower() for s in (profile.get("skills") or []))
    prefs = profile.get("careerPreferences") or {}
    query = q or prefs.get("goal") or profile.get("fullName", "")
    try:
        result = search_jobs(query, location=location,
                             adzuna_app_id=settings.ADZUNA_APP_ID,
                             adzuna_app_key=settings.ADZUNA_APP_KEY)
    except JobDiscoveryError as e:
        raise HTTPException(status_code=502, detail=str(e))

    matched = []
    for j in result["jobs"]:
        j_skills = set(s.lower() for s in j.get("skills", []))
        overlap = sorted(p_skills & j_skills)
        score = len(overlap)
        if score > 0:
            j["matchScore"] = score
            j["matchedSkills"] = overlap
            matched.append(j)

    matched.sort(key=lambda x: x["matchScore"], reverse=True)
    # Write top new matches to notifications
    try:
        for j in matched[:10]:
            await coll("notifications").insert_one({
                "email": email, "type": "job_match", "title": j["title"],
                "company": j["company"], "url": j["url"],
                "matchedSkills": j["matchedSkills"], "read": False,
            })
    except Exception:
        pass
    return {"ok": True, "data": {"query": query, "matched": matched,
                                 "totalLive": result["count"]}}


@router.post("/jobs/alerts/run")
async def run_alert_scan():
    """Manually trigger an immediate scan of all user profiles for new matching jobs.

    The background scheduler also runs this on an interval (ALERT_INTERVAL_MIN);
    this endpoint is for on-demand / testing use.
    """
    from app.core.scheduler import _scan_all_users
    await _scan_all_users()
    return {"ok": True, "message": "Alert scan triggered for all profiles."}


@router.get("/notifications")
async def list_notifications(email: str = None, unread_only: bool = False):
    from app.core.database import coll
    q = {}
    if email:
        q["email"] = email
    if unread_only:
        q["read"] = False
    cur = coll("notifications").find(q).sort("createdAt", -1)
    out = []
    async for d in cur:
        d["_id"] = str(d["_id"])
        out.append(d)
    return {"ok": True, "data": out, "count": len(out)}


# ===================================================================== #
# 4 & 5. Resume Tailoring Engine + Cover Letter
# ===================================================================== #
@router.post("/resume/tailor")
async def tailor_resume(
    resume_file: UploadFile = File(None),
    resume_text: str = Form(None),
    job_description: str = Form(..., description="Job description (min 20 chars)"),
    gemini: GeminiClient = Depends(get_gemini),
):
    engine = ResumeEngine(gemini)

    def fn():
        if resume_file is not None and resume_file.filename:
            raw = parse_resume(resume_file.file.read(), resume_file.filename)
        elif resume_text:
            raw = resume_text
        else:
            raise ValueError("Provide either an uploaded resume file or resumeText (form field).")
        if not job_description or len(job_description) < 20:
            raise ValueError("jobDescription is required (min 20 chars).")
        return engine.tailor_resume(raw, job_description)

    result = _run(fn)
    from app.core.database import coll
    try:
        await coll("resumeversions").insert_one(result)
    except Exception:
        pass
    return {"ok": True, "data": result}


@router.post("/cover-letter")
async def cover_letter(body: dict, gemini: GeminiClient = Depends(get_gemini)):
    engine = ResumeEngine(gemini)

    def fn():
        tailored = body.get("tailoredResume", {})
        jd = body.get("jobJson", {})
        if body.get("rawText") and body.get("jobDescription"):
            return engine.tailor_resume(body["rawText"], body["jobDescription"]).get("coverLetter", "")
        return engine.cover_letter_from_tailored(tailored, jd)

    letter = _run(fn)
    return {"ok": True, "data": letter}


# ===================================================================== #
# 6. ATS Analyzer
# ===================================================================== #
@router.post("/ats/analyze")
async def ats_analyze(body: AnalyzeAtsIn, gemini: GeminiClient = Depends(get_gemini)):
    engine = ResumeEngine(gemini)
    result = _run(lambda: engine.analyze_ats(body.tailoredResume, body.jobJson))
    return {"ok": True, "data": result}


# ===================================================================== #
# 7. Missing Skill Analyzer
# ===================================================================== #
@router.post("/skills/missing")
async def missing_skills(body: AnalyzeAtsIn, gemini: GeminiClient = Depends(get_gemini)):
    engine = ResumeEngine(gemini)
    result = _run(lambda: engine.missing_skills(body.tailoredResume, body.jobJson))
    return {"ok": True, "data": result}


# ===================================================================== #
# 8. AI Scam Shield (integrates the real JobShield ML model)
# ===================================================================== #
@router.post("/scam/check")
async def scam_check(body: ScamCheckIn):
    try:
        from app.engines.scamshield import ScamShieldEngine
        from app.engines.scamshield import engine as _engine_mod
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Scam Shield engine not available: {str(e)[:200]}. "
            f"It loads trained models from {getattr(_engine_mod, 'DEFAULT_MODEL_DIR', 'JOBSHIELD_MODEL_DIR')}.",
        )
    try:
        engine = ScamShieldEngine()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    result = _run(lambda: engine.analyze(text=body.text, url=body.url))
    from app.core.database import coll
    try:
        doc = dict(result); doc["type"] = body.type
        await coll("scamreports").insert_one(doc)
    except Exception:
        pass
    return {"ok": True, "data": result}


# ===================================================================== #
# 9. Company Intelligence
# ===================================================================== #
@router.post("/company/research")
async def company_research(body: dict, gemini: GeminiClient = Depends(get_gemini)):
    engine = IntelligenceEngine(gemini)
    company = body.get("company", "")
    ctx = body.get("extraContext", "")
    result = _run(lambda: engine.research_company(company, ctx))
    from app.core.database import coll
    try:
        await coll("companies").insert_one({"name": company, "intel": result})
    except Exception:
        pass
    return {"ok": True, "data": result}


# ===================================================================== #
# 10. AI Interview Coach
# ===================================================================== #
@router.post("/interview/questions")
async def interview_questions(body: InterviewQIn, gemini: GeminiClient = Depends(get_gemini)):
    engine = IntelligenceEngine(gemini)
    result = _run(lambda: engine.interview_questions(
        body.jobJson, body.resumeJson, body.company, body.style))
    return {"ok": True, "data": result}


@router.post("/interview/feedback")
async def interview_feedback(body: InterviewFeedbackIn, gemini: GeminiClient = Depends(get_gemini)):
    engine = IntelligenceEngine(gemini)
    result = _run(lambda: engine.interview_feedback(body.question, body.answer))
    return {"ok": True, "data": result}


# ===================================================================== #
# 11. Application Tracker
# ===================================================================== #
@router.post("/applications")
async def add_application(body: dict):
    from app.core.database import coll
    doc = body.copy(); doc.setdefault("status", "Applied")
    res = await coll("applications").insert_one(doc)
    return {"ok": True, "id": str(res.inserted_id)}


@router.get("/applications")
async def list_applications(email: str = None, status: str = None):
    from app.core.database import coll
    q = {}
    if email:
        q["candidateEmail"] = email
    if status:
        q["status"] = status
    cur = coll("applications").find(q)
    out = []
    async for d in cur:
        d["_id"] = str(d["_id"])
        out.append(d)
    return {"ok": True, "data": out, "count": len(out)}


@router.patch("/applications/{app_id}")
async def update_application(app_id: str, body: dict):
    from app.core.database import coll
    from bson import ObjectId
    await coll("applications").update_one(
        {"_id": ObjectId(app_id)}, {"$set": body})
    return {"ok": True}


# ===================================================================== #
# 12. Resume Version Control  (versions stored in resumeversions collection)
# ===================================================================== #
@router.get("/resume/versions")
async def list_versions(email: str = None):
    from app.core.database import coll
    q = {"candidateEmail": email} if email else {}
    cur = coll("resumeversions").find(q).sort("createdAt", -1)
    out = []
    async for d in cur:
        d["_id"] = str(d["_id"])
        out.append(d)
    return {"ok": True, "data": out, "count": len(out)}


# ===================================================================== #
# 13 & 14. Career Analytics + Learning Recommendation Engine
# ===================================================================== #
@router.get("/analytics/summary")
async def analytics_summary(email: str = None):
    from app.core.database import coll
    q = {"candidateEmail": email} if email else {}
    total = await coll("applications").count_documents(q)
    pipeline = [{"$match": q}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    by_status = {}
    async for d in coll("applications").aggregate(pipeline):
        by_status[d["_id"]] = d["n"]
    offers = by_status.get("Offer", 0)
    interviews = by_status.get("Interview", 0)
    success_rate = round(100 * offers / total, 1) if total else 0.0
    interview_rate = round(100 * interviews / total, 1) if total else 0.0
    return {"ok": True, "data": {
        "totalApplications": total, "byStatus": by_status,
        "offerRate": success_rate, "interviewRate": interview_rate,
    }}


@router.post("/learning/recommend")
async def learning_recommend(body: LearningIn, gemini: GeminiClient = Depends(get_gemini)):
    engine = IntelligenceEngine(gemini)
    result = _run(lambda: engine.learning_recommendations(
        body.goal, body.missing, body.marketDemand))
    return {"ok": True, "data": result}


# ===================================================================== #
# 15. AI Career Advisor (chatbot)
# ===================================================================== #
@router.post("/advisor/chat")
async def advisor_chat(body: AdvisorIn, gemini: GeminiClient = Depends(get_gemini)):
    engine = IntelligenceEngine(gemini)
    profile_json = {}
    if body.userId or body.email:
        from app.core.database import coll
        key = {"email": body.email} if body.email else {"_id": body.userId}
        doc = await coll("profiles").find_one(key)
        if doc:
            doc.pop("_id", None)
            profile_json = doc
    result = _run(lambda: engine.career_advice(profile_json, body.question, body.docs))
    return {"ok": True, "data": result}
