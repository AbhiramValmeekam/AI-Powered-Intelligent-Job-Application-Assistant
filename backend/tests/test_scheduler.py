"""
Scheduler / notifications tests (live Remotive API; no Gemini needed).
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
async def test_alert_scan_pushes_notifications_and_dedupes(client):
    email = "sched_test@example.com"
    await client.post("/api/profiles", json={
        "fullName": "Sched", "email": email,
        "skills": ["python", "react", "aws"],
        "careerPreferences": {"goal": "python developer"}})

    # First manual scan
    r1 = await client.post("/api/jobs/alerts/run")
    assert r1.status_code == 200
    n1 = await coll("notifications").count_documents({"email": email})

    # Second scan should not duplicate already-seen job URLs
    await client.post("/api/jobs/alerts/run")
    n2 = await coll("notifications").count_documents({"email": email})

    assert n1 > 0, "expected at least one notification"
    assert n1 == n2, "second scan duplicated notifications (dedupe broken)"


@pytest.mark.asyncio
async def test_notifications_endpoint(client):
    email = "notif_test@example.com"
    await client.post("/api/profiles", json={
        "fullName": "N", "email": email,
        "skills": ["python", "go"],
        "careerPreferences": {"goal": "python developer"}})
    await client.post("/api/jobs/alerts/run")
    r = await client.get("/api/notifications", params={"email": email})
    assert r.status_code == 200
    assert r.json()["count"] > 0
