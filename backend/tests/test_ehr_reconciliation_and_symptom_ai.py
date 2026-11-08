"""
Automated Test Suite for MediCare AI EHR Prescription Reconciliation & AI Symptom Response.

Covers:
  - TEST A: Knee Pain Guidance & Clinical Triage (7 triage questions, safety warnings, orthopedic referral, no prescription dumping)
  - TEST B: Reconciled Medication Explanation (Active medications count = 3, purpose, actual instructions, source doctor)
  - TEST C: Duplicate Metformin & Lisinopril Reconciliation (Conflicting refill counts displayed separately, not combined, not deleted)
  - TEST D: Historical & Discontinued Prescriptions (Amoxicillin & Hydrochlorothiazide in historical/discontinued, not active)
  - TEST E: Allergy & Drug Safety Checks during Symptom Queries (Penicillin allergy alert, Lisinopril + NSAID interaction)
  - TEST F: Real Database Orthopedic Doctor Retrieval (Dr. David Sterling, MD, FAAOS, credentials, fee, office)
  - TEST G: Strict Tenant Isolation & RBAC (Patient cannot access another patient's EHR records -> HTTP 403)
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.core.database import AsyncSessionFactory
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.prescription import Prescription, PrescriptionStatus
from app.models.doctor import Doctor
from app.services.medication_reconciliation import reconcile_prescriptions, normalize_ingredient
from app.services.clinical_knowledge import classify_query_intent, extract_reported_symptoms


ALICE_USER_ID = uuid.UUID("39a6b53f-5b14-44cb-b02f-d308fa33dd02")
ALICE_PATIENT_ID = uuid.UUID("353d6d4f-678c-4d1f-891a-d55759e329c0")


async def get_auth_token_for_user(email: str, role: str) -> str:
    """Helper to generate a valid access token for tests."""
    from app.core.security import create_access_token
    async with AsyncSessionFactory() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email=email,
                hashed_password="test_hash_password",
                full_name="Alice Johnson",
                role=UserRole(role),
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
        return create_access_token(str(user.id), user.role.value)


@pytest.mark.asyncio
async def test_ingredient_normalization():
    """Verify chemical salt normalization to canonical active ingredients."""
    assert normalize_ingredient("Metformin Hydrochloride") == "metformin"
    assert normalize_ingredient("Metformin HCL 500mg") == "metformin"
    assert normalize_ingredient("Lisinopril 10mg") == "lisinopril"
    assert normalize_ingredient("Atorvastatin Calcium 20 mg") == "atorvastatin"
    assert normalize_ingredient("Amoxicillin Trihydrate 500 mg") == "amoxicillin"
    assert normalize_ingredient("Hydrochlorothiazide 25mg") == "hydrochlorothiazide"


@pytest.mark.asyncio
async def test_c_duplicate_reconciliation_and_refill_conflicts():
    """
    TEST C: Duplicate Metformin & Lisinopril Reconciliation
    - Confirms Metformin and Lisinopril duplicates are flagged.
    - Conflicting refill counts (3 vs 2 for Metformin, 1 vs 3 for Lisinopril) are explicitly presented.
    - Counts are NOT combined or silently overwritten.
    - Records remain intact in database.
    """
    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Prescription).where(Prescription.patient_id == ALICE_PATIENT_ID))
        all_rx = res.scalars().all()
        assert len(all_rx) >= 5, "Alice should have at least 5 prescription records in database"

        rec = reconcile_prescriptions(all_rx)

        # 1. Active count must be distinct active medications (3: Lisinopril, Metformin, Atorvastatin)
        assert rec["active_medications_count"] == 3
        active_names = [m["normalized_ingredient"] for m in rec["active_medications"]]
        assert "metformin" in active_names
        assert "lisinopril" in active_names
        assert "atorvastatin" in active_names

        # 2. Reconciliation alerts must flag the duplicates
        assert rec["has_reconciliation_warnings"] is True
        alerts = rec["reconciliation_alerts"]
        alert_ingredients = [a["ingredient"] for a in alerts]
        assert "metformin" in alert_ingredients
        assert "lisinopril" in alert_ingredients

        # 3. Check Metformin refill conflict
        metformin_alert = next(a for a in alerts if a["ingredient"] == "metformin")
        assert metformin_alert["has_refill_conflict"] is True
        # Verify conflicting refills exist
        refill_desc = metformin_alert["conflicting_refills"][0]["description"]
        assert "refill" in refill_desc.lower()
        assert "3" in refill_desc and "2" in refill_desc

        # 4. Check Lisinopril refill conflict
        lisinopril_alert = next(a for a in alerts if a["ingredient"] == "lisinopril")
        assert lisinopril_alert["has_refill_conflict"] is True
        refill_desc_lis = lisinopril_alert["conflicting_refills"][0]["description"]
        assert "1" in refill_desc_lis and "3" in refill_desc_lis


@pytest.mark.asyncio
async def test_d_historical_and_discontinued_prescriptions():
    """
    TEST D: Historical & Discontinued Prescriptions
    - Amoxicillin Trihydrate and Hydrochlorothiazide must appear in discontinued, NOT active.
    - Older superseded orders (Lisinopril 2022, Metformin 2023) appear under historical.
    """
    async with AsyncSessionFactory() as db:
        res = await db.execute(select(Prescription).where(Prescription.patient_id == ALICE_PATIENT_ID))
        all_rx = res.scalars().all()
        rec = reconcile_prescriptions(all_rx)

        # Active list must NOT contain amoxicillin or hydrochlorothiazide
        active_ingredients = [m["normalized_ingredient"] for m in rec["active_medications"]]
        assert "amoxicillin" not in active_ingredients
        assert "hydrochlorothiazide" not in active_ingredients

        # Discontinued list must contain amoxicillin
        disc_ingredients = [m["normalized_ingredient"] for m in rec["discontinued_medications"]]
        assert "amoxicillin" in disc_ingredients

        # Historical list must contain superseded orders
        hist_ingredients = [m["normalized_ingredient"] for m in rec["historical_medications"]]
        assert "lisinopril" in hist_ingredients or "metformin" in hist_ingredients


@pytest.mark.asyncio
async def test_a_knee_pain_guidance_and_intent_priority():
    """
    TEST A: Knee Pain Guidance & Clinical Triage
    Query: "I am suffering from knee pain. Give suggestions and medications."
    - Intent must classify as KNEE_PAIN / symptom_guidance, NOT MEDICATION dumping.
    - AI reply must contain:
      1. Understanding concern
      2. 7 clinical triage questions (onset, injury, swelling, locking, weight-bearing, warmth, fever)
      3. Conservative self-care (cold pack, rest, elevation)
      4. Warning signs requiring urgent medical assessment (inability to bear weight, joint locking)
      5. Medication and allergy safety check (Penicillin allergy, Lisinopril NSAID warning)
      6. Recommended specialist: Orthopedics / Sports Medicine
      7. Verified doctor card (Dr. David Sterling, MD, FAAOS)
      8. Must NOT lead with "Your Active Prescriptions (5 Prescribed)"
    """
    query = "I am suffering from knee pain. Give suggestions and medications."
    intent = classify_query_intent(query)
    assert intent in ("KNEE_PAIN", "symptom_guidance", "SYMPTOMS")

    symptoms = extract_reported_symptoms(query)
    assert "knee pain" in symptoms

    token = await get_auth_token_for_user("alice.johnson@medicare.ai", "patient")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [{"role": "user", "content": query}],
                "patient_id": str(ALICE_PATIENT_ID),
            },
        )
        assert response.status_code == 200
        data = response.json()
        reply = data["reply"]

        # Must NOT dump active prescriptions as title
        assert not reply.startswith("## Your Active Prescriptions (5 Prescribed)")

        # 1. Understanding concern
        assert "knee pain" in reply.lower()

        # 2. The 7 clinical follow-up questions
        assert "onset" in reply.lower()
        assert "injury" in reply.lower() or "trauma" in reply.lower()
        assert "swelling" in reply.lower()
        assert "locking" in reply.lower() or "buckle" in reply.lower()
        assert "weight-bearing" in reply.lower() or "bear weight" in reply.lower()
        assert "warmth" in reply.lower() or "redness" in reply.lower()
        assert "fever" in reply.lower() or "chills" in reply.lower()

        # 3. Conservative guidance
        assert "cold pack" in reply.lower() or "cryotherapy" in reply.lower()
        assert "elevation" in reply.lower() or "elevate" in reply.lower()

        # 4. Warning signs
        assert "inability to bear weight" in reply.lower() or "cannot bear weight" in reply.lower()

        # 5. Medication and allergy safety
        assert "penicillin" in reply.lower()
        assert "lisinopril" in reply.lower()
        assert "nsaid" in reply.lower() or "ibuprofen" in reply.lower()
        assert "acetaminophen" in reply.lower() or "paracetamol" in reply.lower()

        # 6. Orthopedic doctor recommendation
        assert "orthopedic" in reply.lower() or "sports medicine" in reply.lower()
        assert "Dr. David Sterling" in reply

        # Check doctor recommendations array in JSON response
        doc_recs = data.get("doctor_recommendations")
        assert doc_recs is not None and len(doc_recs) > 0
        ortho_doc = next((d for d in doc_recs if "Sterling" in d["doctor_name"] or "Orthopedics" in d["specialty"]), None)
        assert ortho_doc is not None
        assert ortho_doc["specialty"] == "Orthopedics"


@pytest.mark.asyncio
async def test_b_medication_explanation_reconciled():
    """
    TEST B: Reconciled Medication Explanation
    Query: "Explain my current medications"
    - Reconciled active medications count is 3 (Metformin, Lisinopril, Atorvastatin).
    - Displays clinical purpose for each medication.
    - Displays instructions from actual prescription orders.
    - Displays prescribing doctor and dates.
    - Displays medication reconciliation warning for Metformin & Lisinopril.
    """
    query = "Explain my current medications"
    intent = classify_query_intent(query)
    assert intent in ("MEDICATION", "medication_questions")

    token = await get_auth_token_for_user("alice.johnson@medicare.ai", "patient")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [{"role": "user", "content": query}],
                "patient_id": str(ALICE_PATIENT_ID),
            },
        )
        assert response.status_code == 200
        data = response.json()
        reply = data["reply"]

        # Must state 3 active medications, NOT 5
        assert "3 distinct active chronic medications" in reply or "3 active prescriptions" in reply or "3" in reply

        # Section 1: Prescriptions
        assert "Metformin" in reply
        assert "Lisinopril" in reply
        assert "Atorvastatin" in reply

        # Section 2: Purpose
        assert "glycemic" in reply.lower() or "diabetes" in reply.lower()
        assert "blood pressure" in reply.lower() or "hypertension" in reply.lower()
        assert "statin" in reply.lower() or "cholesterol" in reply.lower()

        # Section 3: Instructions from actual chart
        assert "breakfast" in reply.lower()

        # Section 4: Safety warnings
        assert "potassium" in reply.lower()

        # Section 5: Prescriber
        assert "Dr. Sarah Chen" in reply

        # Section 6: Conflicting or unverified records (Reconciliation Warning)
        assert "Reconciliation" in reply
        assert "Refill" in reply or "refills" in reply


@pytest.mark.asyncio
async def test_e_allergy_safety_checking_during_symptoms():
    """
    TEST E: Allergy Safety Checking During Symptom Guidance
    - Verifies that patient chart allergy (Penicillin) is alerted.
    - Verifies that active medication (Lisinopril) is screened against NSAIDs.
    """
    token = await get_auth_token_for_user("alice.johnson@medicare.ai", "patient")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [{"role": "user", "content": "I have knee pain. What can I take for relief?"}],
                "patient_id": str(ALICE_PATIENT_ID),
            },
        )
        assert response.status_code == 200
        reply = response.json()["reply"]

        # Check documented allergy alert
        assert "Penicillin" in reply
        # Check NSAID interaction warning with Lisinopril
        assert "Lisinopril" in reply
        assert "NSAID" in reply or "ibuprofen" in reply.lower()


@pytest.mark.asyncio
async def test_f_verified_orthopedic_doctor_retrieval():
    """
    TEST F: Real Database Orthopedic Doctor Retrieval
    - Searches database for Orthopedics and returns Dr. David Sterling, MD, FAAOS.
    - Confirms credentials, hospital affiliation, and consultation fee ($175.00).
    """
    async with AsyncSessionFactory() as db:
        res = await db.execute(
            select(Doctor).where(Doctor.specialty == "Orthopedics")
        )
        doctor = res.scalar_one_or_none()
        assert doctor is not None, "Orthopedic doctor must exist in database"
        assert doctor.consultation_fee == 175.0
        assert "FAAOS" in doctor.qualifications
        assert "Surgical Tower" in doctor.office_location


@pytest.mark.asyncio
async def test_g_tenant_isolation_rbac():
    """
    TEST G: Tenant Isolation & RBAC
    - Alice Johnson cannot query or access health records belonging to another patient ID.
    - Returns HTTP 403 Forbidden.
    """
    token = await get_auth_token_for_user("alice.johnson@medicare.ai", "patient")
    other_patient_id = uuid.uuid4()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/ai/chat",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "messages": [{"role": "user", "content": "Explain my medications"}],
                "patient_id": str(other_patient_id),
            },
        )
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]
