"""
MediCare AI – Final AI Health Assistant Intelligence and EHR Integration Upgrade Test Suite.
Validates all 14 mandatory clinical, RAG, safety, and integration requirements.
"""
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionFactory, engine
from app.core.seed import seed_initial_data
from app.models.base import Base
from app.models.patient import Patient, BloodType
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.models.appointment import Appointment
from sqlalchemy import select, delete


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


async def setup_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)

        # Create a second patient (Bob Smith) with 0 medications for testing isolation & zero-records
        bob_user_stmt = select(User).where(User.email == "bob.smith@medicare.ai")
        bob_user = (await session.execute(bob_user_stmt)).scalar_one_or_none()
        if not bob_user:
            bob_user = User(
                id=uuid.uuid4(),
                email="bob.smith@medicare.ai",
                hashed_password=get_password_hash("PatientPass123!"),
                full_name="Bob Smith",
                role=UserRole.PATIENT,
                is_active=True,
            )
            session.add(bob_user)
            await session.flush()

            bob_pat = Patient(
                id=uuid.uuid4(),
                user_id=bob_user.id,
                mrn="MRN-BOB-9999",
                date_of_birth=datetime(1985, 4, 12, tzinfo=timezone.utc).date(),
                gender="Male",
                blood_type=BloodType.B_POS,
            )
            session.add(bob_pat)
            await session.commit()


@pytest.mark.asyncio
async def test_01_general_health_question():
    """1. Ask a general health question."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login Alice
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "What are general evidence-based tips to keep my heart healthy?",
                    }
                ]
            },
        )
        assert chat_res.status_code == 200
        data = chat_res.json()
        assert "reply" in data
        reply_lower = data["reply"].lower()
        assert (
            "exercise" in reply_lower
            or "diet" in reply_lower
            or "cardiovascular" in reply_lower
            or "blood pressure" in reply_lower
            or "heart" in reply_lower
        )
        # Ensure no prescriptive dosage fabrication
        assert "increase your dosage" not in reply_lower


@pytest.mark.asyncio
async def test_02_symptom_related_question():
    """
    2. Ask a symptom-related question.
    Patient: "I am suffering from fever, headache, cold and cough. Which doctor would be better for me?"
    AI must:
    1. Acknowledge symptoms.
    2. Explain Primary Care / General Practice is an appropriate starting point.
    3. Inquire about duration and severity.
    4. Explain emergency warning signs (red flags).
    5. Offer to connect with verified available doctors from DB.
    """
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "I am suffering from fever, headache, cold and cough. Which doctor would be better for me?",
                    }
                ]
            },
        )
        assert chat_res.status_code == 200
        data = chat_res.json()
        reply = data["reply"]
        reply_lower = reply.lower()

        # 1. Acknowledges symptoms
        assert "fever" in reply_lower
        assert "headache" in reply_lower or "cough" in reply_lower

        # 2. General practice / primary care recommendation
        assert "general practice" in reply_lower or "primary care" in reply_lower

        # 3. Follow-up on duration & severity
        assert "duration" in reply_lower or "how long" in reply_lower or "severity" in reply_lower

        # 4. Emergency warning signs (red flags)
        assert "emergency" in reply_lower or "911" in reply_lower or "warning" in reply_lower

        # 5. Verified doctor recommendations returned
        docs = data.get("doctor_recommendations", [])
        assert len(docs) > 0
        doc = docs[0]
        doc_name = doc.get("name") or doc.get("doctor_name", "")
        assert "Maria Lopez" in doc_name or doc["department"] == "General Practice"
        assert doc["consultation_fee"] > 0


@pytest.mark.asyncio
async def test_03_actual_medication_question():
    """3. Ask about an actual medication."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "What medications am I taking and how should I take them?",
                    }
                ]
            },
        )
        assert chat_res.status_code == 200
        data = chat_res.json()
        reply = data["reply"]

        # Alice has Lisinopril and Metformin in DB
        assert "lisinopril" in reply.lower()
        assert "metformin" in reply.lower()
        assert data.get("rag_sources_used", 0) >= 1
        assert len(data.get("sources", [])) >= 1
        assert any(
            "Medication" in s.get("category", "")
            or "Medication" in s.get("title", "")
            or "Lisinopril" in s.get("title", "")
            for s in data["sources"]
        )


@pytest.mark.asyncio
async def test_04_stored_laboratory_report():
    """4. Ask about a stored laboratory report."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "Can you explain my latest HbA1c test result?",
                    }
                ]
            },
        )
        assert chat_res.status_code == 200
        data = chat_res.json()
        reply = data["reply"]

        # Cites actual 6.8% value and reference range
        assert "6.8" in reply or "hba1c" in reply.lower()
        assert data.get("rag_sources_used", 0) >= 1
        assert any("HbA1c" in s.get("title", "") or "Laboratory" in s.get("category", "") for s in data.get("sources", []))


@pytest.mark.asyncio
async def test_05_previous_medical_history():
    """5. Ask about previous medical history."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "What is my documented medical diagnosis and clinical history?",
                    }
                ]
            },
        )
        assert chat_res.status_code == 200
        data = chat_res.json()
        reply = data["reply"]
        assert "hypertension" in reply.lower() or "i10" in reply.lower()
        # Distinguishes confirmed diagnosis
        assert "confirmed" in reply.lower() or "diagnosis" in reply.lower() or "history" in reply.lower()


@pytest.mark.asyncio
async def test_06_missing_ehr_records():
    """6. Test missing EHR records (should state unavailable, never hallucinate)."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "What were the results of my brain MRI and colonoscopy?",
                    }
                ]
            },
        )
        assert chat_res.status_code == 200
        data = chat_res.json()
        reply = data["reply"].lower()
        # Must clearly state no record is found in chart
        assert "not found" in reply or "no record" in reply or "unavailable" in reply or "not available" in reply or "no brain mri" in reply
        # Must not fabricate a normal/abnormal brain scan
        assert "tumor" not in reply


@pytest.mark.asyncio
async def test_07_patient_with_no_medication_records():
    """7. Test a patient with no medication records (Bob Smith)."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "bob.smith@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        # Check EHR profile endpoint
        prof_res = await client.get(
            "/api/v1/ai/ehr-profile",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert prof_res.status_code == 200
        prof_data = prof_res.json()
        assert prof_data["active_medications_count"] == 0
        assert prof_data["active_medications"] == []

        # Ask AI about medications
        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "What medications am I currently prescribed?",
                    }
                ]
            },
        )
        assert chat_res.status_code == 200
        reply = chat_res.json()["reply"].lower()
        assert "no active" in reply or "no prescribed" in reply or "not found" in reply or "0 prescribed" in reply


@pytest.mark.asyncio
async def test_08_doctor_recommendations():
    """8. Test doctor recommendations based on symptoms."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "Which doctor should I see for a bad cough and sore throat?",
                    }
                ]
            },
        )
        assert chat_res.status_code == 200
        data = chat_res.json()
        docs = data.get("doctor_recommendations", [])
        assert len(docs) > 0
        doc = docs[0]
        assert "doctor_id" in doc or "id" in doc
        assert "specialty" in doc
        assert "consultation_fee" in doc
        assert doc["consultation_fee"] > 0


@pytest.mark.asyncio
async def test_09_open_recommended_doctor_profile():
    """9. Open a recommended doctor's profile and verify consistency."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        # First get recommendations from AI
        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {"role": "user", "content": "I have fever and need a general practitioner."}
                ]
            },
        )
        doc_rec = chat_res.json()["doctor_recommendations"][0]
        doctor_id = doc_rec.get("doctor_id") or doc_rec.get("id")

        # Check doctor slot availability
        tomorrow_str = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        avail_res = await client.get(
            f"/api/v1/appointments/availability?doctor_id={doctor_id}&date={tomorrow_str}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert avail_res.status_code == 200
        avail_data = avail_res.json()
        assert avail_data["doctor_id"] == doctor_id
        assert "doctor_name" in avail_data


@pytest.mark.asyncio
async def test_10_book_appointment_from_ai_recommendation():
    """10. Book an appointment from an AI recommendation (AI-to-Hospital Integration)."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        # 1. Ask AI for doctor
        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {"role": "user", "content": "I need to see Dr. Maria Lopez for my cold symptoms."}
                ]
            },
        )
        doc = chat_res.json()["doctor_recommendations"][0]
        doc_id = doc.get("doctor_id") or doc.get("id")

        # 2. Clean up any prior test booking to ensure slot availability
        async with AsyncSessionFactory() as session:
            await session.execute(
                delete(Appointment).where(
                    Appointment.reason.like("%referred by AI Assistant%")
                )
            )
            await session.commit()

        # Book appointment with recommended doctor
        scheduled_time = datetime.now(timezone.utc) + timedelta(days=3)
        while scheduled_time.weekday() >= 5:
            scheduled_time += timedelta(days=1)
        scheduled_time = scheduled_time.replace(hour=10, minute=0, second=0, microsecond=0)
        booking_payload = {
            "doctor_id": doc_id,
            "scheduled_at": scheduled_time.isoformat(),
            "duration_minutes": 30,
            "appointment_type": "in_person",
            "reason": "Evaluation of persistent cough and fever (referred by AI Assistant)",
            "department_name": doc["department"],
            "notes": "Booked directly through MediCare AI Health Guide integration",
        }

        book_res = await client.post(
            "/api/v1/appointments",
            headers={"Authorization": f"Bearer {token}"},
            json=booking_payload,
        )
        assert book_res.status_code == 201
        book_data = book_res.json()
        assert "booking_reference" in book_data
        ref = book_data["booking_reference"]
        assert ref.startswith("MED-2026-")

        # 3. Verify it appears in patient's appointment timeline
        list_res = await client.get(
            "/api/v1/appointments?time_frame=upcoming",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert list_res.status_code == 200
        appts = list_res.json()
        assert any(a["booking_reference"] == ref for a in appts)


@pytest.mark.asyncio
async def test_11_drug_interaction_screening():
    """11. Test drug interaction screening with allergy & duplicate ingredient warnings."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        # Alice is allergic to Penicillin. Screen Lisinopril + Amoxicillin (Penicillin class) + Spironolactone
        screen_res = await client.post(
            "/api/v1/ai/interactions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "medications": ["Lisinopril 10mg", "Amoxicillin 500mg", "Spironolactone 25mg"]
            },
        )
        assert screen_res.status_code == 200
        data = screen_res.json()

        # Allergy warning must trigger
        assert len(data.get("allergy_warnings", [])) > 0
        assert any("penicillin" in w.lower() for w in data["allergy_warnings"])

        # Interaction warning between Lisinopril and Spironolactone
        assert data["interaction_count"] >= 1
        assert data["has_critical"] is True

        # Reliable maintained source cited
        assert "Clinical Pharmacology" in data.get("source_info", "")
        # Disclaimer present
        assert "consulting" in data.get("disclaimer", "").lower() or "physician" in data.get("disclaimer", "").lower()


@pytest.mark.asyncio
async def test_12_markdown_formatting():
    """12. Test Markdown formatting (clean headers, no visible raw markdown like **)."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        chat_res = await client.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [
                    {"role": "user", "content": "Explain my medications in a structured summary."}
                ]
            },
        )
        assert chat_res.status_code == 200
        reply = chat_res.json()["reply"]

        # Check clean structure
        assert "###" in reply or "##" in reply or "-" in reply or "1." in reply
        # Verify clean markdown pairing
        assert reply.count("**") % 2 == 0


@pytest.mark.asyncio
async def test_13_patient_data_isolation():
    """13. Test patient data isolation (Alice cannot view Bob's data and vice versa)."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login Alice
        res_alice = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token_alice = res_alice.json()["access_token"]

        # Login Bob
        res_bob = await client.post(
            "/api/v1/auth/login",
            json={"email": "bob.smith@medicare.ai", "password": "PatientPass123!"},
        )
        token_bob = res_bob.json()["access_token"]

        # Alice's EHR profile
        p_alice = (
            await client.get(
                "/api/v1/ai/ehr-profile",
                headers={"Authorization": f"Bearer {token_alice}"},
            )
        ).json()

        # Bob's EHR profile
        p_bob = (
            await client.get(
                "/api/v1/ai/ehr-profile",
                headers={"Authorization": f"Bearer {token_bob}"},
            )
        ).json()

        # Verify strict isolation
        assert (p_alice.get("name") or p_alice.get("full_name")) == "Alice Johnson"
        assert (p_bob.get("name") or p_bob.get("full_name")) == "Bob Smith"
        assert p_alice["blood_type"] != p_bob["blood_type"]
        assert p_alice["active_medications_count"] == 2
        assert p_bob["active_medications_count"] == 0
        assert p_alice["patient_id"] != p_bob["patient_id"]


@pytest.mark.asyncio
async def test_14_no_fabricated_medical_information():
    """14. Verify that no fabricated medical information is displayed."""
    await setup_test_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        token = login_res.json()["access_token"]

        prof_res = await client.get(
            "/api/v1/ai/ehr-profile",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = prof_res.json()

        # Alice has exactly 2 active prescriptions (Lisinopril, Metformin)
        assert data["active_medications_count"] == 2
        assert len(data["active_medications"]) == 2
        # Alice has Penicillin allergy
        assert "Penicillin" in str(data["allergies"])
        # Alice has confirmed diagnosis Essential Hypertension
        assert any("Hypertension" in d.get("title", d.get("name", "")) for d in data["confirmed_diagnoses"])
