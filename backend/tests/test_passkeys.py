import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text

import app.models
from app.main import app
from app.core.database import AsyncSessionFactory, engine
from app.core.security import create_access_token
from app.core.seed import seed_initial_data
from app.models.base import Base
from app.models.user import User, UserRole
from app.models.vital_sign import WebAuthnCredential, WebauthnChallenge


@pytest.fixture(autouse=True)
async def setup_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for col_name, col_def in [
            ("transports", "VARCHAR(255)"),
            ("last_used_at", "TIMESTAMP"),
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE webauthn_credentials ADD COLUMN {col_name} {col_def}"))
            except Exception:
                pass
    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)
    yield


@pytest.mark.asyncio
async def test_passkey_register_options_requires_auth():
    """Anonymous requests must not be permitted to initiate passkey registration."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/passkeys/register-options")
        assert res.status_code in [401, 403]



@pytest.mark.asyncio
async def test_passkey_register_options_authorized():
    """Authenticated users receive valid WebAuthn registration options with a server challenge."""
    async with AsyncSessionFactory() as db:
        user_res = await db.execute(select(User).where(User.email == "alice.johnson@medicare.ai"))
        alice = user_res.scalar_one_or_none()
        assert alice is not None, "Alice Johnson demo account required"
        token = create_access_token(str(alice.id), alice.role.value)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/auth/passkeys/register-options",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "challengeId" in data
        assert "challenge" in data
        assert data["rp"]["name"] == "MediCare AI"
        assert data["user"]["name"] == "alice.johnson@medicare.ai"


@pytest.mark.asyncio
async def test_passkey_register_verify_invalid_challenge():
    """Verification with a nonexistent or expired challenge must be rejected."""
    async with AsyncSessionFactory() as db:
        user_res = await db.execute(select(User).where(User.email == "alice.johnson@medicare.ai"))
        alice = user_res.scalar_one_or_none()
        token = create_access_token(str(alice.id), alice.role.value)

    payload = {
        "challengeId": "nonexistent-challenge-id",
        "credential": {
            "id": "fake-cred-id",
            "rawId": "fake-cred-id",
            "type": "public-key",
            "response": {},
        },
        "deviceName": "Test Windows Hello",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/auth/passkeys/register-verify",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        assert res.status_code == 400
        assert "expired or invalid" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_passkey_login_options_generation():
    """Public login options endpoint generates challenge for discoverable or user-targeted passkeys."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/auth/passkeys/login-options",
            json={"email": "alice.johnson@medicare.ai"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "challengeId" in data
        assert "challenge" in data


@pytest.mark.asyncio
async def test_passkey_login_verify_invalid_credential():
    """Login with unrecognized passkey or invalid assertion must return 400 or 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        opt_res = await client.post("/api/v1/auth/passkeys/login-options", json={})
        challenge_id = opt_res.json()["challengeId"]

        payload = {
            "challengeId": challenge_id,
            "credential": {
                "id": "unregistered-cred-id-abc-123",
                "rawId": "unregistered-cred-id-abc-123",
                "type": "public-key",
                "response": {
                    "clientDataJSON": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0",
                    "authenticatorData": "AAAA",
                    "signature": "AAAA",
                },
            },
        }
        res = await client.post("/api/v1/auth/passkeys/login-verify", json=payload)
        assert res.status_code in [400, 401]


@pytest.mark.asyncio
async def test_passkey_credentials_crud_and_isolation():
    """Users can only view and revoke their own passkey credentials."""
    async with AsyncSessionFactory() as db:
        alice_res = await db.execute(select(User).where(User.email == "alice.johnson@medicare.ai"))
        alice = alice_res.scalar_one_or_none()
        doc_res = await db.execute(select(User).where(User.email == "sarah.chen@medicare.ai"))
        doctor = doc_res.scalar_one_or_none()

        alice_token = create_access_token(str(alice.id), alice.role.value)
        doc_token = create_access_token(str(doctor.id), doctor.role.value)

        # Insert a test passkey for Alice
        test_cred = WebAuthnCredential(
            user_id=alice.id,
            credential_id=f"test-cred-{uuid.uuid4().hex[:12]}",
            public_key="pQECAyYgASFYIGs6W1w",
            device_name="Alice Touch ID",
        )
        db.add(test_cred)
        await db.commit()
        await db.refresh(test_cred)
        cred_id = str(test_cred.id)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Alice lists her passkeys -> must include the test key
        list_res = await client.get(
            "/api/v1/auth/passkeys/credentials",
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert list_res.status_code == 200
        creds = list_res.json()
        assert any(c["id"] == cred_id for c in creds)

        # 2. Doctor lists her passkeys -> must NOT see Alice's passkey
        doc_list_res = await client.get(
            "/api/v1/auth/passkeys/credentials",
            headers={"Authorization": f"Bearer {doc_token}"},
        )
        assert doc_list_res.status_code == 200
        doc_creds = doc_list_res.json()
        assert not any(c["id"] == cred_id for c in doc_creds)

        # 3. Doctor tries to delete Alice's passkey -> must be forbidden / 404
        del_res = await client.delete(
            f"/api/v1/auth/passkeys/credentials/{cred_id}",
            headers={"Authorization": f"Bearer {doc_token}"},
        )
        assert del_res.status_code == 404

        # 4. Alice deletes her own passkey -> success
        alice_del_res = await client.delete(
            f"/api/v1/auth/passkeys/credentials/{cred_id}",
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert alice_del_res.status_code == 200

        # 5. Check it is gone
        check_res = await client.get(
            "/api/v1/auth/passkeys/credentials",
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        assert not any(c["id"] == cred_id for c in check_res.json())
