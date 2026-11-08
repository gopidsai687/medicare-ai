"""
Test Suite: MediCare AI Headache Response, Medical Intent Routing & Quality Gate Enforcement.
Verifies all 10 user inquiries, Quality Gate multi-stage enforcement, and selective EHR retrieval:
1. "I am suffering from headache, what is the reason and medication?"
2. "I am suffering from gastric."
3. "I have stomach pain after eating."
4. "I am suffering from knee pain."
5. "Why is my blood pressure high?"
6. "What is my HbA1c?"
7. "Explain my current medications."
8. "What are my allergies?"
9. "Show my upcoming appointments."
10. "What are the possible causes of dizziness?"
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.core.database import AsyncSessionFactory
from app.core.security import create_access_token
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.services.clinical_knowledge import (
    classify_query_intent,
    extract_reported_symptoms,
    generate_headache_guidance,
    generate_dizziness_guidance,
    generate_gastric_symptom_guidance,
    generate_knee_pain_guidance,
    generate_reconciled_medication_guidance,
    generate_single_medication_guidance,
    generate_allergies_guidance,
    generate_blood_pressure_guidance,
    generate_hba1c_guidance,
    generate_out_of_scope_response,
    generate_general_health_education,
    generate_safe_clarification_fallback,
    verify_response_relevance,
    ai_response_quality_gate,
)
from app.services.ai_service import ai_service


@pytest.fixture
def mock_alice_context():
    return {
        "name": "Alice Johnson",
        "mrn": "MRN-2026-08842",
        "blood_type": "A+",
        "allergies": [
            {
                "substance": "Penicillin",
                "reaction": "Hives, moderate to severe rash, facial puffiness",
                "severity": "Active Alert",
                "date": "September 15, 2026",
            }
        ],
        "confirmed_diagnoses": [
            {"title": "Type 2 Diabetes Mellitus", "icd10": "E11.9"},
            {"title": "Essential Hypertension", "icd10": "I10"},
        ],
        "active_medications": [
            {
                "name": "Metformin Hydrochloride",
                "dosage": "500 mg",
                "frequency": "Once daily with evening meal",
                "route": "Oral",
                "instructions": "Take 500 mg by mouth once daily with evening meal to minimize stomach upset.",
                "prescriber_name": "Dr. James Kim, MD",
                "refills": 3,
                "clinical_purpose": "First-line oral biguanide antihyperglycemic medication prescribed for glycemic control in Type 2 Diabetes Mellitus.",
            },
            {
                "name": "Lisinopril",
                "dosage": "10 mg",
                "frequency": "Once daily in the morning",
                "route": "Oral",
                "instructions": "Take 10 mg by mouth once daily every morning for blood pressure control.",
                "prescriber_name": "Dr. Sarah Chen, MD",
                "refills": 2,
                "clinical_purpose": "First-line ACE inhibitor prescribed for the management of Essential Hypertension.",
            },
            {
                "name": "Atorvastatin Calcium",
                "dosage": "20 mg",
                "frequency": "Once daily at bedtime",
                "route": "Oral",
                "instructions": "Take 20 mg by mouth once daily at bedtime for cholesterol management.",
                "prescriber_name": "Dr. Sarah Chen, MD",
                "refills": 3,
                "clinical_purpose": "HMG-CoA reductase inhibitor (statin) prescribed for hyperlipidemia and cardiovascular risk reduction.",
            },
        ],
        "latest_vitals": {
            "blood_pressure": "128/82 mmHg",
            "blood_glucose": "118 mg/dL",
            "heart_rate": "72 bpm",
            "oxygen_saturation": "98%",
        },
        "recent_labs": [
            {
                "test_name": "Hemoglobin A1c",
                "panel": "HbA1c Glycemic Monitoring",
                "value": "6.8",
                "unit": "%",
                "reference_range": "< 5.7%",
                "status": "Final",
                "date": "September 18, 2026",
            }
        ],
        "upcoming_appointments": [
            {
                "id": "appt-101",
                "doctor_name": "Dr. Sarah Chen, MD",
                "specialty": "Cardiology",
                "date": "October 20, 2026 at 10:00 AM",
                "room": "Room 304, Cardiology Pavilion",
                "reason": "Routine hypertension and statin management review",
                "status": "confirmed",
            }
        ],
    }


def test_intent_classification_all_10_user_queries():
    """Verifies that all 10 user queries are classified into their exact clinical intents."""
    queries = [
        ("I am suffering from headache, what is the reason and medication?", "HEADACHE"),
        ("I am suffering from gastric.", "GASTRIC_SYMPTOMS"),
        ("I have stomach pain after eating.", "GASTRIC_SYMPTOMS"),
        ("I am suffering from knee pain.", "KNEE_PAIN"),
        ("Why is my blood pressure high?", "BLOOD_PRESSURE"),
        ("What is my HbA1c?", "HBA1C"),
        ("Explain my current medications.", "MEDICATION"),
        ("What are my allergies?", "ALLERGIES"),
        ("Show my upcoming appointments.", "APPOINTMENT"),
        ("What are the possible causes of dizziness?", "DIZZINESS"),
    ]
    for q, expected in queries:
        actual = classify_query_intent(q)
        assert actual == expected, f"Failed for '{q}': got '{actual}', expected '{expected}'"


def test_headache_guidance_clinical_requirements(mock_alice_context):
    """
    BUG 1 Fix Verification:
    Patient asks: 'I am suffering from headache, what is the reason and medication?'
    Must recognize headache, explain causes without diagnosing, ask 5 triage questions,
    check Lisinopril/NSAID cautions and Penicillin allergy, discuss OTC options cautiously,
    warn of emergency red flags, recommend Neurology / Primary Care, and NEVER dump prescription summary.
    """
    query = "I am suffering from headache, what is the reason and medication?"
    reply = generate_headache_guidance(query=query, patient_context=mock_alice_context)

    # 1. Primary symptom recognition
    assert "Headache Assessment & Triage" in reply
    assert "headache" in reply.lower()

    # 2. Explains possible causes without diagnosing
    assert "Tension-Type Headache" in reply
    assert "Migraine Headache" in reply
    assert "Dehydration" in reply
    assert "Sinus Pressure" in reply
    assert "Elevated Blood Pressure" in reply
    assert "cannot definitively diagnose" in reply.lower() or "does not provide definitive medical diagnoses" in reply.lower()

    # 3. 5 clinical triage questions
    assert "1. **Onset:**" in reply or "**Onset:**" in reply
    assert "2. **Location:**" in reply or "**Location:**" in reply
    assert "3. **Severity & Duration:**" in reply or "**Severity & Duration:**" in reply
    assert "4. **Recurrence & Pattern:**" in reply or "**Recurrence & Pattern:**" in reply
    assert "5. **Associated Symptoms:**" in reply or "**Associated Symptoms:**" in reply

    # 4. Selective EHR safety review
    assert "Lisinopril (10mg)" in reply or "Lisinopril" in reply
    assert "NSAID" in reply
    assert "Penicillin" in reply
    assert "128/82" in reply

    # 5. General medication discussion (cautious, non-prescriptive)
    assert "Acetaminophen" in reply
    assert "does not prescribe medications" in reply.lower()

    # 6. Red-flag emergency signs
    assert "thunderclap" in reply.lower()
    assert "stiff neck" in reply.lower()

    # 7. Doctor recommendation
    assert "Dr. Elena Rostova, MD, PhD" in reply or "Neurology" in reply

    # 8. Must NOT dump generic prescription schedule
    assert not reply.lower().startswith("## your active prescriptions")
    assert not reply.lower().startswith("## verified medication history")

    # 9. Quality Gate check
    gate = ai_response_quality_gate(query, reply, "HEADACHE", mock_alice_context)
    assert gate["is_valid"] is True
    assert gate["decision"] == "SEND_APPROVED"


def test_gastric_clinical_accuracy_fix(mock_alice_context):
    """
    BUG 3 Fix Verification:
    - Remove water enzyme dilution statement.
    - Correct Metformin statement: taking with food reduces GI side effects; do not claim it protects the stomach lining.
    """
    query = "I am suffering from gastric."
    reply = generate_gastric_symptom_guidance(query=query, patient_context=mock_alice_context)

    # Verify enzyme dilution claim is removed
    assert "dilute digestive enzymes" not in reply.lower()

    # Verify stomach mucosa protection claim is corrected
    assert "protect your stomach mucosa" not in reply.lower()
    assert "reduces gastrointestinal side effects" in reply.lower() or "minimize stomach upset" in reply.lower()

    # Verify Doctor recommendation
    assert "Dr. Daniel Wu" in reply or "Gastroenterology" in reply

    # Quality Gate
    gate = ai_response_quality_gate(query, reply, "GASTRIC_SYMPTOMS", mock_alice_context)
    assert gate["is_valid"] is True
    assert gate["decision"] == "SEND_APPROVED"


def test_dizziness_clinical_requirements(mock_alice_context):
    """
    Question 10: "What are the possible causes of dizziness?"
    Must explain causes (orthostatic hypotension, vestibular, dehydration, glucose, cardiac, medication),
    ask triage questions, check Lisinopril, and recommend Neurology / Primary Care.
    """
    query = "What are the possible causes of dizziness?"
    reply = generate_dizziness_guidance(query=query, patient_context=mock_alice_context)

    assert "Dizziness & Balance Assessment" in reply
    assert "Orthostatic (Postural) Hypotension" in reply
    assert "Inner Ear / Vestibular Disturbances" in reply
    assert "Lisinopril" in reply
    assert "Dr. Elena Rostova" in reply or "Neurology" in reply

    gate = ai_response_quality_gate(query, reply, "DIZZINESS", mock_alice_context)
    assert gate["is_valid"] is True
    assert gate["decision"] == "SEND_APPROVED"


def test_quality_gate_multi_stage_enforcement(mock_alice_context):
    """
    BUG 2 Fix Verification:
    A response that fails Quality Gate must be rejected (is_valid == False, decision == REGENERATE_REQUIRED).
    The system must trigger targeted regeneration, and NEVER deliver a failed answer to the patient.
    """
    query = "I am suffering from headache, what is the reason and medication?"
    # Corrupted / mismatched response simulating previous bug
    bad_reply = (
        "## Your Active Prescriptions\n"
        "• Metformin 500 mg\n"
        "• Lisinopril 10 mg\n"
        "• Atorvastatin 20 mg\n"
        "Refill discrepancies: 3 refills remaining."
    )

    # Attempt 1 validation: MUST fail
    gate_attempt1 = ai_response_quality_gate(query, bad_reply, "HEADACHE", mock_alice_context)
    assert gate_attempt1["is_valid"] is False
    assert gate_attempt1["decision"] == "REGENERATE_REQUIRED"
    assert verify_response_relevance(query, "HEADACHE", bad_reply) is False

    # Attempt 2: Targeted regeneration MUST produce a valid response
    repaired_reply = ai_service._targeted_clinical_regeneration(
        query=query,
        intent="HEADACHE",
        role="patient",
        patient_context=mock_alice_context,
    )
    gate_attempt2 = ai_response_quality_gate(query, repaired_reply, "HEADACHE", mock_alice_context)
    assert gate_attempt2["is_valid"] is True
    assert gate_attempt2["decision"] == "SEND_APPROVED"
    assert verify_response_relevance(query, "HEADACHE", repaired_reply) is True

    # Test fallback mechanism: safe clarification fallback always passes
    fallback = generate_safe_clarification_fallback(query, "HEADACHE", mock_alice_context)
    gate_fallback = ai_response_quality_gate(query, fallback, "HEADACHE", mock_alice_context)
    assert gate_fallback["is_valid"] is True
    assert gate_fallback["decision"] == "SEND_APPROVED"


@pytest.mark.asyncio
async def test_live_ai_chat_headache_query():
    """
    Live API integration test:
    Sends 'I am suffering from headache, what is the reason and medication?' to /api/v1/ai/chat.
    Asserts:
    1. Returns HTTP 200 OK.
    2. Intent is recognized as HEADACHE.
    3. Quality Gate is VALIDATED with SEND_APPROVED.
    4. Doctor recommendation is Neurology (Dr. Elena Rostova, MD, PhD).
    5. Reply addresses headache and NOT a generic prescription dump.
    """
    async with AsyncSessionFactory() as db:
        user_res = await db.execute(select(User).where(User.email == "alice.johnson@medicare.ai"))
        user = user_res.scalar_one_or_none()
        patient_res = await db.execute(select(Patient).where(Patient.user_id == user.id))
        patient = patient_res.scalar_one_or_none()
        token = create_access_token(str(user.id), user.role.value)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        chat_payload = {
            "messages": [
                {
                    "role": "user",
                    "content": "I am suffering from headache, what is the reason and medication?",
                }
            ],
            "patient_id": str(patient.id),
        }
        resp = await client.post(
            "/api/v1/ai/chat",
            json=chat_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, f"API failed with {resp.status_code}: {resp.text}"
        data = resp.json()

        assert data["clinical_intent"] == "HEADACHE"
        assert "Headache Assessment & Triage" in data["reply"]
        assert "Tension-Type Headache" in data["reply"]
        assert "Lisinopril" in data["reply"]
        assert "Acetaminophen" in data["reply"]
        assert not data["reply"].lower().startswith("## your active prescriptions")

        assert "quality_gate" in data
        assert data["quality_gate"]["status"] == "VALIDATED"
        assert data["quality_gate"]["decision"] == "SEND_APPROVED"
        assert data["quality_gate"]["badge"] == "Send only after validation"

        assert data.get("doctor_recommendations") is not None
        assert any(d["specialty"] == "Neurology" for d in data["doctor_recommendations"])

