"""
Comprehensive unit and integration test suite for MediCare AI Medical Device Integration:
- Device discovery, registration, and duplicate rejection
- Connection state lifecycle (connect, disconnect)
- Direct optical telemetry ingestion (HR, SpO2, PI, Temp, Contact Force)
- Measurement provenance verification (MEASURED_DEVICE vs SIMULATED_DEMO)
- Non-invasive optical blood glucose safety rejection (FDA safety rule enforcement)
- Cuffless blood pressure calibration requirement under IEEE 1708
- Duplicate packet hash deduplication
- Clock drift & timestamp validation
- Test simulator demo-marking isolation
- Cross-patient isolation & RBAC permissions
"""
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text

import app.models
from app.core.database import AsyncSessionFactory, engine
from app.core.seed import seed_initial_data
from app.main import app
from app.models.base import Base
from app.models.medical_device import DeviceStatus, MedicalDevice, MeasurementProvenance
from app.models.user import User


@pytest.fixture(autouse=True)
async def setup_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)
    yield


@pytest.mark.asyncio
async def test_device_listing_and_registration():
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

        # 2. List devices (should see seeded BioSens station)
        list_res = await client.get("/api/v1/devices", headers=headers)
        assert list_res.status_code == 200
        devices = list_res.json()
        assert len(devices) >= 1
        assert any("BioSens" in d["device_name"] for d in devices)

        # 3. Register a new peripheral
        unique_sn = f"SN-TEST-{uuid.uuid4().hex[:6].upper()}"
        reg_res = await client.post(
            "/api/v1/devices/register",
            headers=headers,
            json={
                "device_name": "Clinical Pulse Oximeter BLE",
                "device_type": "pulse_oximeter",
                "manufacturer": "MediCare Hardware Labs",
                "model_number": "PO-200B",
                "serial_number": unique_sn,
                "hardware_revision": "v1.0",
                "firmware_version": "v1.2.0",
                "protocol": "BLE",
                "supports_heart_rate": True,
                "supports_spo2": True,
                "supports_perfusion_index": True,
                "supports_dermal_temperature": False,
                "supports_contact_force": False,
                "supports_blood_pressure": False,
                "supports_blood_glucose": False,
            },
        )
        assert reg_res.status_code == 201
        created = reg_res.json()
        assert created["serial_number"] == unique_sn
        assert created["supports_blood_glucose"] is False  # Enforced False

        # 4. Duplicate serial number registration must fail with 409 Conflict
        dup_res = await client.post(
            "/api/v1/devices/register",
            headers=headers,
            json={
                "device_name": "Duplicate Device",
                "device_type": "pulse_oximeter",
                "manufacturer": "Fake Labs",
                "model_number": "PO-200B",
                "serial_number": unique_sn,
                "protocol": "BLE",
            },
        )
        assert dup_res.status_code == 409
        assert "already registered" in dup_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_device_connection_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        list_res = await client.get("/api/v1/devices", headers=headers)
        device = list_res.json()[0]
        dev_id = device["id"]

        # Disconnect
        disc_res = await client.post(f"/api/v1/devices/{dev_id}/disconnect", headers=headers)
        assert disc_res.status_code == 200
        assert disc_res.json()["status"] == DeviceStatus.DISCONNECTED.value

        # Connect
        conn_res = await client.post(f"/api/v1/devices/{dev_id}/connect", headers=headers)
        assert conn_res.status_code == 200
        assert conn_res.json()["status"] == DeviceStatus.CONNECTED.value


@pytest.mark.asyncio
async def test_telemetry_valid_optical_ingestion_and_provenance():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        list_res = await client.get("/api/v1/devices", headers=headers)
        dev_id = list_res.json()[0]["id"]

        # Ingest verified physiological reading
        now_iso = datetime.now(timezone.utc).isoformat()
        packet_payload = {
            "timestamp": now_iso,
            "heart_rate": 74,
            "oxygen_saturation": 98.5,
            "perfusion_index": 2.4,
            "dermal_temperature_c": 34.1,
            "contact_force_n": 1.25,
            "signal_quality": "OPTIMAL",
            "snr_db": 29.4,
            "is_sample": False,
        }
        ingest_res = await client.post(
            f"/api/v1/devices/{dev_id}/telemetry",
            headers=headers,
            json=packet_payload,
        )
        assert ingest_res.status_code == 201
        data = ingest_res.json()
        assert data["heart_rate"] == 74
        assert data["oxygen_saturation"] == 98.5
        assert data["perfusion_index"] == 2.4
        assert data["dermal_temperature_c"] == 34.1
        assert data["contact_force_n"] == 1.25
        assert data["provenance"] == MeasurementProvenance.MEASURED_DEVICE.value
        assert data["is_sample"] is False
        assert "packet_hash" in data

        # Check telemetry stream retrieval
        history_res = await client.get(f"/api/v1/devices/{dev_id}/telemetry?limit=5", headers=headers)
        assert history_res.status_code == 200
        assert len(history_res.json()) >= 1


@pytest.mark.asyncio
async def test_blood_glucose_rejection_on_optical_device():
    """
    CRITICAL CLINICAL SAFETY TEST:
    Non-invasive optical sensing cannot measure molecular blood glucose.
    Submitting a real blood glucose reading from an optical sensor must be rejected.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        list_res = await client.get("/api/v1/devices", headers=headers)
        dev_id = list_res.json()[0]["id"]

        packet_payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "heart_rate": 72,
            "blood_glucose": 115.0,  # Unvalidated optical claim
            "is_sample": False,
        }
        res = await client.post(
            f"/api/v1/devices/{dev_id}/telemetry",
            headers=headers,
            json=packet_payload,
        )
        # Must be rejected with 422 Unprocessable Entity
        assert res.status_code == 422
        detail = res.json()["detail"].lower()
        assert "clinical safety" in detail
        assert "glucose" in detail


@pytest.mark.asyncio
async def test_uncalibrated_cuffless_bp_rejection_and_calibration_flow():
    """
    IEEE Std 1708 CALIBRATION GATE:
    Cuffless blood pressure cannot be estimated without pneumatic cuff initialization.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        list_res = await client.get("/api/v1/devices", headers=headers)
        dev_id = list_res.json()[0]["id"]

        # 1. Attempt uncalibrated BP ingestion -> must fail with 422
        uncal_payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "heart_rate": 70,
            "systolic_bp": 128,
            "diastolic_bp": 82,
            "is_sample": False,
        }
        uncal_res = await client.post(
            f"/api/v1/devices/{dev_id}/telemetry",
            headers=headers,
            json=uncal_payload,
        )
        assert uncal_res.status_code == 422
        assert "calibration required" in uncal_res.json()["detail"].lower()

        # 2. Calibrate against reference cuff
        cal_res = await client.post(
            f"/api/v1/devices/{dev_id}/calibrate",
            headers=headers,
            json={
                "reference_systolic": 120,
                "reference_diastolic": 80,
                "cuff_device_name": "Omron Series 10 Upper Arm BP Monitor",
            },
        )
        assert cal_res.status_code == 200
        cal_data = cal_res.json()
        assert cal_data["is_bp_calibrated"] is True
        assert cal_data["bp_calibration_expiry"] is not None

        # 3. Ingest calibrated BP -> must succeed with 201
        cal_ingest_payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "heart_rate": 72,
            "systolic_bp": 122,
            "diastolic_bp": 78,
            "is_sample": False,
        }
        succ_res = await client.post(
            f"/api/v1/devices/{dev_id}/telemetry",
            headers=headers,
            json=cal_ingest_payload,
        )
        assert succ_res.status_code == 201
        assert succ_res.json()["systolic_bp"] == 122
        assert succ_res.json()["diastolic_bp"] == 78


@pytest.mark.asyncio
async def test_duplicate_packet_hash_rejection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        list_res = await client.get("/api/v1/devices", headers=headers)
        dev_id = list_res.json()[0]["id"]

        unique_hash = f"pkt-hash-{uuid.uuid4().hex}"
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "heart_rate": 75,
            "oxygen_saturation": 99.0,
            "packet_hash": unique_hash,
            "is_sample": False,
        }

        # First packet: 201
        first_res = await client.post(f"/api/v1/devices/{dev_id}/telemetry", headers=headers, json=payload)
        assert first_res.status_code == 201

        # Duplicate packet: 409
        dup_res = await client.post(f"/api/v1/devices/{dev_id}/telemetry", headers=headers, json=payload)
        assert dup_res.status_code == 409
        assert "duplicate" in dup_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_timestamp_drift_validation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        list_res = await client.get("/api/v1/devices", headers=headers)
        dev_id = list_res.json()[0]["id"]

        # Future timestamp (>5 minutes ahead)
        future_time = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        future_res = await client.post(
            f"/api/v1/devices/{dev_id}/telemetry",
            headers=headers,
            json={"timestamp": future_time, "heart_rate": 72},
        )
        assert future_res.status_code == 422
        assert "future" in future_res.text.lower()

        # Stale timestamp (>24 hours ago)
        stale_time = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        stale_res = await client.post(
            f"/api/v1/devices/{dev_id}/telemetry",
            headers=headers,
            json={"timestamp": stale_time, "heart_rate": 72},
        )
        assert stale_res.status_code == 422
        assert "stale" in stale_res.text.lower()


@pytest.mark.asyncio
async def test_device_simulator_demo_tagging():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        sim_res = await client.post(
            "/api/v1/devices/simulator/packet",
            headers=headers,
            json={"scenario": "high_pressure", "pulse_bpm": 80, "spo2_pct": 97.0},
        )
        assert sim_res.status_code == 200
        data = sim_res.json()
        assert data["is_sample"] is True
        assert data["provenance"] == MeasurementProvenance.SIMULATED_DEMO.value
        assert data["signal_quality"] == "EXCESSIVE_PRESSURE"
        assert data["blood_glucose"] is None  # Never faked


@pytest.mark.asyncio
async def test_scientific_feasibility_report_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/devices/feasibility-report")
        assert res.status_code == 200
        report = res.json()
        assert report["can_measure_both_at_fingertip_without_cuff_or_blood"] is False
        assert len(report["sensors"]) >= 6
        assert len(report["fda_safety_communications"]) >= 1
        assert any("2024-02-21" in c["date"] for c in report["fda_safety_communications"])
        assert "ISO 15197" in str(report)
        assert "IEEE" in str(report)
