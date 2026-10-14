"""
Integration and security tests for MediCare VitalSense:
- Blood pressure logging and AHA 2017 classification
- Blood glucose logging, ADA context, and bidirectional unit conversion
- Deterministic trend analysis, MAP calculation, and Time-in-Range
- Device batch import (Omron, Dexcom)
- Secure CSV and JSON export
- Reminders CRUD
- Patient isolation and Doctor consent authorization enforcement
"""
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from httpx import ASGITransport, AsyncClient
import app.models
from app.core.database import AsyncSessionFactory, engine
from app.core.seed import seed_initial_data
from app.main import app
from app.models.base import Base
from app.models.vital_sign import VitalSign, VitalSharingConsent
from sqlalchemy import select, text


@pytest.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        cols_to_add = [
            ("measurement_source", "VARCHAR(50) DEFAULT 'manual_entry'"),
            ("device_name", "VARCHAR(100)"),
            ("blood_glucose_mmol", "FLOAT"),
            ("glucose_unit", "VARCHAR(10) DEFAULT 'mg/dL'"),
            ("glucose_context", "VARCHAR(50) DEFAULT 'fasting'"),
            ("notes", "VARCHAR(500)"),
            ("clinical_notes", "VARCHAR(1000)"),
            ("is_patient_entered", "BOOLEAN DEFAULT 1"),
            ("is_sample", "BOOLEAN DEFAULT 0"),
        ]
        for col_name, col_def in cols_to_add:
            try:
                await conn.execute(text(f"ALTER TABLE vital_signs ADD COLUMN {col_name} {col_def}"))
            except Exception:
                pass
    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)
    yield


@pytest.mark.asyncio
async def test_blood_pressure_logging_and_categories():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as Alice Johnson
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Log normal blood pressure
        bp_normal = await client.post(
            "/api/v1/vitals/blood-pressure",
            headers=headers,
            json={
                "systolic_bp": 115,
                "diastolic_bp": 75,
                "heart_rate": 68,
                "measurement_source": "manual_entry",
                "notes": "Resting morning check",
            },
        )
        assert bp_normal.status_code == 201
        data = bp_normal.json()
        assert data["systolic_bp"] == 115
        assert data["diastolic_bp"] == 75
        assert data["bp_category"] == "Normal"
        assert data["mean_arterial_pressure"] == round(75 + (115 - 75) / 3.0, 1)

        # 3. Log Stage 2 hypertension
        bp_stage2 = await client.post(
            "/api/v1/vitals/blood-pressure",
            headers=headers,
            json={
                "systolic_bp": 145,
                "diastolic_bp": 92,
                "measurement_source": "omron_connect",
                "device_name": "Omron BP7000",
            },
        )
        assert bp_stage2.status_code == 201
        assert bp_stage2.json()["bp_category"] == "Hypertension Stage 2"

        # 4. Invalid BP: diastolic >= systolic must fail validation
        bp_invalid = await client.post(
            "/api/v1/vitals/blood-pressure",
            headers=headers,
            json={
                "systolic_bp": 110,
                "diastolic_bp": 120,
            },
        )
        assert bp_invalid.status_code == 422


@pytest.mark.asyncio
async def test_blood_glucose_logging_and_conversion():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Log in mg/dL (fasting)
        res_mgdl = await client.post(
            "/api/v1/vitals/blood-glucose",
            headers=headers,
            json={
                "blood_glucose": 95.0,
                "glucose_unit": "mg/dL",
                "glucose_context": "fasting",
                "measurement_source": "manual_entry",
            },
        )
        assert res_mgdl.status_code == 201
        data_mgdl = res_mgdl.json()
        assert data_mgdl["blood_glucose"] == 95.0
        assert data_mgdl["blood_glucose_mmol"] == round(95.0 / 18.0182, 2)
        assert data_mgdl["glucose_category"] == "Normal Fasting"

        # 2. Log in mmol/L (postprandial)
        res_mmol = await client.post(
            "/api/v1/vitals/blood-glucose",
            headers=headers,
            json={
                "blood_glucose": 7.0,
                "glucose_unit": "mmol/L",
                "glucose_context": "after_meal",
                "measurement_source": "dexcom_cgm",
            },
        )
        assert res_mmol.status_code == 201
        data_mmol = res_mmol.json()
        assert data_mmol["blood_glucose_mmol"] == 7.0
        assert data_mmol["blood_glucose"] == round(7.0 * 18.0182, 1)
        assert data_mmol["glucose_category"] == "Normal Post-meal"

        # 3. Log hypoglycemia (<70 mg/dL)
        res_hypo = await client.post(
            "/api/v1/vitals/blood-glucose",
            headers=headers,
            json={
                "blood_glucose": 55.0,
                "glucose_unit": "mg/dL",
                "glucose_context": "fasting",
            },
        )
        assert res_hypo.status_code == 201
        assert "Hypoglycemia" in res_hypo.json()["glucose_category"]


@pytest.mark.asyncio
async def test_vital_sign_edit_and_delete():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create weight entry
        create_res = await client.post(
            "/api/v1/vitals/weight",
            headers=headers,
            json={"weight": 65.0, "notes": "Initial weigh-in"},
        )
        assert create_res.status_code == 201
        vital_id = create_res.json()["id"]

        # Edit entry
        update_res = await client.put(
            f"/api/v1/vitals/{vital_id}",
            headers=headers,
            json={"weight": 64.6, "notes": "Corrected calibration"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["weight"] == 64.6
        assert update_res.json()["notes"] == "Corrected calibration"

        # Delete entry
        del_res = await client.delete(f"/api/v1/vitals/{vital_id}", headers=headers)
        assert del_res.status_code == 204

        # Verify gone
        get_res = await client.get("/api/v1/vitals", headers=headers)
        vital_ids = [v["id"] for v in get_res.json()]
        assert vital_id not in vital_ids


@pytest.mark.asyncio
async def test_device_batch_import_and_export():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Import 2 records from Apple Health
        now_iso = datetime.now(timezone.utc).isoformat()
        import_res = await client.post(
            "/api/v1/vitals/import",
            headers=headers,
            json={
                "source": "apple_health",
                "device_name": "Apple Watch Series 9",
                "readings": [
                    {
                        "recorded_at": now_iso,
                        "systolic_bp": 121,
                        "diastolic_bp": 79,
                        "heart_rate": 72,
                    },
                    {
                        "recorded_at": now_iso,
                        "blood_glucose": 105.0,
                        "glucose_unit": "mg/dL",
                        "glucose_context": "before_meal",
                    },
                ],
            },
        )
        assert import_res.status_code == 200
        assert import_res.json()["imported_count"] == 2

        # Test CSV export
        export_csv = await client.get("/api/v1/vitals/export?format=csv", headers=headers)
        assert export_csv.status_code == 200
        assert "text/csv" in export_csv.headers["content-type"]
        assert "Systolic BP (mmHg)" in export_csv.text

        # Test JSON export
        export_json = await client.get("/api/v1/vitals/export?format=json", headers=headers)
        assert export_json.status_code == 200
        assert isinstance(export_json.json(), list)


@pytest.mark.asyncio
async def test_vital_trend_analysis():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        analyze_res = await client.post(
            "/api/v1/vitals/analyze-trends",
            headers=headers,
            json={"days": 30, "measurement_type": "all"},
        )
        assert analyze_res.status_code == 200
        data = analyze_res.json()
        assert data["period_days"] == 30
        assert data["total_measurements"] > 0
        assert "stats" in data
        assert "average_systolic" in data["stats"]
        assert "mean_arterial_pressure" in data["stats"]
        assert len(data["observations"]) > 0
        assert len(data["suggested_doctor_questions"]) > 0
        assert "clinical_safety_notice" in data


@pytest.mark.asyncio
async def test_doctor_portal_consent_and_authorization():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Doctor login
        doc_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "sarah.chen@medicare.ai", "password": "DoctorPass123!"},
        )
        doc_token = doc_login.json()["access_token"]
        doc_headers = {"Authorization": f"Bearer {doc_token}"}

        # Get authorized patients list
        doc_patients_res = await client.get("/api/v1/vitals/doctor/patients", headers=doc_headers)
        assert doc_patients_res.status_code == 200
        patients = doc_patients_res.json()
        assert len(patients) > 0
        alice = patients[0]
        alice_id = alice["patient_id"]

        # View Alice's vitals
        vitals_res = await client.get(f"/api/v1/vitals/doctor/patients/{alice_id}", headers=doc_headers)
        assert vitals_res.status_code == 200
        vitals_list = vitals_res.json()
        assert len(vitals_list) > 0

        # Doctor adds clinical note
        first_vital_id = vitals_list[0]["id"]
        note_res = await client.post(
            f"/api/v1/vitals/doctor/patients/{alice_id}/vitals/{first_vital_id}/notes",
            headers=doc_headers,
            json={"clinical_notes": "Telemetry reviewed. Blood pressure well controlled."},
        )
        assert note_res.status_code == 200
        assert "Telemetry reviewed" in note_res.json()["clinical_notes"]

        # Unauthorized access test: create a random patient ID without consent
        random_pat_id = str(uuid.uuid4())
        forbidden_res = await client.get(
            f"/api/v1/vitals/doctor/patients/{random_pat_id}", headers=doc_headers
        )
        assert forbidden_res.status_code == 403


@pytest.mark.asyncio
async def test_reminders_crud():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create reminder
        create_res = await client.post(
            "/api/v1/vitals/reminders",
            headers=headers,
            json={
                "reminder_type": "heart_rate",
                "label": "Evening Pulse Check",
                "time_of_day": "09:00 PM",
                "frequency": "daily",
                "is_active": True,
            },
        )
        assert create_res.status_code == 201
        rem_id = create_res.json()["id"]

        # Toggle reminder
        update_res = await client.put(
            f"/api/v1/vitals/reminders/{rem_id}",
            headers=headers,
            json={"is_active": False},
        )
        assert update_res.status_code == 200
        assert update_res.json()["is_active"] is False

        # Delete reminder
        del_res = await client.delete(f"/api/v1/vitals/reminders/{rem_id}", headers=headers)
        assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_vitalsense_test_mode_simulation():
    """Verify clinical test state simulations for demo & testing without real data contamination."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test Normal state simulation
        norm_res = await client.post(
            "/api/v1/vitals/test-mode/simulate",
            headers=headers,
            json={"state": "normal"},
        )
        assert norm_res.status_code == 200
        norm_data = norm_res.json()
        assert norm_data["status"] == "success"
        assert norm_data["vital"]["is_sample"] is True
        assert norm_data["vital"]["measurement_source"] == "SAMPLE_DATA"
        assert norm_data["vital"]["bp_category"] == "Normal"

        # 2. Test Attention state simulation
        att_res = await client.post(
            "/api/v1/vitals/test-mode/simulate",
            headers=headers,
            json={"state": "attention"},
        )
        assert att_res.status_code == 200
        att_data = att_res.json()
        assert att_data["vital"]["bp_category"] in ("Hypertension Stage 1", "Elevated")
        assert att_data["vital"]["is_sample"] is True

        # 3. Test Urgent crisis simulation & Alert explanations
        urg_res = await client.post(
            "/api/v1/vitals/test-mode/simulate",
            headers=headers,
            json={"state": "urgent"},
        )
        assert urg_res.status_code == 200
        urg_data = urg_res.json()
        assert urg_data["vital"]["bp_category"] == "Hypertensive Crisis"
        assert urg_data["alerts_triggered"] > 0

        # Check that alerts explain what triggered them and when
        alerts_res = await client.get("/api/v1/vitals/alerts?status=active", headers=headers)
        assert alerts_res.status_code == 200
        active_alerts = alerts_res.json()
        assert len(active_alerts) > 0
        crisis_alert = next((a for a in active_alerts if a["severity"] in ("critical", "crisis", "urgent")), None)
        assert crisis_alert is not None
        assert "message" in crisis_alert and len(crisis_alert["message"]) > 0
        assert "created_at" in crisis_alert and crisis_alert["created_at"] is not None

        # Verify Body Map reflects urgent crisis
        bm_res = await client.get("/api/v1/vitals/body-map", headers=headers)
        assert bm_res.status_code == 200
        bm_data = bm_res.json()
        assert bm_data["indicators"]["cardiovascular"]["status"] == "urgent"
        assert "Hypertensive Crisis" in bm_data["indicators"]["cardiovascular"]["headline"]

        # 4. Test Stale data simulation (14 days old)
        stale_res = await client.post(
            "/api/v1/vitals/test-mode/simulate",
            headers=headers,
            json={"state": "stale"},
        )
        assert stale_res.status_code == 200
        stale_data = stale_res.json()
        assert stale_data["vital"]["is_sample"] is True

        # 5. Test Editing a vital reading (PUT /vitals/{id})
        vital_id = urg_data["vital"]["id"]
        edit_res = await client.put(
            f"/api/v1/vitals/{vital_id}",
            headers=headers,
            json={"systolic_bp": 118, "diastolic_bp": 76, "notes": "Corrected reading"},
        )
        assert edit_res.status_code == 200
        assert edit_res.json()["systolic_bp"] == 118
        assert edit_res.json()["bp_category"] == "Normal"

        # 6. Test Clearing test data (missing-data validation)
        clear_res = await client.post(
            "/api/v1/vitals/test-mode/simulate",
            headers=headers,
            json={"state": "clear_test_data"},
        )
        assert clear_res.status_code == 200
        assert clear_res.json()["state"] == "clear_test_data"
        assert clear_res.json()["deleted_count"] >= 1


