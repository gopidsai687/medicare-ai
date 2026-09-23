"""
Application configuration — reads from environment / .env file.
"""
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "MediCare"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://medicare_user:medicare_dev_password@localhost:5432/medicare_db"
    )
    DATABASE_URL_SYNC: str = (
        "postgresql://medicare_user:medicare_dev_password@localhost:5432/medicare_db"
    )
    # SQLite fallback for local development
    USE_SQLITE_FALLBACK: bool = True
    SQLITE_DB_URL: str = ""

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET: str = "change-me-in-production-super-secret-jwt-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── AI ────────────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-pro"
    GEMINI_MAX_TOKENS: int = 8192

    # ── Security ──────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS_RAW: str = "http://localhost:5173,http://localhost:3000"
    ALLOWED_HOSTS_RAW: str = "localhost,127.0.0.1"
    SECRET_KEY: str = "change-me-in-production"
    BCRYPT_ROUNDS: int = 12

    # ── Feature Flags ─────────────────────────────────────────────────────────
    ENABLE_AI: bool = True
    ENABLE_RAG: bool = True
    ENABLE_ML: bool = False

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS_RAW.split(",") if o.strip()]

    @property
    def ALLOWED_HOSTS(self) -> List[str]:
        return [h.strip() for h in self.ALLOWED_HOSTS_RAW.split(",") if h.strip()]


settings = Settings()
