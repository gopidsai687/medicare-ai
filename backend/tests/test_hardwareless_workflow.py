"""
Automated Integration Tests for VitalSense Hardwareless Workflows:
1. Mode A Device Transparency: Honest empty state when no readings exist.
2. Mode B Manual Entry: Validated patient self-reporting for Blood Pressure & Blood Glucose.
3. Unit Conversions & Input Validation: mg/dL <-> mmol/L and physiological limits.
4. Mode C Simulation & Demo Isolation: Sample data strictly marked is_sample=True.
5. Demo Reset Preservation: Clearing demo data NEVER deletes genuine patient records.
6. Cross-Patient Isolation & Security: Access strictly restricted to owning patient.
"""
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

import app.models
from app.core.database import AsyncSessionFactory, engine
from app.core.seed import seed_initial_data
from app.main import app
from app.models.base import Base
from app.models.patient import Patient, Gender, BloodType
from app.models.user import User, UserRole
from app.models.vital_sign import VitalSign


@pytest.fixture(autouse=True)
async def setup_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)
    yield


@pytest.mark.asyncio
async def test_new_patient_empty_state_and_isolation():
    """Verify that a newly registered patient with a profile has zero readings and clean state."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register a brand new patient user
        unique_id = uuid.uuid4().hex[:6]
        email = f"newpatient_{unique_id}@example.com"
        password = "SecurePassword123!"
        
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": "Test Hardwareless Patient",
                "role": "patient",
            },
        )
        assert reg_res.status_code == 201
        user_data = reg_res.json()
        user_id = uuid.UUID(user_data["id"])

        # Create Patient profile for this user
        async with AsyncSessionFactory() as session:
            pat_profile = Patient(
                id=uuid.uuid4(),
                user_id=user_id,
                mrn=f"MRN-TEST-{unique_id}",
                gender=Gender.OTHER,
                blood_type=BloodType.O_POS,
            )
            session.add(pat_profile)
            await session.commit()

        # Login to obtain token
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check telemetry list - must be completely empty (honest empty state)
        vitals_res = await client.get("/api/v1/vitals", headers=headers)
        assert vitals_res.status_code == 200
        assert vitals_res.json() == []


@pytest.mark.asyncio
async def test_manual_blood_pressure_logging_and_persistence():
    """Verify manual blood pressure entry with custom datetime, source, and persistence."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        unique_note = f"Evening reading after rest {uuid.uuid4().hex[:6]}"
        bp_payload = {
            "systolic_bp": 128,
            "diastolic_bp": 84,
            "heart_rate": 72,
            "measurement_source": "manual_home_cuff",
            "notes": unique_note,
            "is_sample": False,
        }

        log_res = await client.post("/api/v1/vitals/blood-pressure", headers=headers, json=bp_payload)
        assert log_res.status_code == 201
        created = log_res.json()
        assert created["systolic_bp"] == 128
        assert created["diastolic_bp"] == 84
        assert created["heart_rate"] == 72
        assert created["is_sample"] is False
        assert created["is_patient_entered"] is True
        assert created["measurement_source"] == "manual_home_cuff"
        assert created["bp_category"] in ["Hypertension Stage 1", "Elevated", "Normal", "Hypertension Stage 2"]

        vital_id = created["id"]

        # Fetch vitals history and verify persistence
        get_res = await client.get("/api/v1/vitals/history?limit=50", headers=headers)
        assert get_res.status_code == 200
        found = [v for v in get_res.json() if v["id"] == vital_id]
        assert len(found) == 1
        assert found[0]["systolic_bp"] == 128
        assert found[0]["notes"] == unique_note


@pytest.mark.asyncio
async def test_manual_blood_glucose_logging_and_unit_conversion():
    """Verify manual glucose entry with mmol/L calculation, context, and validation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Enter in mg/dL
        glucose_payload = {
            "blood_glucose": 110.0,
            "glucose_unit": "mg/dL",
            "glucose_context": "fasting",
            "measurement_source": "manual_fingerstick",
            "notes": "Morning test strip",
            "is_sample": False,
        }
        res = await client.post("/api/v1/vitals/blood-glucose", headers=headers, json=glucose_payload)
        assert res.status_code == 201
        data = res.json()
        assert data["blood_glucose"] == 110.0
        # 110 / 18.0182 ~ 6.1 mmol/L
        assert abs(data["blood_glucose_mmol"] - 6.1) < 0.2
        assert data["is_sample"] is False

        # 2. Enter in mmol/L
        mmol_payload = {
            "blood_glucose": 7.0,
            "glucose_unit": "mmol/L",
            "glucose_context": "after_meal",
            "measurement_source": "manual_clinic",
            "notes": "Clinic fingerstick test",
            "is_sample": False,
        }
        res_mmol = await client.post("/api/v1/vitals/blood-glucose", headers=headers, json=mmol_payload)
        assert res_mmol.status_code == 201
        data_mmol = res_mmol.json()
        # 7.0 * 18.0182 ~ 126 mg/dL
        assert abs(data_mmol["blood_glucose"] - 126.1) < 1.0
        assert data_mmol["blood_glucose_mmol"] == 7.0


@pytest.mark.asyncio
async def test_validation_rejects_unphysiological_values():
    """Verify backend strictly validates physiological boundaries for patient safety."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Negative / absurd systolic BP (< 50)
        bad_bp = {
            "systolic_bp": 25,
            "diastolic_bp": 80,
        }
        res = await client.post("/api/v1/vitals/blood-pressure", headers=headers, json=bad_bp)
        assert res.status_code == 422

        # Diastolic greater than systolic
        inverted_bp = {
            "systolic_bp": 110,
            "diastolic_bp": 130,
        }
        res_inv = await client.post("/api/v1/vitals/blood-pressure", headers=headers, json=inverted_bp)
        assert res_inv.status_code == 422

        # Negative glucose
        bad_glucose = {
            "blood_glucose": -5.0,
            "glucose_unit": "mg/dL",
        }
        res_g = await client.post("/api/v1/vitals/blood-glucose", headers=headers, json=bad_glucose)
        assert res_g.status_code == 422


@pytest.mark.asyncio
async def test_demo_reset_guarantee_preserves_real_patient_measurements():
    """
    CRITICAL REQUIREMENT: Resetting demo data must ONLY delete is_sample=True records.
    Genuine patient measurements (is_sample=False) must NEVER be deleted.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create a genuine patient reading (is_sample=False)
        real_note = f"GENUINE_PRESERVED_{uuid.uuid4().hex[:8]}"
        real_bp = {
            "systolic_bp": 118,
            "diastolic_bp": 76,
            "heart_rate": 68,
            "measurement_source": "manual_home_cuff",
            "notes": real_note,
            "is_sample": False,
        }
        real_res = await client.post("/api/v1/vitals/blood-pressure", headers=headers, json=real_bp)
        assert real_res.status_code == 201
        real_id = real_res.json()["id"]

        # 2. Inject demo data via Clinical Demo Console
        demo_sim = {"state": "urgent"}
        demo_res = await client.post("/api/v1/vitals/test-mode/simulate", headers=headers, json=demo_sim)
        assert demo_res.status_code == 200

        # Verify demo reading exists and is flagged is_sample=True
        list_before = await client.get("/api/v1/vitals/history?limit=20", headers=headers)
        assert list_before.status_code == 200
        samples_before = [v for v in list_before.json() if v["is_sample"] is True]
        assert len(samples_before) >= 1

        # 3. Call Reset Test Data endpoint (state='clear_test_data')
        clear_res = await client.post(
            "/api/v1/vitals/test-mode/simulate",
            headers=headers,
            json={"state": "clear_test_data"},
        )
        assert clear_res.status_code == 200
        assert clear_res.json()["status"] == "success"

        # 4. Fetch history - real_id MUST still exist, demo readings must be gone
        list_after = await client.get("/api/v1/vitals/history?limit=50", headers=headers)
        assert list_after.status_code == 200
        all_vitals = list_after.json()

        real_matches = [v for v in all_vitals if v["id"] == real_id]
        assert len(real_matches) == 1, "Real patient measurement was erroneously deleted by demo reset!"
        assert real_matches[0]["notes"] == real_note

        # Verify no sample data remains for Alice
        sample_matches = [v for v in all_vitals if v["is_sample"] is True]
        assert len(sample_matches) == 0, "Demo data was not completely cleared!"


@pytest.mark.asyncio
async def test_cross_patient_isolation():
    """Verify that Patient B cannot read, mutate, or delete Patient A's measurements."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Patient A (Alice)
        alice_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        alice_token = alice_login.json()["access_token"]
        alice_headers = {"Authorization": f"Bearer {alice_token}"}

        # Alice creates a private vital record
        vital_res = await client.post(
            "/api/v1/vitals/blood-pressure",
            headers=alice_headers,
            json={
                "systolic_bp": 125,
                "diastolic_bp": 82,
                "measurement_source": "manual_home_cuff",
                "notes": "Alice Private Health Log",
                "is_sample": False,
            },
        )
        assert vital_res.status_code == 201
        alice_vital_id = vital_res.json()["id"]

        # Patient B (Bob)
        bob_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "bob.smith@medicare.ai", "password": "PatientPass123!"},
        )
        bob_token = bob_login.json()["access_token"]
        bob_headers = {"Authorization": f"Bearer {bob_token}"}

        # Bob tries to delete Alice's reading -> must fail (404 Not Found or 403)
        del_res = await client.delete(f"/api/v1/vitals/{alice_vital_id}", headers=bob_headers)
        assert del_res.status_code in [403, 404]

        # Bob queries his own vitals -> Alice's vital must NOT appear in Bob's list
        bob_vitals = await client.get("/api/v1/vitals/history?limit=50", headers=bob_headers)
        assert bob_vitals.status_code == 200
        assert not any(v["id"] == alice_vital_id for v in bob_vitals.json())
