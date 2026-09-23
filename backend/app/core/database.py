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

def _is_postgres_online(url: str) -> bool:
    try:
        clean_url = url.replace("postgresql+asyncpg://", "http://").replace("postgresql://", "http://")
        parsed = urlparse(clean_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        with socket.create_connection((host, port), timeout=0.8):
            return True
    except Exception:
        return False

def _init_engine():
    pg_online = _is_postgres_online(settings.DATABASE_URL)
    if pg_online:
        logger.info("Connecting to PostgreSQL", url=settings.DATABASE_URL.split("@")[-1])
        return create_async_engine(
            settings.DATABASE_URL,
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
            "PostgreSQL is offline. Using local SQLite fallback database.",
            db_path=str(db_path),
            sqlite_url=sqlite_url,
        )
        return create_async_engine(
            sqlite_url,
            echo=settings.DEBUG,
        )

    return create_async_engine(
        settings.DATABASE_URL,
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
