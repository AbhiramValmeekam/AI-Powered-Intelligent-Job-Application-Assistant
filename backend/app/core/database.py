"""
MongoDB connection (async via Motor) + collection accessors.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo():
    global _client, _db
    _client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
    _db = _client[settings.MONGODB_DB]
    # verify connection
    await _client.admin.command("ping")
    print(f"[db] connected to MongoDB at {settings.MONGODB_URL} (db={settings.MONGODB_DB})")


async def close_mongo_connection():
    global _client
    if _client:
        _client.close()
        _client = None
    print("[db] MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB not connected. Did the lifespan startup run?")
    return _db


# Convenience collection accessors (match spec's collection names)
def coll(name: str):
    return get_db()[name]


COLLECTIONS = [
    "users", "profiles", "resumes", "jobs", "applications", "companies",
    "skills", "courses", "coverletters", "scamreports", "interviewhistory",
    "resumeversions", "notifications",
]
