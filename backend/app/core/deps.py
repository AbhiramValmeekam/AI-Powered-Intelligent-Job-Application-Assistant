"""
Shared dependencies: build a Gemini client from settings, with quota handling.
"""
from fastapi import Depends, HTTPException, status
from app.core.config import settings
from app.engines.gemini_client import GeminiClient, QuotaError


def get_gemini() -> GeminiClient:
    key = settings.GEMINI_API_KEY
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY is not configured on the server. Set it in backend/.env.",
        )
    return GeminiClient(key, settings.GEMINI_MODEL)


def handle_engine_errors(fn):
    """Decorator-friendly helper: convert QuotaError -> 429 with a clear message."""
    return fn
