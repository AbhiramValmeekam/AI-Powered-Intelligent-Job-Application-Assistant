"""
Job discovery + alerts endpoint tests (live Remotive API; no Gemini needed).

These hit the real Remotive API, so they require network. Marked to skip
gracefully if offline.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import connect_to_mongo, close_mongo_connection, coll


@pytest.fixture
async def client():
    await connect_to_mongo()
    for name in ("profiles", "jobs", "notifications"):
        await coll(name).delete_many({})
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await close_mongo_connection()


@pytest.mark.asyncio
async def test_jobs_search_live(client):
    r = await client.get("/api/jobs/search", params={"q": "python developer", "use_adzuna": "false"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["count"] > 0, "expected live jobs from Remotive"
    assert "remotive" in data["sources"]


@pytest.mark.asyncio
async def test_jobs_alerts_matches_profile(client):
    email = "jobalert_test@example.com"
    await client.post("/api/profiles", json={
        "fullName": "JA", "email": email, "skills": ["python", "react", "aws"],
        "careerPreferences": {"goal": "python developer"}})
    r = await client.get("/api/jobs/alerts", params={"email": email, "q": "python developer"})
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["totalLive"] > 0
    # at least one job should match a profile skill
    assert any(j["matchScore"] > 0 for j in d["matched"])
    # notifications written
    n = await coll("notifications").count_documents({"email": email, "type": "job_match"})
    assert n > 0
