"""
Test Suite: Universal Patient Question Understanding & AI Response Quality Gate.
Verifies all 12 test scenarios from Section 8:
TEST 1: Gastric symptoms inquiry ("I am 40 years old and suffering from gastric. Give me suggestions and medication.")
TEST 2: Acidity and heartburn ("I have acidity and heartburn after eating.")
TEST 3: Knee pain triage ("I am suffering from knee pain.")
TEST 4: Multiple acute symptoms ("I have fever and vomiting.")
TEST 5: HbA1c lab result ("What is my HbA1c result?")
TEST 6: Single medication explanation ("Explain my Metformin.")
TEST 7: Diabetes nutrition ("What should I eat to support my diabetes?")
TEST 8: Upcoming appointment ("Show my upcoming appointment.")
TEST 9: Allergies inquiry ("What are my allergies?")
TEST 10: Stomach ache differential ("I have a stomach ache. What could be the reason?")
TEST 11: General health education ("I have a question about a medical topic.")
TEST 12: Out-of-scope non-medical question ("How do I write a Python web scraper?")
TEST 13: 6-point AI Response Quality Gate validation
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
    generate_gastric_symptom_guidance,
    generate_knee_pain_guidance,
    generate_single_medication_guidance,
    generate_allergies_guidance,
    generate_out_of_scope_response,
    generate_general_health_education,
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
                "instructions": "Take 10 mg by mouth once daily every morning. Monitor resting blood pressure regularly.",
                "prescriber_name": "Dr. Sarah Chen, MD",
                "refills": 2,
                "clinical_purpose": "Angiotensin-Converting Enzyme (ACE) inhibitor prescribed for Essential Hypertension management and renal protection.",
            },
            {
                "name": "Atorvastatin Calcium",
                "dosage": "20 mg",
                "frequency": "Once daily at bedtime",
                "route": "Oral",
                "instructions": "Take 20 mg by mouth once daily at bedtime. Report any unexplained muscle pain or tenderness.",
                "prescriber_name": "Dr. Sarah Chen, MD",
                "refills": 2,
                "clinical_purpose": "HMG-CoA reductase inhibitor (statin) prescribed for hyperlipidemia and cardiovascular risk reduction.",
            },
        ],
        "upcoming_appointments": [
            {
                "id": "appt-101",
                "doctor_name": "Dr. Sarah Chen, MD",
                "specialty": "Cardiology",
                "date": "September 24, 2026 at 10:00 AM",
                "room": "North Pavilion, Suite 401",
                "reason": "Routine hypertension follow-up",
                "status": "confirmed",
            }
        ],
    }


def test_intent_classification_all_12_scenarios():
    """Verifies that all 12 test queries classify into their exact clinical intents."""
    cases = [
        ("I am suffering from gastric. I am 40 years old. Give me suggestions and medication.", "GASTRIC_SYMPTOMS"),
        ("I have acidity and heartburn after eating.", "GASTRIC_SYMPTOMS"),
        ("I am suffering from knee pain.", "KNEE_PAIN"),
        ("I have fever and vomiting.", "SYMPTOMS"),
        ("What is my HbA1c result?", "HBA1C"),
        ("Explain my Metformin.", "SINGLE_MEDICATION"),
        ("What should I eat to support my diabetes?", "DIABETES_NUTRITION"),
        ("Show my upcoming appointment.", "APPOINTMENT"),
        ("What are my allergies?", "ALLERGIES"),
        ("I have a stomach ache. What could be the reason?", "GASTRIC_SYMPTOMS"),
        ("I have a question about a medical topic.", "GENERAL_HEALTH"),
        ("How do I write a Python web scraper?", "OUT_OF_SCOPE"),
    ]
    for query, expected_intent in cases:
        actual_intent = classify_query_intent(query)
        assert actual_intent == expected_intent, f"Query '{query}' classified as {actual_intent}, expected {expected_intent}"


def test_scenario_1_gastric_symptoms_guidance(mock_alice_context):
    """
    TEST 1: Patient asks: 'I am 40 years old and suffering from gastric. Give me suggestions and medication.'
    Verifies:
    - Primary intent: GASTRIC_SYMPTOMS
    - Answers gastric first (not generic diabetes/hypertension text)
    - Asks all 7 clinical triage questions
    - Checks Metformin with-meal safety advice
    - Warns against NSAIDs (ulcers + Lisinopril interaction)
    - Recommends Dr. Daniel Wu (Gastroenterology)
    - Quality gate passes 6/6 checks
    """
    query = "I am suffering from gastric. I am 40 years old. Give me suggestions and medication."
    intent = classify_query_intent(query)
    assert intent == "GASTRIC_SYMPTOMS"

    response = generate_gastric_symptom_guidance(query, patient_context=mock_alice_context)

    # 1. Answer question first
    assert "Gastric & Upper Gastrointestinal Discomfort Assessment" in response
    assert not response.startswith("## Personal Health Context")
    assert not response.startswith("## MediCare AI Health Guidance")

    # 2. Asks the 7 triage questions
    assert "1. **Nature of Discomfort:**" in response
    assert "2. **Timing & Meal Relationship:**" in response
    assert "3. **Duration & Pattern:**" in response
    assert "4. **Food & Drink Triggers:**" in response
    assert "5. **Associated Symptoms:**" in response
    assert "6. **Medications & Irritants Check:**" in response
    assert "7. **Alarm / Red-Flag Warning Signs:**" in response

    # 3. Metformin GI check
    assert "Metformin" in response
    assert "with or immediately after a meal" in response

    # 4. NSAID warning
    assert "NSAID" in response
    assert "Ibuprofen" in response
    assert "Lisinopril" in response

    # 5. Doctor recommendation
    assert "Dr. Daniel Wu" in response
    assert "Gastroenterology" in response

    # 6. Quality Gate
    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"
    assert gate["badge"] == "Send only after validation"
    assert gate["decision"] == "SEND_APPROVED"
    assert len(gate["checks"]) == 6
    assert all(c["result"] in ("PASSED", "SEND_APPROVED") for c in gate["checks"])


def test_scenario_2_acidity_and_heartburn(mock_alice_context):
    """TEST 2: Patient asks: 'I have acidity and heartburn after eating.'"""
    query = "I have acidity and heartburn after eating."
    intent = classify_query_intent(query)
    assert intent == "GASTRIC_SYMPTOMS"

    response = generate_gastric_symptom_guidance(query, patient_context=mock_alice_context)
    assert "Acidity, Acid Reflux & Heartburn Assessment" in response
    assert "esophagus" in response
    assert "heartburn" in response
    assert "2 to 3 hours" in response

    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"


def test_scenario_3_knee_pain_triage(mock_alice_context):
    """TEST 3: Patient asks: 'I am suffering from knee pain.'"""
    query = "I am suffering from knee pain."
    intent = classify_query_intent(query)
    assert intent == "KNEE_PAIN"

    response = generate_knee_pain_guidance(query, patient_context=mock_alice_context)
    assert "Knee Pain Assessment & Management" in response
    assert "Weight-Bearing Ability" in response
    assert "Cold Pack Application" in response
    assert "Orthopedic" in response or "Sports Medicine" in response

    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"


def test_scenario_4_fever_and_vomiting_extraction():
    """TEST 4: Patient asks: 'I have fever and vomiting.' Both symptoms must be extracted."""
    query = "I have fever and vomiting."
    intent = classify_query_intent(query)
    assert intent == "SYMPTOMS"

    extracted = extract_reported_symptoms(query)
    assert "fever" in extracted
    assert "vomiting" in extracted
    assert len(extracted) == 2


def test_scenario_6_explain_single_medication(mock_alice_context):
    """
    TEST 6: Patient asks: 'Explain my Metformin.'
    Must focus on Metformin specifically and not dump Lisinopril or Atorvastatin as the primary subject.
    """
    query = "Explain my Metformin."
    intent = classify_query_intent(query)
    assert intent == "SINGLE_MEDICATION"

    response = generate_single_medication_guidance(query, patient_context=mock_alice_context)
    assert "Metformin Hydrochloride" in response
    assert "Type 2 Diabetes Mellitus" in response
    assert "hepatic glucose production" in response
    assert "Take With Meals" in response or "evening meal" in response
    assert "Take 500 mg by mouth once daily with evening meal" in response

    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"


def test_scenario_7_diabetes_nutrition(mock_alice_context):
    """TEST 7: Patient asks: 'What should I eat to support my diabetes?'"""
    query = "What should I eat to support my diabetes?"
    intent = classify_query_intent(query)
    assert intent == "DIABETES_NUTRITION"

    from app.services.clinical_knowledge import generate_diabetes_nutrition_guidance
    response = generate_diabetes_nutrition_guidance(query, patient_context=mock_alice_context)
    assert "Non-Starchy Vegetables" in response
    assert "The Diabetes Plate Method" in response
    assert "Liquid Sugars" in response

    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"


def test_scenario_9_allergies_inquiry(mock_alice_context):
    """TEST 9: Patient asks: 'What are my allergies?'"""
    query = "What are my allergies?"
    intent = classify_query_intent(query)
    assert intent == "ALLERGIES"

    response = generate_allergies_guidance(query, patient_context=mock_alice_context)
    assert "Penicillin" in response
    assert "Hives" in response
    assert "contraindicated" in response.lower()
    assert "Amoxicillin" in response

    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"


def test_scenario_10_stomach_ache_differential(mock_alice_context):
    """TEST 10: Patient asks: 'I have a stomach ache. What could be the reason?'"""
    query = "I have a stomach ache. What could be the reason?"
    intent = classify_query_intent(query)
    assert intent == "GASTRIC_SYMPTOMS"

    response = generate_gastric_symptom_guidance(query, patient_context=mock_alice_context)
    assert "Stomach Ache & Abdominal Discomfort Assessment" in response
    assert "Gastric mucosal irritation or gastritis" in response
    assert "Functional indigestion (dyspepsia)" in response
    assert "does not provide definitive medical diagnoses" in response.lower()

    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"


def test_scenario_11_general_health_education(mock_alice_context):
    """TEST 11: Patient asks: 'I have a question about a medical topic.'"""
    query = "I have a question about a medical topic."
    intent = classify_query_intent(query)
    assert intent == "GENERAL_HEALTH"

    response = generate_general_health_education(query, patient_context=mock_alice_context)
    assert "MediCare AI Clinical Education & Guidance" in response
    # Must NOT dump personal diagnoses or active prescriptions
    assert "Type 2 Diabetes Mellitus" not in response
    assert "Essential Hypertension" not in response

    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"


def test_scenario_12_out_of_scope_inquiry(mock_alice_context):
    """TEST 12: Patient asks: 'How do I write a Python web scraper?'"""
    query = "How do I write a Python web scraper?"
    intent = classify_query_intent(query)
    assert intent == "OUT_OF_SCOPE"

    response = generate_out_of_scope_response(query)
    assert "MediCare AI Clinical Scope" in response
    assert "not able to assist with computer programming" in response.lower()
    # Must strictly contain zero patient diagnoses or personal records
    assert "Type 2 Diabetes" not in response
    assert "Lisinopril" not in response
    assert "Metformin" not in response

    gate = ai_response_quality_gate(query, response, intent, patient_context=mock_alice_context)
    assert gate["status"] == "VALIDATED"
    assert gate["decision"] == "SEND_APPROVED"


@pytest.mark.asyncio
async def test_live_ai_chat_api_gastric_query():
    """Live API test verifying POST /api/v1/ai/chat with the gastric user scenario."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Resolve Alice Johnson from database
        async with AsyncSessionFactory() as session:
            stmt = select(User, Patient).join(Patient, User.id == Patient.user_id).where(User.email == "alice.johnson@medicare.ai")
            res = await session.execute(stmt)
            row = res.first()
            assert row is not None, "Alice Johnson alice.johnson@medicare.ai must exist in database"
            user, patient = row
            token = create_access_token(str(user.id), user.role.value)

        # 2. Send query 1: "I am suffering from gastric. I am 40 years old. Give me suggestions and medication."
        chat_payload = {
            "messages": [
                {
                    "role": "user",
                    "content": "I am suffering from gastric. I am 40 years old. Give me suggestions and medication.",
                }
            ],
            "patient_id": str(patient.id),
        }
        resp = await client.post(
            "/api/v1/ai/chat",
            json=chat_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, f"Chat API returned {resp.status_code}: {resp.text}"
        data = resp.json()

        # 3. Assertions
        assert data["clinical_intent"] == "GASTRIC_SYMPTOMS"
        assert "Gastric & Upper Gastrointestinal Discomfort Assessment" in data["reply"]
        assert "1. **Nature of Discomfort:**" in data["reply"]
        assert "Metformin" in data["reply"]
        assert "NSAID" in data["reply"]
        assert "quality_gate" in data
        assert data["quality_gate"]["status"] == "VALIDATED"
        assert data["quality_gate"]["badge"] == "Send only after validation"

        # 4. Doctor recommendation present
        assert data.get("doctor_recommendations") is not None
        assert any(d["specialty"] == "Gastroenterology" for d in data["doctor_recommendations"])
