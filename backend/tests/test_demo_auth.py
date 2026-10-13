"""
Integration tests for demo accounts seeding and authentication.
Verifies that all three baseline accounts (Admin, Doctor, Patient) can authenticate
and receive valid JWT tokens.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionFactory
from app.core.seed import seed_initial_data


@pytest.mark.asyncio
async def test_demo_accounts_authentication():
    # 1. Ensure accounts seeded
    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)

    # 2. Test logins with real HTTP client
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Patient login
        resp_patient = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        assert resp_patient.status_code == 200, f"Patient login failed: {resp_patient.text}"
        data_pat = resp_patient.json()
        assert "access_token" in data_pat
        assert data_pat["role"] == "patient"

        # Verify /auth/me with patient token
        me_resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {data_pat['access_token']}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "alice.johnson@medicare.ai"

        # Doctor login
        resp_doctor = await client.post(
            "/api/v1/auth/login",
            json={"email": "sarah.chen@medicare.ai", "password": "DoctorPass123!"},
        )
        assert resp_doctor.status_code == 200, f"Doctor login failed: {resp_doctor.text}"
        data_doc = resp_doctor.json()
        assert "access_token" in data_doc
        assert data_doc["role"] == "doctor"

        # Admin login
        resp_admin = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@medicare.ai", "password": "AdminPass123!"},
        )
        assert resp_admin.status_code == 200, f"Admin login failed: {resp_admin.text}"
        data_adm = resp_admin.json()
        assert "access_token" in data_adm
        assert data_adm["role"] == "admin"

        # Demo status check
        resp_status = await client.get("/api/v1/auth/demo-status")
        assert resp_status.status_code == 200
        status_data = resp_status.json()
        assert status_data["status"] == "ready"
        assert status_data["accounts"]["admin"] is True
        assert status_data["accounts"]["doctor"] is True
        assert status_data["accounts"]["patient"] is True

        # Invalid password check
        resp_invalid = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "WrongPassword!"},
        )
        assert resp_invalid.status_code == 401

        # Unknown email check
        resp_unknown = await client.post(
            "/api/v1/auth/login",
            json={"email": "unknown.user@medicare.ai", "password": "AnyPassword123!"},
        )
        assert resp_unknown.status_code == 401

        # Role permission checks:
        # Patient attempting to list patient directory must receive 403 Forbidden
        patient_headers = {"Authorization": f"Bearer {data_pat['access_token']}"}
        resp_pat_list = await client.get("/api/v1/patients", headers=patient_headers)
        assert resp_pat_list.status_code == 403

        # Patient attempting to issue prescription must receive 403 Forbidden
        resp_pat_rx = await client.post(
            "/api/v1/prescriptions",
            headers=patient_headers,
            json={
                "patient_id": "00000000-0000-0000-0000-000000000000",
                "medication_name": "Unauthorized Drug",
                "dosage": "100mg",
                "frequency": "Daily",
                "start_date": "2026-10-15",
                "refills_remaining": 0,
            },
        )
        assert resp_pat_rx.status_code == 403

        # Patient reading their own prescriptions must succeed with 200 OK
        resp_my_rx = await client.get("/api/v1/prescriptions", headers=patient_headers)
        assert resp_my_rx.status_code == 200
        rx_list = resp_my_rx.json()
        assert isinstance(rx_list, list)

        # Admin querying medical records without patient_id must receive 400 Bad Request
        admin_headers = {"Authorization": f"Bearer {data_adm['access_token']}"}
        resp_admin_records = await client.get("/api/v1/records", headers=admin_headers)
        assert resp_admin_records.status_code == 400

        # Doctor listing patients must succeed with 200 OK
        doctor_headers = {"Authorization": f"Bearer {data_doc['access_token']}"}
        resp_doc_patients = await client.get("/api/v1/patients", headers=doctor_headers)
        assert resp_doc_patients.status_code == 200
        assert isinstance(resp_doc_patients.json(), list)
