"""
CareerOS — AI-Powered Intelligent Career Assistant
Backend entrypoint (FastAPI).

Run:  cd backend  &&  uvicorn app.main:app --reload --port 8000
(or:   python3 -m uvicorn app.main:app --port 8000)
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.core.scheduler import start_scheduler, stop_scheduler
from app.api import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    start_scheduler(settings.ALERT_INTERVAL_MIN)
    yield
    # Shutdown
    stop_scheduler()
    await close_mongo_connection()


app = FastAPI(
    title="CareerOS API",
    description="AI-powered career assistant: profiles, job intelligence, resume tailoring, "
                "cover letters, ATS analysis, scam detection, interview prep, and more.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — controlled by CORS_ORIGINS env. Set CORS_ORIGINS=* to allow any origin
# (useful behind Vercel previews); otherwise comma-separate your frontend domains.
_raw = settings.CORS_ORIGINS.strip()
allow_origins = ["*"] if _raw == "*" else settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False if allow_origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "careeros-backend", "version": "0.1.0"}
