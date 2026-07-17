"""
Smoke tests for CareerOS backend (DB-backed endpoints; no Gemini required).

Run from backend/:  PYTHONPATH=. python -m pytest tests/ -q
Requires MongoDB running on localhost:27017.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import connect_to_mongo, close_mongo_connection, coll


@pytest.fixture
async def client():
    await connect_to_mongo()
    # isolate: wipe collections the tests touch
    for name in ("profiles", "applications"):
        await coll(name).delete_many({})
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await close_mongo_connection()


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_profile_upsert_and_get(client):
    email = "smoke_test@example.com"
    r = await client.post("/api/profiles", json={
        "fullName": "Smoke Test", "email": email, "skills": ["Python"],
        "careerPreferences": {"goal": "SDE"},
    })
    assert r.status_code == 200
    r2 = await client.get(f"/api/profiles/{email}")
    assert r2.status_code == 200
    assert r2.json()["email"] == email


@pytest.mark.asyncio
async def test_application_tracker_and_analytics(client):
    email = "track_test@example.com"
    await client.post("/api/applications", json={
        "candidateEmail": email, "company": "A", "role": "SDE", "status": "Applied"})
    await client.post("/api/applications", json={
        "candidateEmail": email, "company": "B", "role": "SDE", "status": "Interview"})
    r = await client.get("/api/analytics/summary", params={"email": email})
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["totalApplications"] == 2
    assert d["byStatus"]["Applied"] == 1
    assert d["byStatus"]["Interview"] == 1
    assert d["interviewRate"] == 50.0
