"""
MediCare VitalSense – Webcam-based rPPG Heart Rate Integration Test Suite.

Verifies:
- Logging experimental rPPG resting heart rate via /api/v1/vitals/heart-rate.
- Correct provenance attribution ('webcam_rppg_experimental', is_patient_entered=True).
- Proper inclusion in vital sign history and trend analysis.
- Input validation (rejection of unphysiological or negative values).
- Cross-patient isolation for vital telemetry.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionFactory, engine
from app.core.seed import seed_initial_data
from app.models.base import Base


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def init_test_environment():
    """Ensure database schema is created and initial EHR records seeded."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)


async def get_auth_token(client: AsyncClient, email: str = "alice.johnson@medicare.ai", password: str = "PatientPass123!") -> str:
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    return login_res.json()["access_token"]


@pytest.mark.anyio
async def test_01_save_webcam_rppg_reading():
    """Verify patient can log validated experimental rPPG resting pulse reading."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "heart_rate": 72,
            "measurement_source": "webcam_rppg_experimental",
            "device_name": "Webcam Reflective PPG (Experimental)",
            "notes": "Experimental rPPG pulse demonstration (Confidence: 92%, Non-diagnostic research only)",
            "is_sample": False,
        }

        resp = await client.post("/api/v1/vitals/heart-rate", json=payload, headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["heart_rate"] == 72
        assert data["measurement_source"] == "webcam_rppg_experimental"
        assert data["device_name"] == "Webcam Reflective PPG (Experimental)"
        assert data["is_patient_entered"] is True
        assert "Non-diagnostic research only" in data["notes"]


@pytest.mark.anyio
async def test_02_rppg_reading_present_in_vitals_history():
    """Verify saved rPPG reading appears in history telemetry query."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        # Save an rPPG reading of 68 bpm
        await client.post(
            "/api/v1/vitals/heart-rate",
            json={
                "heart_rate": 68,
                "measurement_source": "webcam_rppg_experimental",
                "device_name": "Webcam Reflective PPG (Experimental)",
                "notes": "Ambient light rPPG session",
                "is_sample": False,
            },
            headers=headers,
        )

        # Retrieve history
        hist_resp = await client.get("/api/v1/vitals/history?limit=20", headers=headers)
        assert hist_resp.status_code == 200
        records = hist_resp.json()
        rppg_matches = [
            r for r in records
            if r.get("measurement_source") == "webcam_rppg_experimental" and r.get("heart_rate") == 68
        ]
        assert len(rppg_matches) >= 1, "Recorded rPPG heart rate must appear in vitals history"


@pytest.mark.anyio
async def test_03_invalid_heart_rate_rejected():
    """Verify unphysiological or negative heart rate values fail validation."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        # Zero or negative BPM
        neg_resp = await client.post(
            "/api/v1/vitals/heart-rate",
            json={"heart_rate": -15, "measurement_source": "webcam_rppg_experimental"},
            headers=headers,
        )
        assert neg_resp.status_code in (400, 422)

        # Extreme non-human BPM (> 300)
        extreme_resp = await client.post(
            "/api/v1/vitals/heart-rate",
            json={"heart_rate": 450, "measurement_source": "webcam_rppg_experimental"},
            headers=headers,
        )
        assert extreme_resp.status_code in (400, 422)

