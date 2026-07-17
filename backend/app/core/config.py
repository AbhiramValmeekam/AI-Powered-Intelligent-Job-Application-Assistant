"""
Central configuration loaded from environment variables (.env supported).
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- App ---
    PROJECT_NAME: str = "CareerOS"
    API_V1_PREFIX: str = "/api"
    DEBUG: bool = False

    # --- Database ---
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "careeros"

    # --- Gemini (LLM for intelligence modules) ---
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # --- Job Discovery (free APIs) ---
    ADZUNA_APP_ID: str = ""
    ADZUNA_APP_KEY: str = ""
    JOBDATAAPI_KEY: str = ""
    JOBDATAAPI_ENABLED: bool = False
    ALERT_INTERVAL_MIN: int = 15
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:3001"

    # --- Auth (Clerk/Firebase) — placeholder for Phase 2 ---
    AUTH_ENABLED: bool = False
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""

    # --- Rate limiting (simple in-memory) ---
    RATE_LIMIT_PER_MIN: int = 20

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
