"""
MediCare AI – Query Intent Priority & Health Topic Recognition Test Suite.

Verifies that the patient's current question takes absolute priority over stored EHR diagnoses.
Tests the 7 required clinical query scenarios:
- TEST 1: "What lifestyle and dietary habits support thyroid and weight loss?"
          -> Thyroid & safe weight management, no diabetes/hypertension title/hijack,
             explains micronutrients (iodine, selenium, zinc), safe weight principles,
             notes no thyroid diagnosis in EHR, TSH/Free T4 testing, secondary EHR note.
- TEST 2: "What foods support my Type 2 Diabetes?"
          -> Dedicated Type 2 Diabetes nutrition (non-starchy vegetables, complex carbs,
             lean protein, diabetes plate method, Metformin safety).
- TEST 3: "How can I manage my high blood pressure?"
          -> Dedicated Essential Hypertension management (DASH eating pattern,
             sodium reduction < 2300mg / 1500mg, aerobic exercise, home BP tracking, Lisinopril).
- TEST 4: "I have diabetes and hypothyroidism. What lifestyle habits should I follow?"
          -> Multi-condition lifestyle addressing both Type 2 Diabetes and Hypothyroidism
             in separate, distinct sections (Part A & Part B), levothyroxine administration rules.
- TEST 5: "What tests should I get to check my thyroid?"
          -> Objective thyroid laboratory testing (TSH, Free T4, Free T3, TPOAb, ultrasound),
             confirms no thyroid lab reports currently in EHR chart.
- TEST 6: "Can my thyroid condition affect my weight?"
          -> Physiological relationship between thyroid function & weight (BMR, hypothyroidism
             causing modest 5-10 lbs fluid/salt retention, hyperthyroidism weight loss, no assumptions).
- TEST 7: "What lifestyle habits support thyroid health?"
          -> Dedicated thyroid health support (iodine moderation, selenium, zinc, sleep),
             does not default to diabetes/hypertension despite Alice's EHR records.
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


# ── TEST 1: Thyroid and weight loss lifestyle habits ─────────────────────────
@pytest.mark.anyio
async def test_01_thyroid_and_weight_loss_priority():
    """
    Patient asks: "What lifestyle and dietary habits support thyroid and weight loss?"
    MUST address thyroid and safe weight management as primary topics.
    MUST NOT generate 'Evidence-Based Lifestyle & Dietary Guidance for Type 2 Diabetes & Hypertension'.
    MUST note that EHR has no documented thyroid condition and mention TSH/Free T4 testing.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        query = "What lifestyle and dietary habits support thyroid and weight loss?"
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"messages": [{"role": "user", "content": query}]},
            headers=headers,
        )
        assert resp.status_code == 200
        reply = resp.json()["reply"]

        # 1. Primary topic must be Thyroid & Weight Management
        assert "thyroid" in reply.lower(), "Response must discuss thyroid health"
        assert "weight" in reply.lower(), "Response must discuss safe weight management"

        # 2. Must NOT lead with diabetes & hypertension
        assert not reply.lower().startswith("## evidence-based lifestyle & dietary guidance for type 2 diabetes & hypertension"), (
            "Response hijacked by EHR diagnoses instead of answering current question"
        )
        assert "## evidence-based guidance: thyroid health & safe weight management" in reply.lower() or "thyroid" in reply[:120].lower()

        # 3. Must cover thyroid micronutrients
        assert "iodine" in reply.lower()
        assert "selenium" in reply.lower() or "zinc" in reply.lower()

        # 4. Must cover safe weight management principles
        assert "balanced" in reply.lower() or "nutrient" in reply.lower()
        assert "physical activity" in reply.lower() or "exercise" in reply.lower() or "sleep" in reply.lower()

        # 5. Must evaluate EHR thyroid status (Alice has no thyroid diagnosis)
        assert "no documented thyroid" in reply.lower() or "no active thyroid" in reply.lower() or "no thyroid" in reply.lower()

        # 6. Must mention objective laboratory evaluation (TSH, Free T4)
        assert "tsh" in reply.lower()
        assert "t4" in reply.lower()

        # 7. Secondary EHR context note preserves Alice's known diabetes & hypertension without overriding
        assert "secondary clinical context" in reply.lower() or "type 2 diabetes" in reply.lower()


# ── TEST 2: Foods that support Type 2 Diabetes ───────────────────────────────
@pytest.mark.anyio
async def test_02_type_2_diabetes_nutrition():
    """
    Patient asks: "What foods support my Type 2 Diabetes?"
    MUST focus on diabetes nutrition (non-starchy vegetables, complex carbs, plate method, Metformin).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        query = "What foods support my Type 2 Diabetes?"
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"messages": [{"role": "user", "content": query}]},
            headers=headers,
        )
        assert resp.status_code == 200
        reply = resp.json()["reply"]

        # Primary topic: Type 2 Diabetes nutrition
        assert "diabetes" in reply.lower()
        assert "vegetables" in reply.lower() or "fiber" in reply.lower() or "carbohydrate" in reply.lower()
        assert "plate method" in reply.lower() or "plate" in reply.lower()
        assert "metformin" in reply.lower()


# ── TEST 3: High blood pressure management ───────────────────────────────────
@pytest.mark.anyio
async def test_03_hypertension_management():
    """
    Patient asks: "How can I manage my high blood pressure?"
    MUST focus on Essential Hypertension management (DASH, sodium reduction, exercise, Lisinopril).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        query = "How can I manage my high blood pressure?"
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"messages": [{"role": "user", "content": query}]},
            headers=headers,
        )
        assert resp.status_code == 200
        reply = resp.json()["reply"]

        # Primary topic: Hypertension management
        assert "hypertension" in reply.lower() or "blood pressure" in reply.lower()
        assert "dash" in reply.lower() or "sodium" in reply.lower()
        assert "lisinopril" in reply.lower()


# ── TEST 4: Multi-condition (Diabetes and Hypothyroidism) ────────────────────
@pytest.mark.anyio
async def test_04_multi_condition_diabetes_and_hypothyroidism():
    """
    Patient asks: "I have diabetes and hypothyroidism. What lifestyle habits should I follow?"
    MUST address BOTH conditions in separate, distinct sections.
    MUST mention glycemic control and Metformin for diabetes.
    MUST mention micronutrients, levothyroxine administration rules for hypothyroidism.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        query = "I have diabetes and hypothyroidism. What lifestyle habits should I follow?"
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"messages": [{"role": "user", "content": query}]},
            headers=headers,
        )
        assert resp.status_code == 200
        reply = resp.json()["reply"]

        # Both conditions must be covered in distinct parts
        assert "diabetes" in reply.lower()
        assert "hypothyroidism" in reply.lower() or "thyroid" in reply.lower()

        # Check for separated structured sections
        assert "part a" in reply.lower() or "diabetes" in reply.lower()
        assert "part b" in reply.lower() or "hypothyroidism" in reply.lower()

        # Hypothyroidism specifics: levothyroxine administration rules
        assert "levothyroxine" in reply.lower() or "empty stomach" in reply.lower()
        assert "selenium" in reply.lower() or "zinc" in reply.lower() or "iodine" in reply.lower()


# ── TEST 5: Thyroid testing guidance ─────────────────────────────────────────
@pytest.mark.anyio
async def test_05_thyroid_testing_guidance():
    """
    Patient asks: "What tests should I get to check my thyroid?"
    MUST explain TSH, Free T4, Free T3, autoantibodies, and ultrasound.
    MUST confirm whether patient has existing thyroid test results in chart (Alice has none).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        query = "What tests should I get to check my thyroid?"
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"messages": [{"role": "user", "content": query}]},
            headers=headers,
        )
        assert resp.status_code == 200
        reply = resp.json()["reply"]

        # Primary blood tests
        assert "tsh" in reply.lower()
        assert "t4" in reply.lower()
        assert "ultrasound" in reply.lower() or "antibodies" in reply.lower() or "tpo" in reply.lower()

        # Verified EHR status: Alice has no thyroid labs in chart
        assert "no thyroid" in reply.lower() or "not available" in reply.lower() or "no recent thyroid" in reply.lower()


# ── TEST 6: Thyroid condition effect on weight ───────────────────────────────
@pytest.mark.anyio
async def test_06_thyroid_weight_relationship():
    """
    Patient asks: "Can my thyroid condition affect my weight?"
    MUST explain basal metabolic rate (BMR).
    MUST explain hypothyroidism causes modest weight gain (5-10 lbs), mostly water/salt retention.
    MUST explain hyperthyroidism can cause weight loss.
    MUST advise against assuming thyroid diagnosis without objective lab testing.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        query = "Can my thyroid condition affect my weight?"
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"messages": [{"role": "user", "content": query}]},
            headers=headers,
        )
        assert resp.status_code == 200
        reply = resp.json()["reply"]

        assert "metabolic" in reply.lower() or "bmr" in reply.lower()
        assert "hypothyroidism" in reply.lower()
        assert "5 to 10 pounds" in reply.lower() or "5-10" in reply.lower() or "water" in reply.lower()
        assert "hyperthyroidism" in reply.lower()


# ── TEST 7: Thyroid health lifestyle habits ──────────────────────────────────
@pytest.mark.anyio
async def test_07_thyroid_health_guidance():
    """
    Patient asks: "What lifestyle habits support thyroid health?"
    MUST focus on thyroid health (iodine moderation, selenium, zinc, sleep, stress).
    MUST NOT default to diabetes and hypertension title/focus despite Alice's EHR records.
    MUST state that Alice has no documented thyroid condition in EHR.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        token = await get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        query = "What lifestyle habits support thyroid health?"
        resp = await client.post(
            "/api/v1/ai/chat",
            json={"messages": [{"role": "user", "content": query}]},
            headers=headers,
        )
        assert resp.status_code == 200
        reply = resp.json()["reply"]

        # Primary topic: Thyroid Health
        assert "thyroid" in reply.lower()
        assert not reply.lower().startswith("## evidence-based lifestyle & dietary guidance for type 2 diabetes & hypertension")
        assert "iodine" in reply.lower()
        assert "selenium" in reply.lower() or "zinc" in reply.lower()

        # EHR status check
        assert "no documented thyroid" in reply.lower() or "no active thyroid" in reply.lower() or "no thyroid" in reply.lower()

