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
    prescription_analysis, medical_report_analysis, devices,
)

log = structlog.get_logger(__name__)


from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    log.info("MediCare API starting", environment=settings.ENVIRONMENT)
    
    # 1. Create tables safely
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        log.info("Database Base.metadata.create_all completed")
    except Exception as e:
        log.error("Table creation encountered error (continuing startup)", error=str(e))

    # 2. Self-healing column additions with individual transaction isolation
    try:
        def get_existing_columns(sync_conn, table_name: str) -> set:
            from sqlalchemy import inspect
            inspector = inspect(sync_conn)
            if not inspector.has_table(table_name):
                return set()
            return {c["name"] for c in inspector.get_columns(table_name)}

        async with engine.connect() as check_conn:
            # Vital signs columns
            existing_vital_cols = await check_conn.run_sync(get_existing_columns, "vital_signs")
            cols_to_add = [
                ("measurement_source", "VARCHAR(50) DEFAULT 'manual_entry' NOT NULL"),
                ("device_name", "VARCHAR(100)"),
                ("blood_glucose_mmol", "FLOAT"),
                ("glucose_unit", "VARCHAR(10) DEFAULT 'mg/dL' NOT NULL"),
                ("glucose_context", "VARCHAR(50) DEFAULT 'fasting'"),
                ("notes", "VARCHAR(500)"),
                ("clinical_notes", "VARCHAR(1000)"),
                ("is_patient_entered", "BOOLEAN DEFAULT TRUE NOT NULL"),
                ("is_sample", "BOOLEAN DEFAULT FALSE NOT NULL"),
            ]
            for col_name, col_def in cols_to_add:
                if col_name not in existing_vital_cols:
                    try:
                        async with engine.begin() as alter_conn:
                            await alter_conn.execute(text(f"ALTER TABLE vital_signs ADD COLUMN {col_name} {col_def}"))
                        log.info("Added self-healing column", table="vital_signs", column=col_name)
                    except Exception as err:
                        log.warning("Column addition skipped", table="vital_signs", column=col_name, error=str(err))

            # Vital alerts columns
            existing_alert_cols = await check_conn.run_sync(get_existing_columns, "vital_alerts")
            alert_cols = [
                ("doctor_review_notes", "VARCHAR(1000)"),
                ("follow_up_action", "VARCHAR(500)"),
                ("actioned_by_id", "VARCHAR(36)"),
                ("actioned_at", "TIMESTAMP"),
            ]
            for col_name, col_def in alert_cols:
                if col_name not in existing_alert_cols:
                    try:
                        async with engine.begin() as alter_conn:
                            await alter_conn.execute(text(f"ALTER TABLE vital_alerts ADD COLUMN {col_name} {col_def}"))
                        log.info("Added self-healing column", table="vital_alerts", column=col_name)
                    except Exception as err:
                        log.warning("Column addition skipped", table="vital_alerts", column=col_name, error=str(err))
    except Exception as exc:
        log.warning("Self-healing schema migration warning", error=str(exc))

    log.info("Database tables and columns verified")
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
app.include_router(devices.router, prefix="/api/v1")


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
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "static")),
    os.path.abspath("static"),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "dist")),
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
