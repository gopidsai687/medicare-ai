"""
Automated verification tests for the Fingerprint-Themed VitalSense System,
Blood Glucose & Blood Pressure Monitoring, Smart Dashboard Summary, Device Integrations,
and Clinical Integrity Disclaimers.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_01_smart_dashboard_summary_and_disclaimer():
    """Verify GET /api/v1/vitals/dashboard-summary returns structured telemetry and medical disclaimer."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as patient
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Fetch dashboard summary
        res = await client.get("/api/v1/vitals/dashboard-summary", headers=headers)
        assert res.status_code == 200
        data = res.json()

        # Telemetry cards present
        assert "latest_glucose" in data
        assert "latest_blood_pressure" in data
        assert "latest_pulse" in data
        assert "weekly_averages" in data
        assert "monthly_averages" in data
        assert "clinical_disclaimer" in data

        # Check disclaimer explicitly mentions fingerprint/webcam cannot measure glucose or BP
        disclaimer = data["clinical_disclaimer"].lower()
        assert "fingerprint" in disclaimer
        assert "cannot measure" in disclaimer or "does not measure" in disclaimer or "non-diagnostic" in disclaimer


@pytest.mark.asyncio
async def test_02_manual_blood_pressure_logging_and_validation():
    """Verify blood pressure logging with systolic, diastolic, pulse, and rejection of invalid values."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Valid BP entry
        bp_payload = {
            "systolic_bp": 118,
            "diastolic_bp": 76,
            "heart_rate": 72,
            "measurement_source": "manual_entry",
            "notes": "Post-morning walk resting reading",
        }
        res = await client.post("/api/v1/vitals/blood-pressure", json=bp_payload, headers=headers)
        assert res.status_code == 201
        saved = res.json()
        assert saved["systolic_bp"] == 118
        assert saved["diastolic_bp"] == 76
        assert saved["bp_category"] == "Normal"

        # Invalid BP entry: Diastolic >= Systolic must be rejected
        invalid_bp = {
            "systolic_bp": 80,
            "diastolic_bp": 120,
            "heart_rate": 70,
            "measurement_source": "manual_entry",
        }
        inv_res = await client.post("/api/v1/vitals/blood-pressure", json=invalid_bp, headers=headers)
        assert inv_res.status_code == 422


@pytest.mark.asyncio
async def test_03_manual_blood_glucose_logging_and_unit_conversion():
    """Verify glucose logging with mg/dL and mmol/L automatic conversions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Entry in mg/dL
        res_mgdl = await client.post(
            "/api/v1/vitals/blood-glucose",
            json={
                "blood_glucose": 95.0,
                "glucose_unit": "mg/dL",
                "glucose_context": "fasting",
                "measurement_source": "manual_entry",
                "notes": "Fasting blood sugar before breakfast",
            },
            headers=headers,
        )
        assert res_mgdl.status_code == 201
        data_mgdl = res_mgdl.json()
        assert data_mgdl["blood_glucose"] == 95.0
        assert 5.2 <= data_mgdl["blood_glucose_mmol"] <= 5.4

        # Entry in mmol/L
        res_mmol = await client.post(
            "/api/v1/vitals/blood-glucose",
            json={
                "blood_glucose": 5.5,
                "glucose_unit": "mmol/L",
                "glucose_context": "after_meal",
                "measurement_source": "manual_entry",
                "notes": "2 hours postprandial",
            },
            headers=headers,
        )
        assert res_mmol.status_code == 201
        data_mmol = res_mmol.json()
        assert data_mmol["blood_glucose_mmol"] == 5.5
        assert 98.0 <= data_mmol["blood_glucose"] <= 101.0


@pytest.mark.asyncio
async def test_04_dedicated_bp_and_glucose_queries():
    """Verify GET /bp and GET /glucose return sorted historical readings."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Query BP history
        bp_res = await client.get("/api/v1/vitals/bp?days=30", headers=headers)
        assert bp_res.status_code == 200
        bp_list = bp_res.json()
        assert isinstance(bp_list, list)
        if len(bp_list) > 0:
            assert "systolic" in bp_list[0]
            assert "diastolic" in bp_list[0]
            assert "bp_category" in bp_list[0]

        # Query Glucose history
        glu_res = await client.get("/api/v1/vitals/glucose?days=30", headers=headers)
        assert glu_res.status_code == 200
        glu_list = glu_res.json()
        assert isinstance(glu_list, list)
        if len(glu_list) > 0:
            assert "glucose_value" in glu_list[0]
            assert "glucose_context" in glu_list[0]


@pytest.mark.asyncio
async def test_05_printable_pdf_export_endpoint():
    """Verify GET /api/v1/vitals/export-pdf produces printable HTML report."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.get("/api/v1/vitals/export-pdf?days=30", headers=headers)
        assert res.status_code == 200
        assert "text/html" in res.headers["content-type"]
        html = res.text
        assert "MediCare VitalSense" in html
        assert "Print / Save as PDF" in html
        assert "Clinical Integrity Notice" in html


@pytest.mark.asyncio
async def test_06_medical_device_registration_and_unpairing():
    """Verify medical device pairing and removal."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Register device
        reg_payload = {
            "device_name": "Omron Evolv BP7000",
            "device_type": "blood_pressure_monitor",
            "manufacturer": "Omron Healthcare",
            "model_number": "BP7000",
            "connection_protocol": "bluetooth_le",
            "notes": "Upper-arm wireless blood pressure cuff",
        }
        reg_res = await client.post("/api/v1/vitals/devices", json=reg_payload, headers=headers)
        assert reg_res.status_code == 201
        device = reg_res.json()
        device_id = device["id"]
        assert device["device_name"] == "Omron Evolv BP7000"
        assert device["status"] == "paired"

        # 2. List devices
        list_res = await client.get("/api/v1/vitals/devices", headers=headers)
        assert list_res.status_code == 200
        devices = list_res.json()
        assert any(d["id"] == device_id for d in devices)

        # 3. Unpair device
        del_res = await client.delete(f"/api/v1/vitals/devices/{device_id}", headers=headers)
        assert del_res.status_code == 204
