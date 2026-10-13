"""
Async SQLAlchemy database engine and session factory.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

import socket
from pathlib import Path
from urllib.parse import urlparse
import structlog

logger = structlog.get_logger(__name__)

def normalize_db_url(url: str) -> str:
    """Normalize database URL to asyncpg driver for PostgreSQL."""
    if not url:
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _is_postgres_online(url: str) -> bool:
    try:
        clean_url = url
        for prefix in ["postgresql+asyncpg://", "postgresql://", "postgres://"]:
            if clean_url.startswith(prefix):
                clean_url = "http://" + clean_url[len(prefix):]
                break
        parsed = urlparse(clean_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        with socket.create_connection((host, port), timeout=3.0):
            return True
    except Exception as exc:
        logger.warning("PostgreSQL ping check failed", error=str(exc))
        return False


def _init_engine():
    raw_url = settings.DATABASE_URL
    db_url = normalize_db_url(raw_url)
    is_pg = any(db_url.startswith(p) for p in ("postgresql+asyncpg://", "postgresql://", "postgres://"))

    if is_pg and _is_postgres_online(db_url):
        logger.info("Connecting to PostgreSQL", url=db_url.split("@")[-1])
        return create_async_engine(
            db_url,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )

    if getattr(settings, "USE_SQLITE_FALLBACK", True):
        backend_dir = Path(__file__).resolve().parent.parent.parent
        db_path = backend_dir / "medicare.db"
        sqlite_url = settings.SQLITE_DB_URL or f"sqlite+aiosqlite:///{db_path.as_posix()}"
        logger.warning(
            "PostgreSQL is offline or unconfigured. Using SQLite fallback database.",
            db_path=str(db_path),
            sqlite_url=sqlite_url,
        )
        return create_async_engine(
            sqlite_url,
            echo=settings.DEBUG,
        )

    return create_async_engine(
        db_url,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

engine = _init_engine()

AsyncSessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:  # type: ignore[return]
    """FastAPI dependency — yields a database session."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
