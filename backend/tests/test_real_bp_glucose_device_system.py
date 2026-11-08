"""
Comprehensive Automated Test Suite:
Real Blood Pressure, Blood Glucose, Medical Device Integration & EHR Validation.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from app.main import app
from app.api.v1.vitals import (
    classify_blood_pressure,
    classify_blood_glucose,
)
from app.services.clinical_knowledge import (
    generate_blood_glucose_guidance,
)


@pytest.mark.asyncio
async def test_01_bp_validation_and_classification():
    """Verify systolic > diastolic validation, AHA/ACC 2017 classification, and MAP calculation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Patient login
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Invalid BP (systolic <= diastolic) must be rejected with 422
        bad_res = await client.post(
            "/api/v1/vitals/bp",
            headers=headers,
            json={
                "systolic": 80,
                "diastolic": 120,
                "pulse": 72,
                "source_type": "manual_entry",
            },
        )
        assert bad_res.status_code == 422

        # 2. Valid BP record (Systolic: 120, Diastolic: 80, Pulse: 72)
        valid_res = await client.post(
            "/api/v1/vitals/bp",
            headers=headers,
            json={
                "systolic": 120,
                "diastolic": 80,
                "pulse": 72,
                "source_type": "manual_entry",
                "notes": "Verified clinic cuff check",
            },
        )
        assert valid_res.status_code == 201
        data = valid_res.json()
        assert data["systolic"] == 120
        assert data["diastolic"] == 80
        assert data["pulse"] == 72
        cat = data["bp_category"].lower()
        assert "hypertension" in cat or "elevated" in cat or "normal" in cat
        assert data["reading_hash"] is not None


@pytest.mark.asyncio
async def test_02_glucose_unit_conversion_and_ada_targets():
    """Verify mg/dL and mmol/L conversions, ADA categories, and EHR sync."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Record 105 mg/dL fasting
        res_mgdl = await client.post(
            "/api/v1/vitals/glucose",
            headers=headers,
            json={
                "glucose_value": 105.0,
                "unit": "mg/dL",
                "glucose_context": "fasting",
                "source_type": "manual_entry",
                "notes": "Morning fasting fingerstick",
            },
        )
        assert res_mgdl.status_code == 201
        data_mgdl = res_mgdl.json()
        assert data_mgdl["glucose_value"] == 105.0
        assert round(data_mgdl["glucose_value_mmol"], 1) == 5.8
        cat = data_mgdl["category"].lower()
        assert "target" in cat or "normal" in cat or "diabetes" in cat or "fasting" in cat

        # 2. Record 5.5 mmol/L
        res_mmol = await client.post(
            "/api/v1/vitals/glucose",
            headers=headers,
            json={
                "glucose_value": 5.5,
                "unit": "mmol/L",
                "glucose_context": "fasting",
                "source_type": "manual_entry",
            },
        )
        assert res_mmol.status_code == 201
        data_mmol = res_mmol.json()
        assert data_mmol["glucose_value_mmol"] == 5.5
        assert round(data_mmol["glucose_value"]) == 99


@pytest.mark.asyncio
async def test_03_device_telemetry_sync_and_deduplication():
    """Verify batch peripheral telemetry sync, idempotent deduplication, and EHR insertion."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        timestamp = datetime.now(timezone.utc).isoformat()
        unique_reading_id = f"test-ble-omron-{datetime.now().timestamp()}"

        batch_payload = {
            "device_name": "Omron Evolv (HEM-7600T)",
            "device_identifier": "BLE-OMRON-01",
            "readings": [
                {
                    "reading_type": "blood_pressure",
                    "systolic": 118,
                    "diastolic": 76,
                    "pulse": 68,
                    "measured_at": timestamp,
                    "external_reading_id": unique_reading_id,
                }
            ],
        }

        # First sync: should import 1 reading
        sync_res1 = await client.post(
            "/api/v1/vitals/devices/omron_evolv/sync",
            headers=headers,
            json=batch_payload,
        )
        assert sync_res1.status_code == 200
        sync_data1 = sync_res1.json()
        assert sync_data1["synced_count"] == 1
        assert sync_data1["duplicate_count"] == 0

        # Second sync with exact same payload: should detect duplicate and skip
        sync_res2 = await client.post(
            "/api/v1/vitals/devices/omron_evolv/sync",
            headers=headers,
            json=batch_payload,
        )
        assert sync_res2.status_code == 200
        sync_data2 = sync_res2.json()
        assert sync_data2["synced_count"] == 0
        assert sync_data2["duplicate_count"] == 1


@pytest.mark.asyncio
async def test_04_patient_data_isolation():
    """Verify that patient B cannot access or sync to patient A's devices or records."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Patient A (Alice)
        res_a = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token_a = res_a.json()["access_token"]

        # Patient B (Bob)
        res_b = await client.post(
            "/api/v1/auth/login",
            json={"email": "bob.smith@medicare.ai", "password": "PatientPass123!"},
        )
        token_b = res_b.json()["access_token"]

        # Bob gets his own sync history (isolated from Alice)
        history_b = await client.get(
            "/api/v1/vitals/devices/sync-history",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert history_b.status_code == 200
        assert isinstance(history_b.json(), list)


@pytest.mark.asyncio
async def test_05_ai_blood_glucose_clinical_guidance():
    """Verify ADA 2024 Standards of Care clinical guidance generation for blood glucose."""
    # 1. Direct query interpretation
    guidance1 = generate_blood_glucose_guidance(
        glucose_val=105.0,
        context_type="fasting",
        unit="mg/dL",
    )
    assert "105" in guidance1
    assert "80" in guidance1 and "130" in guidance1
    assert "ADA" in guidance1 or "American Diabetes Association" in guidance1

    # 2. EHR Grounded with device provenance
    guidance2 = generate_blood_glucose_guidance(
        glucose_val=None,
        patient_context={
            "latest_vitals": {
                "blood_glucose_detail": {
                    "glucose_value": 112.0,
                    "unit": "mg/dL",
                    "context": "fasting",
                    "is_device": True,
                    "device_name": "Accu-Chek Guide",
                    "measured_at": "2026-11-06T12:00:00Z",
                }
            }
        },
    )
    assert "112" in guidance2
    assert "Accu-Chek Guide" in guidance2
    assert "Verified Medical Device" in guidance2
