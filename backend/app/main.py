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


import socket
import threading
from sqlalchemy import text

def _start_ipv6_loopback_bridge(port: int = 8000):
    """
    On Windows, Chromium/Edge query IPv6 (::1) before IPv4 (127.0.0.1) for 'localhost'.
    If the server listens only on 127.0.0.1, every request stalls for ~2.5s on IPv6 SYN timeout.
    This bridge accepts IPv6 loopback connections on [::1]:port and pipes them to 127.0.0.1:port,
    ensuring near-instant (0.01s) loading on http://localhost:8000.
    """
    bridge_sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
    try:
        bridge_sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
        bridge_sock.bind(('::1', port))
        bridge_sock.listen(128)
    except Exception:
        bridge_sock.close()
        return None

    stop_event = threading.Event()

    def forward(src, dst):
        try:
            while not stop_event.is_set():
                data = src.recv(65536)
                if not data:
                    break
                dst.sendall(data)
        except Exception:
            pass
        finally:
            try:
                src.close()
            except Exception:
                pass
            try:
                dst.close()
            except Exception:
                pass

    def run_bridge():
        bridge_sock.settimeout(1.0)
        while not stop_event.is_set():
            try:
                c6, _ = bridge_sock.accept()
                c4 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                c4.connect(('127.0.0.1', port))
                threading.Thread(target=forward, args=(c6, c4), daemon=True).start()
                threading.Thread(target=forward, args=(c4, c6), daemon=True).start()
            except socket.timeout:
                continue
            except Exception:
                break
        try:
            bridge_sock.close()
        except Exception:
            pass

    t = threading.Thread(target=run_bridge, daemon=True)
    t.start()
    return stop_event

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown lifecycle."""
    log.info("MediCare API starting", environment=settings.ENVIRONMENT)
    bridge_stop = _start_ipv6_loopback_bridge(8000)
    
    # 1. Create tables and apply self-healing column migrations safely
    try:
        from app.core.migrations import run_schema_migrations
        await run_schema_migrations(engine)
        log.info("Database schema and tables verified")
    except Exception as e:
        log.error("Schema initialization encountered warning", error=str(e))
    try:
        async with AsyncSessionFactory() as session:
            await seed_initial_data(session)
    except Exception as e:
        log.warning("Seeding skipped or encountered error", error=str(e))
    yield
    log.info("MediCare API shutting down")
    if bridge_stop:
        bridge_stop.set()
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


# ── Health Endpoints ──────────────────────────────────────────────────────────
from datetime import datetime, timezone
from sqlalchemy import text

async def _perform_health_check():
    """Validates backend availability and database ping without exposing secrets."""
    db_status = "disconnected"
    try:
        async with AsyncSessionFactory() as session:
            await session.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception as e:
        log.warning("Health check database ping failed", error=str(e))
        db_status = "degraded"

    overall_status = "healthy" if db_status == "connected" else "degraded"
    return {
        "status": overall_status,
        "backend": "online",
        "database": db_status,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health", tags=["health"])
async def root_health_check():
    return await _perform_health_check()


@app.get("/api/health", tags=["health"])
async def api_health_check():
    return await _perform_health_check()


@app.get("/api/v1/health", tags=["health"])
async def api_v1_health_check():
    return await _perform_health_check()


# ── Static Files & SPA Frontend ───────────────────────────────────────────────
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

dist_candidates = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")),
    "/app/backend/static",
    "/app/static",
    "/app/frontend/dist",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "static")),
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

    NO_CACHE_HEADERS = {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            if full_path == "sw.js" or full_path.endswith(".html"):
                return FileResponse(file_path, headers=NO_CACHE_HEADERS)
            elif full_path.startswith("assets/"):
                return FileResponse(file_path, headers={"Cache-Control": "public, max-age=31536000, immutable"})
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"), headers=NO_CACHE_HEADERS)
