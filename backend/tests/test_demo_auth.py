"""
Integration tests for demo accounts seeding and authentication.
Verifies that all three baseline accounts (Admin, Doctor, Patient) can authenticate
and receive valid JWT tokens.
"""
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
