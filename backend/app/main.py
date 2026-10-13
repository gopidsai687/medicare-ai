"""
MediCare — FastAPI application entry point.
"""
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.database import engine, AsyncSessionFactory
from app.core.seed import seed_initial_data
from app.models.base import Base
from app.api.v1 import (
    auth, users, appointments, records, prescriptions, vitals,
    encounters, mpi, audit_logs, ai, labs, departments, patients,
    prescription_analysis, medical_report_analysis,
)

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    log.info("MediCare API starting", environment=settings.ENVIRONMENT)
    # Create tables (dev convenience — production uses Alembic migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("Database tables ready")
    try:
        async with AsyncSessionFactory() as session:
            await seed_initial_data(session)
    except Exception as e:
        log.warning("Seeding skipped or encountered error", error=str(e))
    yield
    log.info("MediCare API shutting down")
    await engine.dispose()


app = FastAPI(
    title="MediCare API",
    description="Healthcare management platform — Patient, Doctor, and Admin portals.",
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Trusted Hosts ─────────────────────────────────────────────────────────────
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(records.router, prefix="/api/v1")
app.include_router(prescriptions.router, prefix="/api/v1")
app.include_router(vitals.router, prefix="/api/v1")
app.include_router(encounters.router, prefix="/api/v1")
app.include_router(mpi.router, prefix="/api/v1")
app.include_router(audit_logs.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(labs.router, prefix="/api/v1")
app.include_router(departments.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(prescription_analysis.router, prefix="/api/v1")
app.include_router(medical_report_analysis.router, prefix="/api/v1")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION, "env": settings.ENVIRONMENT}


# ── Static Files & SPA Frontend ───────────────────────────────────────────────
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

dist_candidates = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static")),
    os.path.abspath("static"),
    os.path.abspath("frontend/dist"),
    os.path.abspath("../frontend/dist"),
]

frontend_dist = None
for candidate in dist_candidates:
    if os.path.exists(candidate) and os.path.isfile(os.path.join(candidate, "index.html")):
        frontend_dist = candidate
        break

if frontend_dist:
    log.info("Serving frontend static bundle", path=frontend_dist)
    assets_path = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
