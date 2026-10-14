"""
Integration tests for MediCare AI:
- Clinical Alert Engine (Hypertensive Crisis, Hypoglycemia, Hypotension)
- Notification preferences and quiet hours
- Interactive Body Map telemetry endpoint
- Emergency Hospital Discovery & directions
- Doctor clinical alert queue & follow-up action logging
- Consolidated patient health timeline profile
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from httpx import ASGITransport, AsyncClient
import app.models
from app.core.database import AsyncSessionFactory, engine
from app.core.seed import seed_initial_data
from app.main import app
from app.models.base import Base
from sqlalchemy import text


@pytest.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)
    yield


@pytest.mark.asyncio
async def test_hypertensive_crisis_alert_trigger():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as patient Alice Johnson
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Post a reading in Hypertensive Crisis (> 180 / > 120)
        crisis_res = await client.post(
            "/api/v1/vitals/blood-pressure",
            headers=headers,
            json={
                "systolic_bp": 195,
                "diastolic_bp": 125,
                "heart_rate": 88,
                "measurement_source": "omron_connect",
                "notes": "Emergency reading test",
            },
        )
        assert crisis_res.status_code == 201
        data = crisis_res.json()
        assert data["bp_category"] == "Hypertensive Crisis"
        assert data.get("alert") is not None
        assert "Hypertensive Crisis" in data["alert"]["title"]
        assert "emergency" in data["alert"]["recommendation"].lower()

        # Query patient's in-app alerts
        alerts_res = await client.get("/api/v1/vitals/alerts", headers=headers)
        assert alerts_res.status_code == 200
        alerts = alerts_res.json()
        assert any("Hypertensive Crisis" in a["title"] for a in alerts)


@pytest.mark.asyncio
async def test_severe_hypoglycemia_alert_trigger():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Severe Hypoglycemia (< 54 mg/dL)
        hypo_res = await client.post(
            "/api/v1/vitals/blood-glucose",
            headers=headers,
            json={
                "blood_glucose": 48.0,
                "glucose_unit": "mg/dL",
                "glucose_context": "fasting",
                "measurement_source": "dexcom_cgm",
            },
        )
        assert hypo_res.status_code == 201
        data = hypo_res.json()
        assert "Severe Hypoglycemia" in data["glucose_category"]
        assert data.get("alert") is not None
        assert "Severe Hypoglycemia" in data["alert"]["title"]


@pytest.mark.asyncio
async def test_body_map_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.get("/api/v1/vitals/body-map", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "indicators" in data
        assert "cardiovascular" in data["indicators"]
        assert "metabolic" in data["indicators"]
        assert "disclaimer" in data or "educational_disclaimer" in data


@pytest.mark.asyncio
async def test_emergency_hospital_discovery():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Search with Geolocation coordinates (Chicago area)
        geo_res = await client.get(
            "/api/v1/vitals/emergency/hospitals",
            headers=headers,
            params={"latitude": 41.8781, "longitude": -87.6298, "radius_km": 25},
        )
        assert geo_res.status_code == 200
        geo_data = geo_res.json()
        hospitals = geo_data.get("facilities") or geo_data.get("hospitals") or []
        assert len(hospitals) > 0
        facility = hospitals[0]
        assert "directions_url" in facility
        assert facility["is_emergency_department"] is True
        assert geo_data.get("emergency_hotline") == "911" or "911" in str(geo_data.get("emergency_dispatch"))

        # 2. Search by text query
        query_res = await client.get(
            "/api/v1/vitals/emergency/hospitals",
            headers=headers,
            params={"query": "Houston, TX"},
        )
        assert query_res.status_code == 200
        query_data = query_res.json()
        assert len(query_data.get("facilities") or query_data.get("hospitals") or []) > 0


@pytest.mark.asyncio
async def test_notification_preferences():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get preferences
        get_res = await client.get("/api/v1/vitals/notifications/preferences", headers=headers)
        assert get_res.status_code == 200
        prefs = get_res.json()
        assert "quiet_hours_enabled" in prefs

        # Update quiet hours
        update_res = await client.put(
            "/api/v1/vitals/notifications/preferences",
            headers=headers,
            json={
                "quiet_hours_enabled": True,
                "quiet_hours_start": "23:00",
                "quiet_hours_end": "06:30",
                "bp_alerts_enabled": True,
                "glucose_alerts_enabled": True,
            },
        )
        assert update_res.status_code == 200
        assert update_res.json()["quiet_hours_enabled"] is True
        assert update_res.json()["quiet_hours_start"] == "23:00"

        # Test notification endpoint
        test_notif = await client.post("/api/v1/vitals/notifications/test", headers=headers)
        assert test_notif.status_code == 200


@pytest.mark.asyncio
async def test_health_profile_timeline():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.get("/api/v1/vitals/health-profile", headers=headers)
        assert res.status_code == 200
        profile = res.json()
        assert "patient" in profile
        assert profile["patient"]["email"] == "alice.johnson@medicare.ai"
        assert "timeline" in profile
        assert isinstance(profile["timeline"], list)


@pytest.mark.asyncio
async def test_doctor_alert_queue_and_action():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First trigger an alert as patient
        p_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        p_token = p_login.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        await client.post(
            "/api/v1/vitals/blood-pressure",
            headers=p_headers,
            json={
                "systolic_bp": 185,
                "diastolic_bp": 115,
                "measurement_source": "omron_connect",
            },
        )

        # Login as Doctor Sarah Chen
        d_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "sarah.chen@medicare.ai", "password": "DoctorPass123!"},
        )
        assert d_login.status_code == 200
        d_token = d_login.json()["access_token"]
        d_headers = {"Authorization": f"Bearer {d_token}"}

        # Query doctor alerts
        d_alerts_res = await client.get("/api/v1/vitals/doctor/alerts", headers=d_headers)
        assert d_alerts_res.status_code == 200
        d_alerts = d_alerts_res.json()
        assert len(d_alerts) > 0

        target_alert = d_alerts[0]
        # Document clinical follow-up action
        action_res = await client.post(
            f"/api/v1/vitals/doctor/alerts/{target_alert['id']}/action",
            headers=d_headers,
            json={
                "doctor_review_notes": "Contacted patient Alice; instructed to re-measure seated after 5 mins and report symptoms.",
                "follow_up_action": "contact_patient",
            },
        )
        assert action_res.status_code == 200
        action_data = action_res.json()
        assert action_data["status"] == "acknowledged"
        assert "Contacted patient Alice" in (action_data.get("doctor_review_notes") or action_data.get("clinical_notes") or "")
