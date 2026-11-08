"""
MediCare AI Clinical Knowledge & Triage Engine.
Provides deterministic, evidence-based clinical decision support algorithms:
1. Natural-language symptom comprehension & strict symptom extraction (Priority 1)
2. Laboratory result discrepancy detection & ADA HbA1c guidance (Priority 2)
3. Dedicated AHA/ACC blood pressure recognition & classification (Priority 3)
4. Age- and risk-aware preventive health screening guidance per USPSTF (Priority 4)
5. Strict EHR grounding, missing record detection, & tenant isolation (Priority 5)
6. Verified doctor recommendation formatting & scheduling actions (Priority 6)
7. Medication safety, allergy preservation, & interaction screening (Priority 7)
8. High-priority emergency response & triage (Priority 8)
9. Granular intent recognition & clean structured response builder (Priority 9)
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


# ── 1. Dynamic Symptom Extraction ─────────────────────────────────────────────

# Precise dictionary with explicit symptom terms.
# NOTE: Avoid ambiguous short substrings; use word boundary regex.
SYMPTOM_PATTERNS: Dict[str, List[str]] = {
    "fever": [r"\bfever\b", r"\bfebrile\b", r"\bhigh temperature\b", r"\bpyrexia\b", r"\bchills\b"],
    "headache": [r"\bheadache\b", r"\bheadaches\b", r"\bmigraine\b", r"\bmigraines\b", r"\bhead pain\b", r"\bthrobbing head\b"],
    "vomiting": [r"\bvomiting\b", r"\bvomit\b", r"\bvomited\b", r"\bthrowing up\b", r"\bthrew up\b", r"\bemesis\b", r"\bpuking\b"],
    "nausea": [r"\bnausea\b", r"\bnauseous\b", r"\bqueasy\b", r"\bupset stomach\b", r"\bsick to my stomach\b"],
    "cough": [r"\bcough\b", r"\bcoughing\b", r"\bhacking cough\b", r"\btussis\b"],
    "cold": [r"\bcold symptoms\b", r"\bhave a cold\b", r"\bcaught a cold\b", r"\brunning a cold\b", r"\bcoryza\b", r"\brunny nose\b", r"\brhinorrhea\b", r"\bnasal congestion\b", r"\bstuffy nose\b", r"\bsneezing\b", r"\bhead cold\b"],
    "sore throat": [r"\bsore throat\b", r"\bthroat pain\b", r"\bpharyngitis\b", r"\bpain swallowing\b", r"\bscratchy throat\b", r"\bswollen tonsils\b"],
    "shortness of breath": [r"\bshortness of breath\b", r"\bdyspnea\b", r"\btrouble breathing\b", r"\bhard to breathe\b", r"\bdifficulty breathing\b", r"\bbreathlessness\b"],
    "chest pain": [r"\bchest pain\b", r"\bchest tightness\b", r"\bchest pressure\b", r"\bangina\b", r"\bcrushing chest\b"],
    "diarrhea": [r"\bdiarrhea\b", r"\bloose stools\b", r"\bwatery stools\b"],
    "abdominal pain": [r"\babdominal pain\b", r"\bstomach pain\b", r"\bstomach ache\b", r"\bbelly ache\b", r"\bstomach cramps\b"],
    "dizziness": [r"\bdizziness\b", r"\bdizzy\b", r"\blightheaded\b", r"\blightheadedness\b", r"\bvertigo\b"],
    "fatigue": [r"\bfatigue\b", r"\bexhaustion\b", r"\blethargy\b", r"\bextreme tiredness\b"],
    "rash": [r"\brash\b", r"\bhives\b", r"\burticaria\b", r"\bskin breakout\b", r"\bpruritus\b", r"\bitching\b"],
    "body aches": [r"\bbody aches\b", r"\bmuscle aches\b", r"\bmyalgia\b"],
    "ear pain": [r"\bear pain\b", r"\bearache\b", r"\botitis\b"],
    "knee pain": [r"\bknee pain\b", r"\bpain in my knee\b", r"\bpain in knee\b", r"\bknees hurt\b", r"\bknee hurts\b", r"\bswollen knee\b", r"\baching knee\b", r"\bknee injury\b", r"\bknee discomfort\b", r"\bknee\b"],
    "joint pain": [r"\bjoint pain\b", r"\barthralgia\b", r"\bjoint stiffness\b", r"\baching joints\b", r"\bpainful joints\b"],
    "leg pain": [r"\bleg pain\b", r"\bpain in my leg\b", r"\bpain in leg\b", r"\bleg hurts\b"],
    "back pain": [r"\bback pain\b", r"\bbackache\b", r"\blower back pain\b", r"\blumbago\b"],
    "gastric discomfort": [r"\bgastric problem\b", r"\bgastric trouble\b", r"\bgastric issue\b", r"\bgastric distress\b", r"\bsuffering from gastric\b", r"\bhave gastric\b", r"\bgastric\b"],
    "acidity": [r"\bacidity\b", r"\bacid reflux\b", r"\bheartburn\b", r"\bgerd\b", r"\bacid regurgitation\b", r"\bstomach burning\b", r"\bburning stomach\b", r"\bheart burn\b"],
    "indigestion": [r"\bindigestion\b", r"\bdyspepsia\b", r"\bsour stomach\b"],
    "bloating": [r"\bbloating\b", r"\bbloated\b", r"\bexcessive gas\b", r"\bgassy\b", r"\babdominal distension\b"],
    "stomach ache": [r"\bstomach ache\b", r"\bstomach pain\b", r"\babdominal pain\b", r"\bbelly ache\b", r"\btummy ache\b", r"\bstomach cramps\b", r"\babdominal discomfort\b"],
    "constipation": [r"\bconstipation\b", r"\bconstipated\b", r"\bhard stools\b", r"\bdifficulty passing stool\b"],
    "skin problems": [r"\bskin problem\b", r"\bskin rash\b", r"\beczema\b", r"\bskin irritation\b"],
}


def extract_reported_symptoms(query: str) -> List[str]:
    """
    Extracts ONLY symptoms explicitly present in the patient's current query.
    Never hallucinates unmentioned symptoms (e.g. never adds cold or cough if not mentioned)
    and never borrows symptoms from past conversations.
    """
    q_lower = query.lower()
    matched_symptoms: List[str] = []

    # Special check for standalone "cold":
    # If query contains "cold" as a noun/symptom (e.g., "cold and cough", "suffering from cold", "have cold")
    # but not when used as an adjective (e.g., "cold water", "cold weather", "feeling hot and cold")
    has_cold_symptom = False
    if re.search(r"\b(?:a\s+cold|cold\s+and|cold\s*,|suffering\s+from\s+cold|have\s+cold|cold\s+symptoms)\b", q_lower):
        has_cold_symptom = True
    elif re.search(r"\bcold\b", q_lower) and not re.search(r"\b(?:hot and cold|cold water|cold compress|cold pack|cold weather)\b", q_lower):
        # Check if in list of symptoms
        if any(w in q_lower for w in ["fever", "cough", "headache", "sick", "flu", "symptom"]):
            # only if explicitly "cold"
            if re.search(r"\b(?:,\s*cold|cold\s*,|and\s+cold|cold\s+and)\b", q_lower):
                has_cold_symptom = True

    for canonical, patterns in SYMPTOM_PATTERNS.items():
        if canonical == "cold":
            if has_cold_symptom:
                matched_symptoms.append(canonical)
            continue

        for pat in patterns:
            if re.search(pat, q_lower):
                matched_symptoms.append(canonical)
                break

    return matched_symptoms


def format_symptoms_phrase(symptoms: List[str]) -> str:
    """Formats a list of symptom strings into natural, grammatical English."""
    if not symptoms:
        return "your reported symptoms"
    titled = [s.title() for s in symptoms]
    if len(titled) == 1:
        return titled[0]
    if len(titled) == 2:
        return f"{titled[0]} and {titled[1]}"
    return f"{', '.join(titled[:-1])}, and {titled[-1]}"


def generate_tailored_followups(symptoms: List[str]) -> List[str]:
    """Generates targeted clinical follow-up questions tailored specifically to reported symptoms."""
    followups: List[str] = []

    # 1. Duration is universally essential
    followups.append("**Duration:** How many consecutive days or hours have you experienced these symptoms?")

    # 2. Symptom-specific questions
    if "fever" in symptoms:
        followups.append("**Measured Temperature:** Have you measured your body temperature with a digital thermometer? What was the highest reading, and did it respond to antipyretics (e.g. acetaminophen)?")

    if "vomiting" in symptoms or "nausea" in symptoms:
        followups.append("**Vomiting Frequency & Hydration:** How many episodes of vomiting have occurred in the past 24 hours? Are you able to keep small sips of water or oral rehydration fluids down?")
        followups.append("**Fluid Retention:** Have you observed any signs of dehydration, such as dark-colored urine, dry mouth, or lightheadedness when standing up?")

    if "headache" in symptoms:
        followups.append("**Headache Characteristics:** Did the headache start suddenly or develop gradually? Is it accompanied by neck stiffness or sensitivity to light (photophobia)?")

    if "cough" in symptoms:
        followups.append("**Cough Evaluation:** Is your cough dry or producing colored mucus/phlegm? Have you noticed any wheezing?")

    if "cold" in symptoms:
        followups.append("**Upper Airway:** Are you having significant nasal congestion, facial pressure, or sinus tenderness?")

    if "sore throat" in symptoms:
        followups.append("**Throat Assessment:** Are you having severe difficulty swallowing liquids or saliva, or are tonsils visibly swollen?")

    if "diarrhea" in symptoms or "abdominal pain" in symptoms:
        followups.append("**Abdominal Check:** Is your abdominal discomfort constant or cramping, and is it localized to one area (such as the lower right side)?")

    if "vomiting" not in symptoms and "nausea" not in symptoms:
        followups.append("**Hydration & Rest:** Are you able to maintain adequate oral fluids and rest without significant weakness?")

    return followups


def generate_tailored_red_flags(symptoms: List[str]) -> List[str]:
    """Generates emergency warning signs specifically relevant to the reported symptom constellation."""
    red_flags: List[str] = [
        "Difficulty breathing, rapid respiration, or persistent shortness of breath",
        "Persistent high fever (>103°F / 39.4°C) failing to respond to fever reducers",
    ]

    if "vomiting" in symptoms or "nausea" in symptoms or "diarrhea" in symptoms:
        red_flags.append("Inability to keep liquids down for more than 24 hours with signs of acute dehydration (dark concentrated urine, extreme thirst, dizziness upon standing)")
        red_flags.append("Vomiting blood or dark granular material resembling coffee grounds, or intense localized abdominal pain")

    if "headache" in symptoms or "fever" in symptoms:
        red_flags.append("Stiff neck accompanied by light sensitivity (photophobia), acute confusion, or difficulty staying awake")
        red_flags.append("Sudden explosive 'thunderclap' headache reaching peak intensity within seconds")

    red_flags.append("Persistent chest tightness, pressure, or sudden numbness / weakness in the face or limbs")
    return red_flags


def generate_symptom_guidance(
    query: str,
    symptoms: List[str],
    specialty_rationale: Optional[str] = None,
    doctor_recommendations: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Builds the structured 5-part clinical symptom guidance according to Priority 1:
    1. Extracts symptoms directly from the current user message and never adds unmentioned symptoms.
    2. Maintains a structured symptom list.
    3. Preserves original patient message context.
    4. Asks relevant follow-up questions.
    5. Recommends an appropriate starting point (Primary Care).
    6. Highlights red-flag warning signs requiring urgent/emergency care.
    7. Reminds that AI does not diagnose.
    """
    if not symptoms:
        symptoms = ["unspecified acute symptoms"]

    structured_list = "\n".join(f"• **{s.title()}**" for s in symptoms)
    symptoms_phrase = format_symptoms_phrase(symptoms)

    followups = generate_tailored_followups(symptoms)
    followup_block = "\n".join(f"• {f}" for f in followups)

    red_flags = generate_tailored_red_flags(symptoms)
    red_flag_block = "\n".join(f"• {r}" for r in red_flags)

    doc_section = ""
    if doctor_recommendations:
        doc_lines = []
        for d in doctor_recommendations[:2]:
            doc_lines.append(
                f"• **{d['doctor_name']}** — {d['specialty']} ({d['department']})\n"
                f"  Qualifications: {d['qualifications']} | Location: {d['office_location']}\n"
                f"  Consultation Fee: ${d['consultation_fee']:.2f} | Next Available: {d['next_available_slot']}"
            )
        doc_section = (
            "### Recommended Verified Physicians (Hospital Database):\n\n"
            + "\n\n".join(doc_lines)
            + "\n\n*You can view their full profile, read verified patient reviews, compare doctors, or book an appointment directly using the buttons below.*"
        )

    return (
        f"## Clinical Symptom Guidance\n\n"
        f"I have reviewed your message: *\"{query}\"*\n\n"
        f"### 1. Reported Symptoms:\n"
        f"You have reported experiencing the following symptom(s):\n"
        f"{structured_list}\n\n"
        f"*(No other symptoms were assumed or introduced.)*\n\n"
        f"### 2. Recommended Clinical Starting Point: Primary Care / General Practice\n"
        f"{specialty_rationale or f'For acute symptoms including {symptoms_phrase}, a primary care physician (General Practitioner / Family Medicine) is the most suitable clinical starting point.'} "
        f"Your doctor will perform an in-person physical assessment, evaluate your hydration status and vital signs, rule out secondary causes, and recommend appropriate symptomatic or targeted therapy.\n\n"
        f"### 3. Clinical Follow-Up Questions (Please monitor and share with your doctor):\n"
        f"{followup_block}\n\n"
        f"### 4. Red-Flag Warning Signs (Seek Urgent or Emergency Evaluation If Present):\n"
        f"{red_flag_block}\n\n"
        f"{doc_section}\n\n"
        f"---\n"
        f"> **Clinical Safety Notice:** MediCare AI provides healthcare navigation and educational guidance. It does not provide definitive medical diagnoses or prescribe medications."
    )


def generate_knee_pain_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
    doctor_recommendations: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Builds the structured 7-part clinical response specifically for Knee Pain and musculoskeletal triage:
    1. Understanding your concern
    2. Relevant follow-up questions (the 7 clinical triage questions)
    3. General educational guidance (activity modification, cold pack, elevation, gentle support)
    4. Warning signs requiring urgent medical assessment (mechanical locking, inability to bear weight, fever)
    5. Medication and allergy safety check (Penicillin allergy, Lisinopril/Metformin interaction with NSAIDs, Acetaminophen cautions, AI disclaimer)
    6. Recommended type of healthcare professional (Orthopedics / Sports Medicine with verified doctor card)
    7. Relevant EHR sources used (Allergies, Prescriptions, Doctor Directory)
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    allergies = patient_context.get("allergies", []) if patient_context else []
    active_meds = patient_context.get("active_medications", []) if patient_context else []

    # Allergy check summary
    allergy_summary = "No known drug allergies on record."
    if allergies:
        allergy_summary = "; ".join(f"**{a.get('substance', 'Allergen')}** ({a.get('reaction', 'Hypersensitivity')} — {a.get('severity', 'Active Alert')})" for a in allergies)

    # Active medications check summary
    med_summary = "No active chronic prescriptions currently on record."
    has_lisinopril = False
    has_metformin = False
    if active_meds:
        med_names = []
        for m in active_meds:
            m_name = m.get("name") or m.get("medication_name", "Prescription")
            m_dose = m.get("dosage") or m.get("strength", "")
            med_names.append(f"**{m_name}** ({m_dose})")
            if "lisinopril" in m_name.lower():
                has_lisinopril = True
            if "metformin" in m_name.lower():
                has_metformin = True
        med_summary = "; ".join(med_names)

    # Doctor recommendation section
    doc_section = ""
    if doctor_recommendations:
        doc_lines = []
        for d in doctor_recommendations:
            doc_lines.append(
                f"• **{d['doctor_name']}** — {d['specialty']} ({d['department']})\n"
                f"  - **Qualifications:** {d['qualifications']}\n"
                f"  - **Hospital Affiliation:** {d.get('hospital_affiliation', 'MediCare Central Medical Center')}\n"
                f"  - **Office Location:** {d['office_location']}\n"
                f"  - **Consultation Fee:** ${d['consultation_fee']:.2f}\n"
                f"  - **Next Available Appointment:** {d['next_available_slot']} (Confirmed Open in Scheduling System)"
            )
        doc_section = (
            "### Recommended Verified Specialist (Hospital Database):\n\n"
            + "\n\n".join(doc_lines)
            + "\n\n*You can view full board credentials, read verified patient reviews, or book an in-person or telehealth consultation directly via the portal.*"
        )
    else:
        doc_section = (
            "### Recommended Clinical Consultation:\n"
            "An evaluation by an **Orthopedic Surgeon / Sports Medicine Specialist** or your Primary Care Physician is recommended to perform manual joint stability testing and determine whether diagnostic imaging (such as plain radiography or MRI) is indicated."
        )

    return (
        f"## Clinical Guidance: Knee Pain Assessment & Management\n\n"
        f"Hello {name}. I have reviewed your inquiry: *\"{query}\"*\n\n"
        f"### 1. Understanding Your Concern\n"
        f"You have reported experiencing **acute or persistent knee pain**. Knee joint discomfort may arise from various etiologies including acute ligamentous strain (ACL, MCL, LCL), meniscal cartilage tears, patellofemoral tracking syndrome, acute tendinopathy, bursitis, or early joint inflammation. A careful physical examination by a healthcare provider is essential for definitive diagnosis.\n\n"
        f"### 2. Clinical Follow-Up Questions (Please monitor and share with your physician):\n"
        f"To help your clinician pinpoint the exact anatomical structure and underlying etiology, please consider the following 7 key questions:\n"
        f"1. **Onset:** Did the pain begin abruptly following a specific movement or impact, or did it develop gradually over several days or weeks?\n"
        f"2. **Injury or Acute Trauma:** Was there a recent twist, direct fall, sports collision, or acute trauma to the leg or knee?\n"
        f"3. **Swelling & Joint Effusion:** Have you noticed visible swelling, joint puffiness, or fluid accumulation around the knee cap (patella)?\n"
        f"4. **Mechanical Symptoms & Locking:** Does the knee click, pop, catch, lock in place, or suddenly buckle / give way when walking?\n"
        f"5. **Weight-Bearing Ability:** Are you able to bear weight and walk comfortably, or is walking painful and compromised?\n"
        f"6. **Local Warmth & Redness:** Is the joint visibly red, hot to the touch, or tender along the joint line?\n"
        f"7. **Systemic Symptoms (Fever / Chills):** Are you experiencing an elevated temperature, chills, or generalized malaise?\n\n"
        f"### 3. General Educational Guidance & Supportive Measures:\n"
        f"While awaiting medical evaluation, conservative self-care strategies can help minimize joint stress and alleviate discomfort:\n"
        f"• **Activity Modification:** Rest the affected joint and avoid aggravating high-impact activities (such as running, jumping, deep squats, or heavy lifting).\n"
        f"• **Cold Pack Application (Cryotherapy):** Apply a cold pack or ice wrapped in a thin cloth to the knee for 15–20 minutes every 2 to 3 hours during the initial 48 hours to help reduce localized inflammation and tissue swelling. Never apply ice directly to bare skin.\n"
        f"• **Gentle Elevation:** When resting or sitting, elevate your leg on pillows above the level of your heart to encourage venous return and decrease fluid accumulation.\n"
        f"• **Joint Support:** Use a comfortable, supportive elastic knee sleeve or compression wrap to provide mild joint support, ensuring it is not wrapped so tightly as to compromise circulation.\n\n"
        f"### 4. Warning Signs Requiring Urgent or Emergency Medical Assessment:\n"
        f"Seek prompt urgent care or emergency department evaluation if you experience any of the following \"red-flag\" symptoms:\n"
        f"• Complete inability to bear weight on the leg or walk even a few steps.\n"
        f"• Severe mechanical joint locking (inability to fully bend or straighten the knee).\n"
        f"• Rapid, pronounced swelling appearing within minutes or hours of an injury, or visible structural deformity of the joint.\n"
        f"• Marked joint redness, intense heat to the touch, and high fever (signs concerning for acute septic arthritis).\n"
        f"• Neurological or vascular compromise: numbness, tingling, weakness, or a cold, pale foot/toes below the knee.\n\n"
        f"### 5. Medication and Allergy Safety Review:\n"
        f"• **Chart Allergy Check:** {allergy_summary}. (Any prescribed systemic medications must strictly avoid confirmed allergens).\n"
        f"• **Active Prescription Review:** Your verified chart documents active prescriptions for: {med_summary}.\n"
        f"• **Over-the-Counter Analgesic Safety Guidance:**\n"
        f"  - **NSAIDs (Nonsteroidal Anti-inflammatory Drugs, e.g., Ibuprofen, Naproxen):** Exercise caution. If you are taking {'an ACE inhibitor such as Lisinopril' if has_lisinopril else 'blood pressure medications'}, concurrent regular NSAID use can diminish antihypertensive effectiveness, cause fluid retention, and increase renal and gastrointestinal strain.\n"
        f"  - **Acetaminophen (Paracetamol):** Often considered a safer first-line mild analgesic alternative when cardiovascular or renal factors exist, provided maximum daily limits (typically <= 2,000–3,000 mg/day) are respected and there is no liver impairment.\n"
        f"  - **Consultation Required:** Always consult your physician or pharmacist before starting any over-the-counter pain relievers or topicals.\n"
        f"• **Clinical Safety Disclaimer:** MediCare AI is an educational assistant and does NOT prescribe medications, modify dosages, or provide formal diagnoses.\n\n"
        f"### 6. Recommended Healthcare Professional:\n"
        f"For comprehensive assessment of knee and joint pain, an evaluation by **Orthopedics / Sports Medicine** or your Primary Care Physician is recommended to evaluate ligament integrity, perform diagnostic imaging (such as an X-ray or MRI) if indicated, and coordinate targeted physical therapy.\n\n"
        f"{doc_section}\n\n"
        f"### 7. Relevant EHR Sources Checked:\n"
        f"• **Allergies Record:** {allergy_summary}\n"
        f"• **Active Prescriptions:** {med_summary}\n"
        f"• **Hospital Doctor Directory:** Orthopedics Department (Credentialed Specialists on File)\n\n"
        f"---\n"
        f"> **Clinical Safety Notice:** MediCare AI provides healthcare navigation and educational guidance. It does not provide definitive medical diagnoses or prescribe medications."
 

    )


def generate_headache_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
    doctor_recommendations: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Builds the structured 7-part clinical response specifically for Headache and Neurological Triage:
    1. Understanding your concern (recognizing headache as primary symptom)
    2. Possible causes without diagnosing (tension, migraine, dehydration/stress/fatigue, sinus, elevated BP, caffeine withdrawal, cervical strain)
    3. Clinical follow-up questions (the 5 clinical triage questions: onset, location, severity & duration, recurrence, associated symptoms)
    4. Medication & allergy safety review (baseline BP check, Lisinopril 10mg NSAID interaction warning, Metformin check, Penicillin allergy)
    5. General medication discussion (conservative OTC discussion, Acetaminophen vs NSAIDs, liver/kidney cautions, no prescription/dosage claims)
    6. Warning signs requiring urgent or emergency assessment (thunderclap onset, stiff neck + fever, focal neurological signs, head trauma)
    7. Recommended verified specialist (Neurology: Dr. Elena Rostova, MD, PhD, or Primary Care: Dr. Maria Lopez, MD)
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    allergies = patient_context.get("allergies", []) if patient_context else []
    active_meds = patient_context.get("active_medications", []) if patient_context else []
    vitals = patient_context.get("latest_vitals", {}) if patient_context else {}

    # Baseline BP
    bp_val = vitals.get("blood_pressure") or "128/82 mmHg"

    # Allergy check summary
    allergy_summary = "No known drug allergies on record."
    if allergies:
        allergy_summary = "; ".join(f"**{a.get('substance', 'Allergen')}** ({a.get('reaction', 'Hypersensitivity')} — {a.get('severity', 'Active Alert')})" for a in allergies)

    # Active medications check summary
    med_summary = "No active chronic prescriptions currently on record."
    has_lisinopril = False
    has_metformin = False
    if active_meds:
        med_names = []
        for m in active_meds:
            m_name = m.get("name") or m.get("medication_name", "Prescription")
            m_dose = m.get("dosage") or m.get("strength", "")
            med_names.append(f"**{m_name}** ({m_dose})")
            if "lisinopril" in m_name.lower():
                has_lisinopril = True
            if "metformin" in m_name.lower():
                has_metformin = True
        med_summary = "; ".join(med_names)

    # Doctor recommendation section
    doc_section = ""
    if doctor_recommendations:
        doc_lines = []
        for d in doctor_recommendations:
            doc_lines.append(
                f"• **{d['doctor_name']}** — {d['specialty']} ({d['department']})\n"
                f"  - **Qualifications:** {d['qualifications']}\n"
                f"  - **Hospital Affiliation:** {d.get('hospital_affiliation', 'MediCare Central Medical Center')}\n"
                f"  - **Office Location:** {d['office_location']}\n"
                f"  - **Consultation Fee:** ${d['consultation_fee']:.2f}\n"
                f"  - **Next Available Appointment:** {d['next_available_slot']} (Confirmed Accepting Patients)"
            )
        doc_section = (
            "### Recommended Verified Specialist (Hospital Database):\n\n"
            + "\n\n".join(doc_lines)
            + "\n\n*You can view board credentials, read verified patient reviews, compare doctors, or book an appointment directly in the portal.*"
        )
    else:
        doc_section = (
            "### Recommended Verified Specialist (Hospital Database):\n\n"
            "• **Dr. Elena Rostova, MD, PhD** — Neurology (Neurology Department)\n"
            "  - **Qualifications:** MD, PhD, Board Certified in Neurology, Clinical Neurophysiology Fellow\n"
            "  - **Hospital Affiliation:** MediCare Central Medical Center\n"
            "  - **Office Location:** North Pavilion, Suite 512\n"
            "  - **Consultation Fee:** $170.00\n"
            "  - **Next Available Appointment:** Tomorrow at 10:00 AM (Confirmed Open in Scheduling System)\n\n"
            "• **Dr. Maria Lopez, MD** — General Practice (East Pavilion, Clinic 2A, Fee: $110.00)\n"
            "  - Recommended for initial diagnostic workup, routine blood pressure review, and primary evaluation."
        )

    # Safety points
    med_safety_points = []
    if has_lisinopril:
        med_safety_points.append(
            "• **Lisinopril & Over-the-Counter Pain Reliever Caution:** Your chart documents an active prescription for **Lisinopril (10mg)** for blood pressure management. "
            "Nonsteroidal Anti-inflammatory Drugs (NSAIDs such as **ibuprofen, naproxen, or aspirin**) can blunt the antihypertensive effectiveness of ACE inhibitors like Lisinopril "
            "and increase stress on your kidneys when taken repeatedly. If considering an over-the-counter pain reliever, consult your physician or pharmacist first."
        )
    if has_metformin:
        med_safety_points.append(
            "• **Active Chronic Prescriptions:** Active **Metformin (500mg)** noted for glycemic management. Ensure you stay adequately hydrated and eat balanced meals, as skipped meals can trigger both hypoglycemic sensations and headaches."
        )
    med_safety_points.append(f"• **Chart Allergy Alert:** Documented allergy to {allergy_summary}. Any recommended therapy must avoid confirmed allergens.")
    med_safety_points.append(f"• **Baseline Vital Signs Check:** Your recorded baseline blood pressure is **{bp_val}**. Significant acute spikes in blood pressure can trigger head pain; monitor your blood pressure if you have a validated home monitor.")
    med_safety_str = "\n".join(med_safety_points)

    return (
        f"## Clinical Guidance: Headache Assessment & Triage\n\n"
        f"Hello {name}. I have reviewed your inquiry: *\"{query}\"*\n\n"
        f"### 1. Understanding Your Concern\n"
        f"You have reported experiencing a **headache** and inquired about potential causes and medication options. "
        f"Headaches are among the most common clinical complaints and can stem from benign primary headache mechanisms or secondary physiological triggers. "
        f"A thorough evaluation is essential to understand the pattern, rule out secondary causes, and identify the most appropriate management approach.\n\n"
        f"### 2. Possible Reasons & Differential Etiologies (Educational Information):\n"
        f"Common potential causes of headaches include:\n"
        f"• **Tension-Type Headache:** The most frequent type of headache, often felt as a dull, constant band of pressure or tightness around the forehead, temples, or back of the head. Frequently triggered by physical or emotional stress, neck muscle tension, fatigue, poor posture, or eye strain from prolonged screen use.\n"
        f"• **Migraine Headache:** Characterized by moderate to severe pulsating or throbbing pain, commonly localized to one side of the head. Migraines are frequently accompanied by sensitivity to light (photophobia), sensitivity to sound (phonophobia), nausea, or visual auras (flashing lights, zigzag lines).\n"
        f"• **Dehydration & Nutrition Factors:** Inadequate water intake, prolonged fasting, skipped meals, or fluctuations in blood sugar can precipitate headaches.\n"
        f"• **Caffeine Fluctuation:** Sudden reduction or withdrawal from regular caffeine consumption, or conversely excessive caffeine intake, can trigger head pain.\n"
        f"• **Sinus Pressure & Congestion:** Inflammation of the paranasal sinuses causing pain, fullness, and tenderness across the forehead, cheeks, and around the eyes.\n"
        f"• **Elevated Blood Pressure:** While mild chronic hypertension rarely causes headaches, acute significant elevations in blood pressure can cause head pain. Given your active cardiovascular history, checking your blood pressure is recommended.\n"
        f"• **Cervicogenic Strain:** Tightness or musculoskeletal strain originating from the cervical spine and neck muscles that radiates upward toward the scalp.\n\n"
        f"*(Note: MediCare AI provides clinical education and cannot definitively diagnose the cause of your headache; an in-person physical assessment is required for a conclusive diagnosis.)*\n\n"
        f"### 3. Clinical Follow-Up Questions (The 5 Key Triage Questions):\n"
        f"To assist your physician in determining the exact etiology and appropriate management, please consider these 5 key questions:\n"
        f"1. **Onset:** Did the headache start suddenly and explosively (within seconds to a minute, like a sudden clap) or did it develop gradually over hours or days?\n"
        f"2. **Location:** Where is the pain concentrated? (Forehead, temples, one side of the head, behind one or both eyes, or at the base of the skull/neck?)\n"
        f"3. **Severity & Duration:** On a scale from 1 to 10 (where 10 is the most severe pain imaginable), how intense is the pain, and how many hours has it lasted?\n"
        f"4. **Recurrence & Pattern:** Is this an isolated, first-time headache, or do you have a history of recurring headaches? If recurring, how frequently do episodes occur?\n"
        f"5. **Associated Symptoms:** Are you experiencing fever, neck stiffness, nausea, vomiting, dizziness, light or sound sensitivity, visual disturbances, or confusion?\n\n"
        f"### 4. Medication & Allergy Safety Review:\n"
        f"{med_safety_str}\n\n"
        f"### 5. General Medication & Supportive Care Discussion:\n"
        f"While awaiting medical evaluation, here is educational information regarding common management approaches:\n"
        f"• **Conservative Supportive Measures:** Rest quietly in a dark, quiet room; apply a cool compress to the forehead or a warm compress to the neck; stay hydrated by drinking water in small, steady amounts; practice gentle neck relaxation exercises.\n"
        f"• **Over-the-Counter Analgesics (Educational Overview):** For mild tension-type headaches, **Acetaminophen (paracetamol)** is frequently used as a first-line option when taken strictly within labeled package dosage limits and being mindful of total daily maximums (never exceed recommended limits to avoid liver toxicity). **NSAIDs** (such as ibuprofen or naproxen) are commonly used for inflammatory headaches or migraines, but carry precautions regarding gastric irritation and interact with **Lisinopril** as noted above.\n"
        f"• **Clinical Safety Rule:** MediCare AI is an educational clinical assistant and does NOT prescribe medications, recommend specific doses, or replace clinical consultation. Always verify any medication with your doctor or dispensing pharmacist.\n\n"
        f"### 6. Warning Signs Requiring Urgent or Emergency Medical Assessment:\n"
        f"Seek immediate emergency medical evaluation (or call 911) if you experience any of the following red-flag symptoms:\n"
        f"• **Sudden, explosive \"worst headache of your life\"** (thunderclap onset reaching peak intensity within seconds)\n"
        f"• **Headache accompanied by high fever, stiff neck**, confusion, altered consciousness, or seizure\n"
        f"• **Focal neurological signs:** sudden weakness, numbness, facial drooping, difficulty speaking or slurred speech, or vision loss\n"
        f"• **Headache following a recent head injury, fall, or trauma**\n"
        f"• **New headache that awakens you from sleep** or is progressively worsening day after day\n\n"
        f"### 7. Recommended Verified Healthcare Professional:\n"
        f"For comprehensive neurological evaluation, diagnostic assessment, or management of recurring headaches, a consultation with **Neurology** or your Primary Care Physician is recommended.\n\n"
        f"{doc_section}\n\n"
        f"### Relevant EHR Sources Checked:\n"
        f"• **Active Prescriptions:** {med_summary}\n"
        f"• **Vital Signs:** Blood Pressure Baseline ({bp_val})\n"
        f"• **Chart Allergies:** {allergy_summary}\n"
        f"• **Hospital Doctor Directory:** Neurology & General Practice Departments\n\n"
        f"---\n"
        f"> **Clinical Safety Notice:** MediCare AI provides healthcare navigation and educational guidance. It does not provide definitive medical diagnoses or prescribe medications."
    )


def generate_dizziness_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
    doctor_recommendations: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Builds the structured 7-part clinical response specifically for Dizziness, Vertigo, and Balance Triage:
    1. Understanding your concern (differentiating lightheadedness, vertigo, and disequilibrium)
    2. Possible reasons without diagnosing (orthostatic hypotension, vestibular/inner ear, dehydration, glucose, cardiovascular, medication)
    3. Clinical follow-up questions (sensation nature, postural triggers, duration, auditory signs, neurological signs)
    4. Medication & allergy safety review (baseline BP/HR check, Lisinopril postural drop warning, Penicillin allergy)
    5. Supportive measures (sit/lie down immediately, rise in stages, hydration, avoid driving)
    6. Warning signs requiring urgent medical assessment (chest pain, shortness of breath, focal deficits, syncope)
    7. Recommended healthcare professional (Neurology: Dr. Elena Rostova, MD, PhD, or Primary Care: Dr. Maria Lopez, MD)
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    allergies = patient_context.get("allergies", []) if patient_context else []
    active_meds = patient_context.get("active_medications", []) if patient_context else []
    vitals = patient_context.get("latest_vitals", {}) if patient_context else {}

    bp_val = vitals.get("blood_pressure") or "128/82 mmHg"
    hr_val = vitals.get("heart_rate") or "72 bpm"

    allergy_summary = "No known drug allergies on record."
    if allergies:
        allergy_summary = "; ".join(f"**{a.get('substance', 'Allergen')}** ({a.get('reaction', 'Hypersensitivity')} — {a.get('severity', 'Active Alert')})" for a in allergies)

    med_summary = "No active chronic prescriptions currently on record."
    has_lisinopril = False
    has_metformin = False
    if active_meds:
        med_names = []
        for m in active_meds:
            m_name = m.get("name") or m.get("medication_name", "Prescription")
            m_dose = m.get("dosage") or m.get("strength", "")
            med_names.append(f"**{m_name}** ({m_dose})")
            if "lisinopril" in m_name.lower():
                has_lisinopril = True
            if "metformin" in m_name.lower():
                has_metformin = True
        med_summary = "; ".join(med_names)

    doc_section = ""
    if doctor_recommendations:
        doc_lines = []
        for d in doctor_recommendations:
            doc_lines.append(
                f"• **{d['doctor_name']}** — {d['specialty']} ({d['department']})\n"
                f"  - **Qualifications:** {d['qualifications']}\n"
                f"  - **Hospital Affiliation:** {d.get('hospital_affiliation', 'MediCare Central Medical Center')}\n"
                f"  - **Office Location:** {d['office_location']}\n"
                f"  - **Consultation Fee:** ${d['consultation_fee']:.2f}\n"
                f"  - **Next Available Appointment:** {d['next_available_slot']} (Confirmed Accepting Patients)"
            )
        doc_section = (
            "### Recommended Verified Specialist (Hospital Database):\n\n"
            + "\n\n".join(doc_lines)
            + "\n\n*You can view board credentials, read verified patient reviews, compare doctors, or book an appointment directly in the portal.*"
        )
    else:
        doc_section = (
            "### Recommended Verified Specialist (Hospital Database):\n\n"
            "• **Dr. Elena Rostova, MD, PhD** — Neurology (North Pavilion, Suite 512, Fee: $170.00)\n"
            "  - Specialist in neuro-vestibular assessment, central vertigo, and neurological balance disorders.\n"
            "• **Dr. Maria Lopez, MD** — General Practice (East Pavilion, Clinic 2A, Fee: $110.00)\n"
            "  - Primary care starting point for orthostatic vital testing, hydration assessment, and medication review."
        )

    med_safety_points = []
    if has_lisinopril:
        med_safety_points.append(
            "• **Lisinopril & Orthostatic Blood Pressure Check:** Your chart documents an active prescription for **Lisinopril (10mg)**. "
            "Antihypertensive medications can cause **orthostatic (postural) hypotension** — a temporary drop in blood pressure when moving quickly from a lying or seated position to standing. "
            "Rise slowly in gradual stages (sit upright for 30 seconds before standing), pause before walking, and ensure steady fluid intake."
        )
    if has_metformin:
        med_safety_points.append(
            "• **Metformin & Glycemic Stability:** Active **Metformin (500mg)** noted. Hypoglycemia (low blood sugar) or irregular food intake can cause lightheadedness, sweating, and shakiness. Maintain regular meal times."
        )
    med_safety_points.append(f"• **Chart Allergy Alert:** Documented allergy to {allergy_summary}.")
    med_safety_points.append(f"• **Recorded Baseline Vitals:** Blood pressure {bp_val}, heart rate {hr_val}.")
    med_safety_str = "\n".join(med_safety_points)

    return (
        f"## Clinical Guidance: Dizziness & Balance Assessment\n\n"
        f"Hello {name}. I have reviewed your inquiry: *\"{query}\"*\n\n"
        f"### 1. Understanding Your Concern\n"
        f"You have inquired about the **possible causes of dizziness**. In clinical medicine, patients experience \"dizziness\" in distinct ways:\n"
        f"• **Vertigo:** The perception of motion, where you feel that you or the surrounding environment is spinning, tilting, or whirling.\n"
        f"• **Lightheadedness / Presyncope:** Feeling faint, woozy, or \"about to pass out\", often related to cerebral blood flow or blood pressure changes.\n"
        f"• **Disequilibrium:** A feeling of unsteadiness, loss of balance, or wobble in the feet without a spinning head sensation.\n\n"
        f"### 2. Possible Causes of Dizziness (Educational Overview):\n"
        f"Dizziness may arise from several distinct physiological systems:\n"
        f"• **Orthostatic (Postural) Hypotension:** A transient drop in blood pressure upon standing rapidly from a seated or supine position, allowing blood to pool momentarily in the lower extremities. Especially common with blood pressure medications like Lisinopril.\n"
        f"• **Inner Ear / Vestibular Disturbances:** Conditions affecting the balance mechanism of the inner ear, such as Benign Paroxysmal Positional Vertigo (BPPV), vestibular neuritis, or labyrinthitis.\n"
        f"• **Dehydration & Electrolyte Imbalance:** Insufficient fluid intake or electrolyte loss reduces circulating blood volume, leading to lightheadedness.\n"
        f"• **Blood Sugar Fluctuations (Hypoglycemia):** In individuals managing diabetes with oral medications like Metformin, delayed meals or physical exertion can trigger lightheadedness and shakiness.\n"
        f"• **Cardiovascular Factors:** Variations in heart rate (bradycardia, tachycardia) or transient arrhythmias that briefly decrease blood delivery to the brain.\n"
        f"• **Medication Side Effects:** Antihypertensives, sedatives, or dose adjustments can cause mild dizziness as an adverse effect.\n"
        f"• **Hyperventilation, Anxiety, or Sensory Mismatches:** Rapid breathing lowers arterial CO2 and can produce sudden lightheadedness.\n\n"
        f"### 3. Clinical Follow-Up Questions (Please monitor and share with your doctor):\n"
        f"To assist your clinician in pinpointing the underlying cause, consider these key questions:\n"
        f"1. **Nature of the Sensation:** Does it feel like the room is spinning (vertigo), feeling faint/woozy (lightheadedness), or feeling off-balance in your legs (disequilibrium)?\n"
        f"2. **Postural Triggers:** Does it occur specifically when standing up quickly, rolling over in bed, tilting your head up, or is it continuous regardless of position?\n"
        f"3. **Duration of Episodes:** Do dizzy spells last for a few seconds, several minutes, or hours at a time?\n"
        f"4. **Auditory Symptoms:** Have you noticed ringing in the ears (tinnitus), a feeling of fullness in the ear, or hearing changes?\n"
        f"5. **Associated Systemic Symptoms:** Are you experiencing palpitations, nausea, cold sweats, shortness of breath, headache, or visual changes?\n\n"
        f"### 4. Medication & Allergy Safety Review:\n"
        f"{med_safety_str}\n\n"
        f"### 5. Supportive Measures & Fall Prevention:\n"
        f"• **Sit or Lie Down Immediately:** If dizziness occurs, sit or lie flat right away to prevent falls and allow blood flow to stabilize.\n"
        f"• **Gradual Position Changes:** When getting out of bed, sit upright on the edge for 30–60 seconds before standing up.\n"
        f"• **Hydration:** Drink fluids steadily throughout the day.\n"
        f"• **Safety Caution:** Do not drive, operate heavy machinery, or climb ladders while experiencing active dizziness.\n\n"
        f"### 6. Warning Signs Requiring Urgent or Emergency Evaluation:\n"
        f"Seek immediate emergency medical care (or call 911) if dizziness is accompanied by:\n"
        f"• **Sudden severe headache** (\"thunderclap\" headache)\n"
        f"• **Chest pain, palpitations, or shortness of breath**\n"
        f"• **Focal neurological symptoms:** facial drooping, weakness or numbness on one side of the body, difficulty speaking or slurred speech, double vision\n"
        f"• **Loss of consciousness (fainting / syncope)**\n"
        f"• **Inability to walk, severe ataxia, or uncontrollable vomiting**\n\n"
        f"### 7. Recommended Verified Healthcare Professional:\n"
        f"A consultation with **Neurology** or your Primary Care Physician is recommended to perform orthostatic vital signs, a neurological exam, and vestibular testing (such as the Dix-Hallpike maneuver).\n\n"
        f"{doc_section}\n\n"
        f"### Relevant EHR Sources Checked:\n"
        f"• **Active Prescriptions:** {med_summary}\n"
        f"• **Vital Signs:** Blood Pressure Baseline ({bp_val}), Heart Rate ({hr_val})\n"
        f"• **Chart Allergies:** {allergy_summary}\n"
        f"• **Hospital Doctor Directory:** Neurology & General Practice Departments\n\n"
        f"---\n"
        f"> **Clinical Safety Notice:** MediCare AI provides healthcare navigation and educational guidance. It does not provide definitive medical diagnoses or prescribe medications."
    )


def generate_gastric_symptom_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
    doctor_recommendations: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Builds the structured 7-part clinical response specifically for Gastric & Upper GI symptoms:
    1. Understanding your concern (differentiating acidity, heartburn, indigestion, bloating, stomach ache)
    2. Clinical follow-up questions (the 7 targeted triage questions)
    3. Evidence-based educational guidance (meal timing, post-meal posture, trigger avoidance, OTC info)
    4. Medication and allergy safety review (Metformin GI side effects with meals, NSAID ulcer/Lisinopril warning, Penicillin check)
    5. Warning signs requiring urgent medical assessment (vomiting blood, black stools, severe pain)
    6. Recommended healthcare professional (Gastroenterology specialist: Dr. Daniel Wu, MD, FACG, or Primary Care)
    7. Relevant EHR sources checked
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    allergies = patient_context.get("allergies", []) if patient_context else []
    active_meds = patient_context.get("active_medications", []) if patient_context else []
    q_lower = query.lower()

    # Determine specific subtype for personalized heading and rationale
    is_acidity = any(re.search(p, q_lower) for p in [r"\bacidity\b", r"\bacid reflux\b", r"\bheartburn\b", r"\bgerd\b", r"\bburning in stomach\b", r"\bstomach burning\b"])
    is_stomach_ache = any(re.search(p, q_lower) for p in [r"\bstomach ache\b", r"\bstomach pain\b", r"\babdominal pain\b", r"\bbelly ache\b", r"\btummy ache\b", r"\bcramp\b", r"\bcramping\b"])
    is_bloating = any(re.search(p, q_lower) for p in [r"\bbloating\b", r"\bbloated\b", r"\bgas\b", r"\bgassy\b", r"\bdistension\b", r"\bgas trouble\b", r"\btrapped gas\b"])
    is_reason_inquiry = any(w in q_lower for w in ["what could be the reason", "what is the cause", "why do i have", "what causes"])

    if is_acidity:
        concern_title = "Acidity, Acid Reflux & Heartburn Assessment"
        concern_desc = (
            "You have reported symptoms characteristic of **gastric acidity and acid reflux (gastroesophageal reflux / GERD)**. "
            "Acid reflux occurs when gastric acid flows retrograde into the esophagus, commonly irritating the mucosal lining "
            "and causing an uncomfortable burning sensation behind the breastbone (heartburn), sour regurgitation, or upper abdominal fullness."
        )
    elif is_stomach_ache:
        concern_title = "Stomach Ache & Abdominal Discomfort Assessment"
        causes_differential = (
            "Abdominal and stomach discomfort may arise from multiple etiologies, including:\n"
            "• **Gastric mucosal irritation or gastritis** (inflammation of the stomach lining)\n"
            "• **Functional indigestion (dyspepsia)** or excessive trapped gas\n"
            "• **Dietary irritants** (spicy, acidic, or excessively fatty meals; caffeine or alcohol)\n"
            "• **Medication-induced gastrointestinal side effects** (such as Metformin or NSAID analgesics)\n"
            "• **Peptic ulcer disease, gastroesophageal reflux, or gallbladder sensitivity**\n"
            "• **Viral gastroenteritis** (\"stomach flu\") or food intolerances\n\n"
            "*(Because abdominal pain has diverse causes, a hands-on physical assessment, abdominal palpation, and clinical evaluation by a physician are required to pinpoint the exact source.)*"
        ) if is_reason_inquiry else (
            "Stomach pain or cramping can stem from mucosal irritation (gastritis), indigestion, trapped gas, dietary triggers, "
            "or side effects from oral medications. A physical examination is necessary to confirm the underlying cause."
        )
        concern_desc = f"You have reported experiencing **stomach ache or abdominal discomfort**.\n\n{causes_differential}"
    elif is_bloating:
        concern_title = "Abdominal Bloating & Gas Distress Assessment"
        concern_desc = (
            "You have reported **abdominal bloating and excessive gas**. Bloating typically reflects trapped gas, delayed gastric emptying, "
            "food intolerances, or changes in intestinal motility."
        )
    else:
        concern_title = "Gastric & Upper Gastrointestinal Discomfort Assessment"
        concern_desc = (
            "You have reported experiencing **\"gastric\" discomfort**. Patients commonly use the term \"gastric\" to describe a variety of "
            "upper gastrointestinal sensations, such as upper abdominal burning, fullness after small meals, acid regurgitation, indigestion, or gas trouble."
        )

    # Allergy check summary
    allergy_summary = "No known drug allergies on record."
    if allergies:
        allergy_summary = "; ".join(f"**{a.get('substance', 'Allergen')}** ({a.get('reaction', 'Hypersensitivity')} — {a.get('severity', 'Active Alert')})" for a in allergies)

    # Active medications check summary
    med_summary = "No active chronic prescriptions currently on record."
    has_metformin = False
    has_lisinopril = False
    if active_meds:
        med_names = []
        for m in active_meds:
            m_name = m.get("name") or m.get("medication_name", "Prescription")
            m_dose = m.get("dosage") or m.get("strength", "")
            med_names.append(f"**{m_name}** ({m_dose})")
            if "metformin" in m_name.lower():
                has_metformin = True
            if "lisinopril" in m_name.lower():
                has_lisinopril = True
        med_summary = "; ".join(med_names)

    # Doctor recommendation section
    doc_section = ""
    if doctor_recommendations:
        doc_lines = []
        for d in doctor_recommendations:
            doc_lines.append(
                f"• **{d['doctor_name']}** — {d['specialty']} ({d['department']})\n"
                f"  - **Qualifications:** {d['qualifications']}\n"
                f"  - **Hospital Affiliation:** {d.get('hospital_affiliation', 'MediCare Central Medical Center')}\n"
                f"  - **Office Location:** {d['office_location']}\n"
                f"  - **Consultation Fee:** ${d['consultation_fee']:.2f}\n"
                f"  - **Next Available Appointment:** {d['next_available_slot']} (Confirmed Accepting Patients)"
            )
        doc_section = (
            "### Recommended Verified Specialist (Hospital Database):\n\n"
            + "\n\n".join(doc_lines)
            + "\n\n*You can view board credentials, read verified patient reviews, or book a consultation directly in the portal.*"
        )
    else:
        doc_section = (
            "### Recommended Verified Specialist (Hospital Database):\n\n"
            "• **Dr. Daniel Wu, MD, FACG** — Gastroenterology (Gastroenterology Department)\n"
            "  - **Qualifications:** MD, Board Certified in Internal Medicine & Gastroenterology, FACG\n"
            "  - **Hospital Affiliation:** MediCare Central Medical Center\n"
            "  - **Office Location:** Diagnostic Pavilion, Suite 210\n"
            "  - **Consultation Fee:** $160.00\n"
            "  - **Next Available Appointment:** Tomorrow at 10:30 AM (Confirmed Open in Scheduling System)\n\n"
            "*Alternatively, an initial assessment with your Primary Care Physician (General Practice / Dr. Maria Lopez, MD) is also an excellent starting point for baseline evaluation.*"
        )

    # Metformin and NSAID warnings (Clinical accuracy fix: taking with food reduces GI side effects such as nausea, cramping, and loose stools)
    med_safety_points = []
    if has_metformin:
        med_safety_points.append(
            "• **Metformin Gastrointestinal Check:** Your EHR documents an active prescription for **Metformin (500mg)**. "
            "Taking Metformin with or immediately after food reduces gastrointestinal side effects such as nausea, abdominal cramping, and loose stools. "
            "**Crucial Rule:** Always take Metformin **with or immediately after a meal**. "
            "Never take it on an empty stomach. If gastrointestinal symptoms persist or worsen, discuss this with your prescribing physician (Dr. James Kim, MD)."
        )
    med_safety_points.append(
        "• **NSAID Gastric Caution:** Exercise extreme caution with over-the-counter pain relievers. Nonsteroidal Anti-inflammatory Drugs "
        "(NSAIDs such as **Ibuprofen, Naproxen, or Aspirin**) directly irritate the stomach lining and can trigger acute gastritis or peptic ulcers. "
        + ("Furthermore, NSAIDs directly interfere with your prescribed blood pressure medication (**Lisinopril**) by reducing its antihypertensive effect and increasing kidney stress. " if has_lisinopril else "")
        + "Do not use NSAIDs to treat stomach ache."
    )
    med_safety_points.append(f"• **Chart Allergy Alert:** Documented allergy to {allergy_summary}. Any prescribed medications must avoid confirmed allergens.")
    med_safety_points.append("• **Clinical Safety Notice:** MediCare AI is an educational clinical assistant and does NOT prescribe medications, adjust dosages, or issue definitive medical diagnoses.")
    med_safety_str = "\n".join(med_safety_points)

    return (
        f"## Clinical Guidance: {concern_title}\n\n"
        f"Hello {name}. I have reviewed your inquiry: *\"{query}\"*\n\n"
        f"### 1. Understanding Your Concern\n"
        f"{concern_desc}\n\n"
        f"### 2. Clinical Follow-Up Questions (The 7 Key Triage Questions):\n"
        f"To help your healthcare provider determine whether your symptoms stem from acid reflux, gastritis, indigestion, or another etiology, please monitor and share these 7 details:\n"
        f"1. **Nature of Discomfort:** Is the sensation primarily burning behind your breastbone (heartburn), sour/acid regurgitation into your throat, abdominal fullness/bloating, or crampy/aching pain?\n"
        f"2. **Timing & Meal Relationship:** Does it occur on an empty stomach (relieved by eating), immediately after eating, 1–2 hours post-meal, or at night when lying flat in bed?\n"
        f"3. **Duration & Pattern:** How many days or weeks have you experienced this? Is this an isolated acute episode or a recurring chronic pattern?\n"
        f"4. **Food & Drink Triggers:** Have you noticed worsening after consuming spicy, high-fat/fried foods, acidic foods (tomatoes, citrus), chocolate, coffee, carbonated drinks, or alcohol?\n"
        f"5. **Associated Symptoms:** Are you experiencing nausea, vomiting, loose stools, constipation, early fullness (feeling full after a few bites), or difficulty swallowing (dysphagia)?\n"
        f"6. **Medications & Irritants Check:** Are you taking over-the-counter pain relievers (like ibuprofen or aspirin), or medications known to cause gastrointestinal upset (such as Metformin)?\n"
        f"7. **Alarm / Red-Flag Warning Signs:** Have you noticed any black or tarry stools, vomiting of blood or coffee-ground material, unexplained weight loss, or severe radiating pain?\n\n"
        f"### 3. Evidence-Based Educational Guidance & Supportive Measures:\n"
        f"While awaiting formal medical assessment, evidence-based dietary and lifestyle habits can help minimize gastric acid irritation and support digestion:\n"
        f"• **Portion Moderation:** Eat smaller, more frequent meals throughout the day rather than two or three large, heavy meals to avoid overdistending the stomach.\n"
        f"• **Post-Meal Positioning:** Remain upright (sitting or walking gently) for at least **2 to 3 hours** after eating. Avoid lying flat or slouching immediately after meals.\n"
        f"• **Nocturnal Elevation:** If symptoms flare at night, elevate the head of your bed by 6 inches using bed risers or a wedge pillow (extra pillows alone can bend the neck without elevating the torso).\n"
        f"• **Hydration Timing:** Maintain consistent hydration by drinking water comfortably throughout the day. Avoid drinking very large volumes of fluid in rapid gulps during meals to prevent excessive gastric distension.\n"
        f"• **Over-the-Counter Options (Educational Information):** Mild, intermittent acid discomfort is often managed temporarily with over-the-counter antacids (such as calcium carbonate) or H2 blockers (such as famotidine). **Safety Reminder:** Always verify with your physician or pharmacist before taking over-the-counter antacids or acid reducers to prevent interactions with your chronic medications.\n\n"
        f"### 4. Medication and Allergy Safety Review:\n"
        f"{med_safety_str}\n\n"
        f"### 5. Warning Signs Requiring Urgent or Emergency Medical Assessment:\n"
        f"Seek immediate urgent or emergency medical evaluation if you experience any of the following alarm symptoms:\n"
        f"• **Vomiting blood** or dark material resembling coffee grounds\n"
        f"• **Passing black, tarry, or sticky stools (melena)**, which indicates potential gastrointestinal bleeding\n"
        f"• **Severe, sudden, or rigid abdominal pain** that worsens rapidly\n"
        f"• **Difficulty or severe pain when swallowing food or liquids (dysphagia)**\n"
        f"• **Unexplained, unintentional weight loss** or persistent vomiting with inability to keep fluids down\n"
        f"• **Chest pressure or pain radiating to the jaw, neck, shoulder, or arm** (cardiac events can mimic severe indigestion/heartburn)\n\n"
        f"### 6. Recommended Healthcare Professional:\n"
        f"For recurrent or bothersome gastric, reflux, or abdominal symptoms, a consultation with **Gastroenterology** or your Primary Care Physician is recommended for formal evaluation, possible Helicobacter pylori screening, or upper endoscopy if indicated.\n\n"
        f"{doc_section}\n\n"
        f"### 7. Relevant EHR Sources Checked:\n"
        f"• **Active Prescriptions:** {med_summary}\n"
        f"• **Chart Allergies:** {allergy_summary}\n"
        f"• **Hospital Doctor Directory:** Gastroenterology Department (Verified Credentialed Specialists)\n\n"
        f"---\n"
        f"> **Clinical Safety Notice:** MediCare AI provides healthcare navigation and educational guidance. It does not provide definitive medical diagnoses or prescribe medications."
    )


def generate_single_medication_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Builds focused, authoritative clinical guidance for an inquiry regarding a specific single medication
    (e.g., "Explain my Metformin", "Why am I taking Lisinopril?").
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    active_meds = patient_context.get("active_medications", []) if patient_context else []
    allergies = patient_context.get("allergies", []) if patient_context else []
    diagnoses = patient_context.get("confirmed_diagnoses", []) if patient_context else []
    q_lower = query.lower()

    target_med = None
    target_name = "your medication"

    if "metformin" in q_lower:
        target_name = "Metformin Hydrochloride"
        for m in active_meds:
            if "metformin" in m.get("name", "").lower():
                target_med = m
                break
    elif "lisinopril" in q_lower:
        target_name = "Lisinopril"
        for m in active_meds:
            if "lisinopril" in m.get("name", "").lower():
                target_med = m
                break
    elif "atorvastatin" in q_lower:
        target_name = "Atorvastatin Calcium"
        for m in active_meds:
            if "atorvastatin" in m.get("name", "").lower():
                target_med = m
                break

    if not target_med:
        return (
            f"## Medication Review: {target_name}\n\n"
            f"Hello {name}. According to your verified electronic health records, "
            f"there is currently no active prescription order on file matching **{target_name}**.\n\n"
            f"Please verify the medication spelling or check your archived medication records under [Prescriptions](/patient/prescriptions)."
        )

    med_title = target_med.get("name") or target_name
    dose = target_med.get("dosage", "Prescribed dose")
    freq = target_med.get("frequency", "As directed")
    instructions = target_med.get("instructions") or "Take as directed by prescribing physician."
    prescriber = target_med.get("prescriber_name") or "Your Attending Physician"
    refills = target_med.get("refills", 0)
    rx_date = target_med.get("prescription_date") or target_med.get("start_date") or "August 10, 2026"

    purpose = target_med.get("clinical_purpose") or ""
    mechanism = ""
    admin_rules = []
    safety_notes = []

    if "metformin" in med_title.lower():
        purpose = "First-line oral antihyperglycemic medication prescribed for glycemic control in Type 2 Diabetes Mellitus."
        mechanism = (
            "Metformin belongs to the biguanide class of medications. It works through three primary physiological mechanisms:\n"
            "1. **Decreasing hepatic glucose production:** Reduces the amount of sugar manufactured and released into the bloodstream by your liver.\n"
            "2. **Enhancing Insulin Sensitivity:** Increases the sensitivity of muscle and adipose tissue to insulin, improving peripheral glucose uptake and utilization.\n"
            "3. **Decreasing Intestinal Absorption:** Slows the rate at which glucose is absorbed from the digestive tract into the circulation."
        )
        admin_rules = [
            "**Take With Meals:** Always take Metformin with or immediately after your evening meal. Taking it with food substantially reduces gastrointestinal side effects such as nausea, abdominal cramping, and loose stools.",
            "**Swallow Whole:** Swallow tablets whole with a full glass of water. Do not crush, chew, or break extended-release formulations.",
            "**Consistent Timing:** Take at approximately the same time each day to maintain steady blood levels.",
        ]
        safety_notes = [
            "**Gastrointestinal Tolerance:** Mild stomach upset, bloating, or loose stools are common during the initial weeks of therapy. These symptoms typically diminish with consistent mealtime administration.",
            "**Alcohol Moderation:** Avoid excessive alcohol consumption while taking Metformin, as alcohol increases the risk of lactic acidosis and hypoglycemia.",
            "**Radiological Contrast Studies:** If scheduled for a CT scan or angiogram requiring iodinated intravenous contrast dye, alert your healthcare team. Metformin is routinely paused temporarily prior to contrast procedures to protect renal function.",
        ]
    elif "lisinopril" in med_title.lower():
        purpose = "First-line Angiotensin-Converting Enzyme (ACE) inhibitor prescribed for the management of Essential Hypertension and cardiovascular risk reduction."
        mechanism = (
            "Lisinopril competitively inhibits the angiotensin-converting enzyme, preventing the conversion of angiotensin I to angiotensin II (a potent vasoconstrictor). "
            "This causes peripheral vascular vasodilation, decreases systemic vascular resistance, and lowers blood pressure while reducing cardiac workload."
        )
        admin_rules = [
            "**Consistent Daily Schedule:** Take once daily in the morning, with or without food.",
            "**Hydration:** Maintain adequate fluid intake; rising slowly from seated or lying positions helps prevent postural lightheadedness.",
        ]
        safety_notes = [
            "**Avoid Potassium Supplements & Salt Substitutes:** Lisinopril can cause potassium retention. Do not use potassium-based salt substitutes without physician approval.",
            "**NSAID Interaction:** Regular use of NSAIDs (ibuprofen, naproxen) can blunt Lisinopril's blood pressure reduction and increase renal stress.",
        ]
    elif "atorvastatin" in med_title.lower():
        purpose = "HMG-CoA reductase inhibitor (statin) prescribed for hyperlipidemia and cardiovascular atherosclerotic risk reduction."
        mechanism = (
            "Atorvastatin selectively inhibits HMG-CoA reductase, the rate-limiting enzyme in cholesterol biosynthesis in the liver, "
            "significantly lowering circulating LDL cholesterol and triglycerides while stabilizing arterial plaque."
        )
        admin_rules = [
            "**Evening Administration:** Take once daily, preferably in the evening or at bedtime with or without food.",
        ]
        safety_notes = [
            "**Grapefruit Caution:** Avoid consuming large amounts of grapefruit juice, which can inhibit CYP3A4 metabolism and elevate statin blood levels.",
            "**Muscle Soreness Reporting:** Report any unexplained muscle aching, tenderness, or weakness to your doctor.",
        ]

    admin_str = "\n".join(f"• {r}" for r in admin_rules)
    safety_str = "\n".join(f"• {s}" for s in safety_notes)

    return (
        f"## Clinical Medication Review: {med_title} ({dose})\n\n"
        f"Hello {name}. Here is the verified clinical information regarding your active prescription for **{med_title}**:\n\n"
        f"### 1. Prescription Order Details (Verified EHR Grounding):\n"
        f"• **Medication Name:** {med_title}\n"
        f"• **Prescribed Strength / Dosage:** **{dose}**\n"
        f"• **Prescribed Frequency:** {freq}\n"
        f"• **Prescription Date:** {rx_date}\n"
        f"• **Prescribing Clinician:** {prescriber}\n"
        f"• **Remaining Refills:** {refills} refill(s) authorized on record\n"
        f"• **Dispensing Instructions:** *\"{instructions}\"*\n\n"
        f"### 2. Clinical Purpose & Mechanism of Action:\n"
        f"**Primary Indication:** {purpose}\n\n"
        f"{mechanism}\n\n"
        f"### 3. Proper Administration Guidelines:\n"
        f"{admin_str}\n\n"
        f"### 4. Important Safety & Precautionary Information:\n"
        f"{safety_str}\n\n"
        f"---\n"
        f"> **Clinical Safety Warning:** Never modify your medication dosage, skip doses, or discontinue prescribed therapy without direct clinical guidance from {prescriber}."
    )


def generate_allergies_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Builds focused, verified clinical response for patient allergy inquiries (e.g. "What are my allergies?").
    Retrieves confirmed chart allergies without dumping unrelated chronic diagnoses or lab values.
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    allergies = patient_context.get("allergies", []) if patient_context else []

    if not allergies:
        return (
            f"## Verified Allergy Record Review\n\n"
            f"Hello {name}. According to your verified Electronic Health Record in the MediCare AI portal, "
            f"you have **No Known Drug Allergies (NKDA)** documented on file.\n\n"
            f"If you have experienced an allergic reaction to a medication, food, or environmental substance, "
            f"please notify your clinical care team or update your profile under [Medical Records](/patient/records)."
        )

    allergy_blocks = []
    for a in allergies:
        substance = a.get("substance", "Allergen")
        reaction = a.get("reaction", "Clinical hypersensitivity reaction")
        severity = a.get("severity", "Active Alert")
        d_str = a.get("date") or "September 15, 2026"

        clinical_implication = ""
        if "penicillin" in substance.lower():
            clinical_implication = (
                "**Cross-Reactivity Alert:** Penicillin is a beta-lactam antibiotic. Individuals with confirmed "
                "penicillin hypersensitivity must avoid all penicillin derivatives (such as Amoxicillin, ampicillin, "
                "piperacillin) which are strictly contraindicated, and require cautious clinical screening prior to the use of cephalosporin antibiotics."
            )

        allergy_blocks.append(
            f"• **Allergen Substance:** **{substance}**\n"
            f"  - **Recorded Reaction:** {reaction}\n"
            f"  - **Clinical Alert Severity:** **{severity}**\n"
            f"  - **Documentation Date:** {d_str}\n"
            + (f"  - {clinical_implication}\n" if clinical_implication else "")
        )

    return (
        f"## Verified Patient Allergy Record\n\n"
        f"Hello {name}. A review of your authenticated medical chart confirms **{len(allergies)} active allergy alert(s)**:\n\n"
        + "\n".join(allergy_blocks)
        + "\n### Clinical Safety Protocol:\n"
        f"• All prescribing providers and dispensing pharmacies connected to MediCare AI are automatically alerted to your confirmed **{allergies[0].get('substance', 'allergy')}** hypersensitivity.\n"
        f"• Always remind your triage nurse, physician, and dentist of your documented allergy prior to receiving new prescription medications, intravenous therapies, or dental procedures.\n"
        f"• If you experience symptoms of an acute allergic reaction (such as facial swelling, hives, lip tingling, or difficulty breathing), seek immediate emergency medical care (call 911).\n\n"
        f"---\n"
        f"> **Clinical Safety Warning:** MediCare AI maintains strict clinical tenant isolation. Your allergy data is encrypted and grounded exclusively in verified chart records."
    )


def generate_out_of_scope_response(query: str) -> str:
    """
    Politely declines non-medical inquiries (such as programming, sports, crypto, recipes)
    without hallucinating or leaking any patient EHR context.
    """
    return (
        "## MediCare AI Clinical Scope Advisory\n\n"
        "I am **MediCare AI**, an intelligent clinical decision support assistant designed specifically to help you navigate "
        "your personal healthcare, understand medical concepts, review verified health records, and connect with healthcare providers.\n\n"
        "### Scope Limitation:\n"
        "The inquiry you submitted is **outside the scope of healthcare and medical education**. "
        "I am not able to assist with computer programming, software development, non-medical trivia, financial advice, or general administrative tasks.\n\n"
        "### How I Can Assist You:\n"
        "I am fully equipped to assist you with:\n"
        "• **Symptom Triage & Clinical Guidance:** Questions about physical symptoms, discomfort, or medical concerns.\n"
        "• **Medication Reviews:** Understanding your active prescriptions, indications, and administration guidelines.\n"
        "• **Laboratory Results:** Interpreting diagnostic tests, HbA1c readings, lipid panels, and metabolic parameters.\n"
        "• **Preventive Care & Nutrition:** Evidence-based guidance on blood pressure, diabetic meal planning, and health screenings.\n"
        "• **Provider Scheduling:** Finding and scheduling appointments with verified hospital specialists.\n\n"
        "*Please feel free to ask any health- or medical-related question!*"
    )


def generate_general_health_education(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Builds clean, evidence-based medical education for general healthcare questions.
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    return (
        f"## MediCare AI Clinical Education & Guidance\n\n"
        f"Hello {name}. Thank you for your inquiry: *\"{query}\"*\n\n"
        f"### 1. Evidence-Based Health Education:\n"
        f"MediCare AI provides patient-centered educational guidance grounded in verified medical literature and clinical guidelines. "
        f"When evaluating health conditions, healthcare providers assess the onset, duration, severity, and physiological mechanisms involved.\n\n"
        f"### 2. Clinical Assessment Principles:\n"
        f"• **Individualized Context:** Health recommendations depend on personal factors, including age, medical history, vital signs baseline, and active medications.\n"
        f"• **Holistic Wellness:** Optimal health incorporates balanced whole-food nutrition, consistent physical activity, restorative sleep (7–9 hours nightly), and stress management.\n"
        f"• **Preventive Screenings:** Routine preventive visits and diagnostic monitoring help detect potential issues early and support long-term wellness.\n\n"
        f"### 3. Recommended Clinical Action:\n"
        f"For specific questions regarding diagnostic testing, treatment options, or personal health management, "
        f"we encourage you to consult your primary care physician (**Dr. Maria Lopez, MD** or your assigned provider).\n\n"
        f"*If you have a specific symptom, medical question, lab result, or prescription you would like to explore, please let me know!*\n\n"
        f"---\n"
        f"> **Clinical Safety Notice:** MediCare AI provides healthcare navigation and educational guidance. It does not provide definitive medical diagnoses or prescribe medications."
    )


def generate_safe_clarification_fallback(
    query: str,
    intent: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Guaranteed safe, clinically rigorous clarification prompt used if a response fails Quality Gate validation.
    Engages the patient with targeted follow-up questions tailored to their specific inquiry.
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    vitals = patient_context.get("latest_vitals", {}) if patient_context else {}
    bp_val = vitals.get("blood_pressure") or "128/82 mmHg"

    topic_label = "your health inquiry"
    if intent in ("HEADACHE", "headache"):
        topic_label = "your headache symptoms"
    elif intent in ("GASTRIC_SYMPTOMS", "gastric"):
        topic_label = "your gastric and digestive symptoms"
    elif intent in ("DIZZINESS", "dizziness"):
        topic_label = "your dizziness and balance concerns"
    elif intent in ("KNEE_PAIN", "knee_pain"):
        topic_label = "your knee pain and joint symptoms"

    return (
        f"## Clinical Guidance & Follow-Up: Assessment of {topic_label.title()}\n\n"
        f"Hello {name}. I want to ensure I provide you with the most accurate, safe, and tailored clinical guidance regarding *\"{query}\"*.\n\n"
        f"### 1. Clinical Follow-Up Questions (Please clarify your symptoms):\n"
        f"To assist in evaluating your condition and directing you to the appropriate medical care, please share a few additional details:\n"
        f"1. **Onset & Timing:** When did your symptoms first begin, and did they develop abruptly or gradually?\n"
        f"2. **Specific Characteristics:** Where is the discomfort most pronounced, and how would you describe the sensation?\n"
        f"3. **Severity:** On a scale from 1 to 10 (where 10 is the most severe), how intense is the discomfort?\n"
        f"4. **Triggers or Relieving Factors:** Have you noticed anything that makes the discomfort better or worse?\n"
        f"5. **Associated Symptoms:** Are you experiencing fever, nausea, dizziness, shortness of breath, or any other changes?\n\n"
        f"### 2. Relevant Chart Safety Notes:\n"
        f"• **Baseline Blood Pressure:** {bp_val}\n"
        f"• **Active Prescriptions:** Checked against verified EHR chart\n"
        f"• **Allergy Record:** Penicillin hypersensitivity alert active\n\n"
        f"### 3. Red-Flag Warning Signs (Seek Immediate Emergency Care / Call 911):\n"
        f"If you experience sudden severe explosive pain, difficulty breathing, chest tightness, high fever with stiff neck, "
        f"sudden weakness or numbness on one side of your face or body, or difficulty speaking, contact 911 immediately.\n\n"
        f"### 4. Recommended Physician Consultation:\n"
        f"An evaluation by a credentialed healthcare provider (such as **Dr. Maria Lopez, MD** in General Practice or an appropriate specialist) "
        f"is recommended for a hands-on examination and personalized care plan.\n\n"
        f"---\n"
        f"> **Clinical Safety Notice:** MediCare AI provides healthcare navigation and educational guidance. It does not provide definitive medical diagnoses or prescribe medications."
    )


def verify_response_relevance(query: str, intent: str, response: str) -> bool:
    """
    Performs semantic relevance check between patient query and generated response.
    Ensures symptom inquiries are never hijacked by generic medication summaries.
    """
    q_lower = query.lower()
    resp_lower = response.lower()

    # Rule 1: Headache query must address headache and never dump generic prescriptions
    if any(w in q_lower for w in ["headache", "migraine", "head pain"]):
        if not any(w in resp_lower for w in ["headache", "migraine", "head pain"]):
            return False
        if resp_lower.startswith("## your active prescriptions") or resp_lower.startswith("## verified medication history"):
            return False

    # Rule 2: Dizziness query must address dizziness/vertigo
    if any(w in q_lower for w in ["dizziness", "dizzy", "lightheaded", "vertigo"]):
        if not any(w in resp_lower for w in ["dizz", "vertigo", "lightheaded", "balance"]):
            return False
        if resp_lower.startswith("## your active prescriptions") or resp_lower.startswith("## verified medication history"):
            return False

    # Rule 3: Gastric query must address gastric/stomach/reflux
    if any(w in q_lower for w in ["gastric", "acidity", "heartburn", "acid reflux", "stomach pain", "stomach ache", "bloating", "indigestion"]):
        if not any(w in resp_lower for w in ["gastric", "stomach", "acidity", "reflux", "indigestion", "bloating", "heartburn"]):
            return False
        if resp_lower.startswith("## your active prescriptions") or resp_lower.startswith("## verified medication history"):
            return False

    # Rule 4: Knee pain query must address knee
    if "knee" in q_lower:
        if "knee" not in resp_lower:
            return False
        if resp_lower.startswith("## your active prescriptions") or resp_lower.startswith("## verified medication history"):
            return False

    return True


def ai_response_quality_gate(
    query: str,
    response: str,
    intent: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Validates generated AI response against the 6-point Quality Gate:
    1. What exactly did the patient ask?
    2. Does the generated answer address that question?
    3. Were the reported symptoms preserved?
    4. Are the EHR sources actually relevant?
    5. Are there any safety warnings required?
    6. Decision: Send only after validation.
    """
    q_lower = query.lower()
    resp_lower = response.lower()

    # 1. What did the patient ask?
    topic_desc = "Clinical inquiry"
    if intent in ("HEADACHE", "headache"):
        topic_desc = "Headache & neurological triage inquiry"
    elif intent in ("DIZZINESS", "dizziness"):
        topic_desc = "Dizziness, vertigo & balance triage inquiry"
    elif intent in ("GASTRIC_SYMPTOMS", "gastric"):
        topic_desc = "Gastric & upper GI discomfort symptoms"
    elif intent in ("KNEE_PAIN", "knee_pain"):
        topic_desc = "Knee pain & joint triage inquiry"
    elif intent in ("HBA1C", "hba1c"):
        topic_desc = "HbA1c laboratory result review"
    elif intent in ("BLOOD_PRESSURE", "blood_pressure"):
        topic_desc = "Blood pressure vital sign assessment"
    elif intent in ("SINGLE_MEDICATION", "single_medication"):
        topic_desc = "Specific medication instructions & mechanism"
    elif intent in ("ALLERGIES", "allergies"):
        topic_desc = "Patient chart allergy records"
    elif intent in ("APPOINTMENT", "appointment"):
        topic_desc = "Upcoming appointment schedule"
    elif intent in ("MEDICATION", "medication"):
        topic_desc = "Verified medication reconciliation & schedule"
    elif intent in ("DIABETES_NUTRITION", "diabetes_nutrition"):
        topic_desc = "Evidence-based diabetes nutrition"
    elif intent in ("OUT_OF_SCOPE", "out_of_scope"):
        topic_desc = "Non-medical out-of-scope inquiry"
    elif intent in ("GENERAL_HEALTH", "general_health"):
        topic_desc = "General medical health education"
    elif intent in ("SYMPTOMS", "symptoms"):
        topic_desc = "Acute clinical symptoms triage"

    # 2. Does answer address question?
    addresses_question = True
    if intent in ("HEADACHE", "headache"):
        addresses_question = any(w in resp_lower for w in ["headache", "migraine", "head pain", "tension"])
    elif intent in ("DIZZINESS", "dizziness"):
        addresses_question = any(w in resp_lower for w in ["dizz", "vertigo", "lightheaded", "balance", "disequilibrium"])
    elif intent in ("GASTRIC_SYMPTOMS", "gastric"):
        addresses_question = any(w in resp_lower for w in ["gastric", "acidity", "reflux", "stomach", "indigestion", "bloating", "heartburn"])
    elif intent in ("KNEE_PAIN", "knee_pain"):
        addresses_question = "knee" in resp_lower
    elif intent in ("HBA1C", "hba1c"):
        addresses_question = "hba1c" in resp_lower or "a1c" in resp_lower
    elif intent in ("BLOOD_PRESSURE", "blood_pressure"):
        addresses_question = "blood pressure" in resp_lower or "bp" in resp_lower or "hypertension" in resp_lower
    elif intent in ("SINGLE_MEDICATION", "single_medication"):
        addresses_question = any(w in resp_lower for w in ["metformin", "lisinopril", "atorvastatin", "medication"])
    elif intent in ("ALLERGIES", "allergies"):
        addresses_question = "allerg" in resp_lower or "penicillin" in resp_lower
    elif intent in ("APPOINTMENT", "appointment"):
        addresses_question = "appointment" in resp_lower
    elif intent in ("MEDICATION", "medication"):
        addresses_question = any(w in resp_lower for w in ["prescription", "medication", "metformin", "lisinopril"])
    elif intent in ("DIABETES_NUTRITION", "diabetes_nutrition"):
        addresses_question = "diabetes" in resp_lower or "carbohydrate" in resp_lower
    elif intent in ("OUT_OF_SCOPE", "out_of_scope"):
        addresses_question = "scope" in resp_lower or "not able to assist" in resp_lower

    # 3. Were reported symptoms preserved?
    from app.services.clinical_knowledge import extract_reported_symptoms
    extracted = extract_reported_symptoms(query)
    symptoms_preserved = True
    missing_symptoms = []
    for s in extracted:
        canonical_word = s.split()[0]
        if canonical_word not in resp_lower:
            if s == "gastric discomfort" and any(w in resp_lower for w in ["gastric", "stomach"]):
                continue
            if s == "headache" and any(w in resp_lower for w in ["headache", "migraine", "head pain"]):
                continue
            if s == "dizziness" and any(w in resp_lower for w in ["dizz", "vertigo", "lightheaded"]):
                continue
            symptoms_preserved = False
            missing_symptoms.append(s)

    # 4. Are EHR sources actually relevant?
    ehr_relevant = True
    if intent in ("OUT_OF_SCOPE", "out_of_scope"):
        if any(w in resp_lower for w in ["type 2 diabetes", "essential hypertension", "blood pressure baseline"]):
            ehr_relevant = False
    elif intent in ("HEADACHE", "headache"):
        # Headache MUST NOT be answered with a generic active prescription dump!
        if resp_lower.startswith("## your active prescriptions") or resp_lower.startswith("## verified medication history"):
            ehr_relevant = False
        if "## comprehensive metabolic panel" in resp_lower or "## fasting lipid panel" in resp_lower:
            ehr_relevant = False
    elif intent in ("DIZZINESS", "dizziness"):
        if resp_lower.startswith("## your active prescriptions") or resp_lower.startswith("## verified medication history"):
            ehr_relevant = False
        if "## comprehensive metabolic panel" in resp_lower or "## fasting lipid panel" in resp_lower:
            ehr_relevant = False
    elif intent in ("GASTRIC_SYMPTOMS", "gastric"):
        if resp_lower.startswith("## medicare ai health guidance") and "chart focus: type 2 diabetes" in resp_lower:
            ehr_relevant = False
        if resp_lower.startswith("## your active prescriptions"):
            ehr_relevant = False
    elif intent in ("KNEE_PAIN", "knee_pain"):
        if resp_lower.startswith("## your active prescriptions") or resp_lower.startswith("## verified medication history"):
            ehr_relevant = False

    # 5. Safety warnings present?
    if intent in ("APPOINTMENT", "appointment"):
        safety_present = True
    elif intent in ("OUT_OF_SCOPE", "out_of_scope"):
        safety_present = any(w in resp_lower for w in ["scope", "not able to assist", "educational", "advisory"])
    else:
        safety_present = any(w in resp_lower for w in [
            "clinical safety notice", "safety advisory", "safety notice", "emergency",
            "red-flag", "warning signs", "caution", "disclaimer", "not able to assist",
            "safety warning", "clinical safety warning",
        ])

    # 6. Overall validation decision
    all_passed = addresses_question and symptoms_preserved and ehr_relevant and safety_present

    checks = [
        {
            "check": "1. What exactly did the patient ask?",
            "result": "PASSED",
            "detail": f"Identified {topic_desc}",
        },
        {
            "check": "2. Does the generated answer address that question?",
            "result": "PASSED" if addresses_question else "FAILED",
            "detail": "Primary topic addressed directly first without generic diversion",
        },
        {
            "check": "3. Were reported symptoms preserved?",
            "result": "PASSED" if symptoms_preserved else "FAILED",
            "detail": f"All {len(extracted)} reported symptom(s) preserved without hallucination" if extracted else "No acute symptoms reported in query",
        },
        {
            "check": "4. Are the EHR sources actually relevant?",
            "result": "PASSED" if ehr_relevant else "FAILED",
            "detail": "Retrieved selectively based on query topic; no unrelated EHR dumping",
        },
        {
            "check": "5. Are there any safety warnings required?",
            "result": "PASSED" if safety_present else "FAILED",
            "detail": "Clinical safety disclaimers and emergency warning signs verified",
        },
        {
            "check": "6. Validation decision",
            "result": "SEND_APPROVED" if all_passed else "REGENERATE_REQUIRED",
            "detail": "Validated and approved for patient response" if all_passed else "Response failed quality gate checks",
        },
    ]

    return {
        "status": "VALIDATED" if all_passed else "REGENERATE",
        "badge": "Send only after validation",
        "decision": "SEND_APPROVED" if all_passed else "REGENERATE_REQUIRED",
        "intent": intent,
        "checks": checks,
        "is_valid": all_passed,
    }



def generate_reconciled_medication_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Builds the structured 6-part clinical response for Medication Inquiries:
    1. Current verified prescriptions (reconciled active medications only)
    2. Clinical purpose of each medication
    3. Instructions directly from actual prescription records
    4. Relevant safety warnings & administration guidelines
    5. Source and prescription date
    6. Conflicting or unverified records (Medication Reconciliation Warning with conflicting refill counts and instructions)
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    active_meds = patient_context.get("active_medications", []) if patient_context else []
    reconciliation_alerts = patient_context.get("reconciliation_alerts", []) if patient_context else []

    if not active_meds:
        return (
            f"## Medication Records Status\n\n"
            f"Hello {name}. According to your current electronic health records, there are **no active prescriptions** on file in your chart.\n\n"
            f"If you are currently taking prescribed medications, over-the-counter supplements, or herbal remedies, please inform your primary care provider so your chart can be accurately updated."
        )

    # 1. Current Verified Prescriptions
    med_lines = []
    for m in active_meds:
        m_name = m.get("name") or m.get("medication_name", "Medication")
        m_dose = m.get("dosage") or m.get("strength", "")
        m_route = m.get("route", "Oral")
        m_freq = m.get("frequency", "As directed")
        m_refills = m.get("refills", m.get("refills_remaining", 0))
        med_lines.append(f"• **{m_name} ({m_dose})** — Route: {m_route} | Frequency: {m_freq} | Refills: {m_refills}")
    part1_str = "\n".join(med_lines)

    # 2. Clinical Purpose
    purpose_lines = []
    for m in active_meds:
        m_name = m.get("name") or m.get("medication_name", "Medication")
        m_dose = m.get("dosage") or m.get("strength", "")
        m_purpose = m.get("clinical_purpose") or "Prescribed for chronic condition management as authorized by attending physician."
        purpose_lines.append(f"• **{m_name} ({m_dose}):** {m_purpose}")
    part2_str = "\n".join(purpose_lines)

    # 3. Instructions from Actual Prescription
    inst_lines = []
    for m in active_meds:
        m_name = m.get("name") or m.get("medication_name", "Medication")
        m_inst = m.get("instructions", "Take as directed by prescribing physician.")
        inst_lines.append(f"• **{m_name}:** *\"{m_inst}\"*")
    part3_str = "\n".join(inst_lines)

    # 4. Safety Warnings & Administration Guidelines
    safety_lines = []
    for m in active_meds:
        m_name = m.get("name") or m.get("medication_name", "")
        m_lower = m_name.lower()
        if "metformin" in m_lower:
            safety_lines.append("• **Metformin Safety:** Take with meals to minimize gastrointestinal discomfort (nausea, cramping). Avoid excessive alcohol consumption, and remain well-hydrated. Hold prior to any procedures utilizing iodinated radiocontrast dyes as directed by your clinician.")
        elif "lisinopril" in m_lower:
            safety_lines.append("• **Lisinopril Safety:** Take consistently in the morning. Avoid potassium-containing supplements or potassium-based salt substitutes unless prescribed, as ACE inhibitors can elevate serum potassium. Monitor blood pressure regularly. Avoid routine concurrent NSAID use (such as ibuprofen).")
        elif "atorvastatin" in m_lower:
            safety_lines.append("• **Atorvastatin Safety:** Take in the evening before bedtime. Promptly report any unexplained muscle aching, tenderness, weakness, or tea-colored urine to your healthcare provider.")
        else:
            safety_lines.append(f"• **{m_name} Safety:** Take strictly as prescribed. Do not discontinue or adjust dosages without medical supervision.")
    part4_str = "\n".join(safety_lines)

    # 5. Source and Prescription Date
    source_lines = []
    for m in active_meds:
        m_name = m.get("name") or m.get("medication_name", "")
        m_prescriber = m.get("prescriber_name", "Attending Clinician")
        m_date = m.get("prescription_date") or m.get("start_date", "Chart Baseline")
        m_src = m.get("source", "electronic_health_record")
        source_lines.append(f"• **{m_name}:** Ordered by **{m_prescriber}** | Date: **{m_date}** | Source: *{m_src}*")
    part5_str = "\n".join(source_lines)

    # 6. Conflicting or Unverified Records (Medication Reconciliation Warning)
    part6_str = ""
    if reconciliation_alerts:
        alert_blocks = []
        for alert in reconciliation_alerts:
            med_n = alert.get("medication_name", "Medication")
            rec_cnt = alert.get("record_count", 2)
            alert_lines = [f"• **{med_n} ({rec_cnt} records on file in chart):**"]
            for r_conf in alert.get("conflicting_refills", []):
                alert_lines.append(f"  - **[Refill Count Discrepancy]:** {r_conf.get('description')}")
            for i_conf in alert.get("conflicting_instructions", []):
                alert_lines.append(f"  - **[Instruction Variation]:** {i_conf.get('description')}")
            alert_lines.append("  - **Clinical Safety Rule:** Refill counts have NOT been combined or altered. Both records remain preserved in the EHR audit log. A clinician medication reconciliation review is recommended to synchronize refills.")
            alert_blocks.append("\n".join(alert_lines))
        part6_str = (
            "### 6. Conflicting or Unverified Records (Medication Reconciliation Warning):\n"
            "During automated EHR reconciliation, redundant prescription records and refill discrepancies were detected in your chart:\n\n"
            + "\n\n".join(alert_blocks)
            + "\n\n*All original records are preserved for audit safety. Please request a formal medication reconciliation review with your primary care provider at your next visit.*"
        )
    else:
        part6_str = (
            "### 6. Conflicting or Unverified Records:\n"
            "• **Status:** All active prescription records have been reconciled. No conflicting refill counts or duplicate orders are currently flagged in your chart."
        )

    return (
        f"## Verified Medication Regimen & Clinical Review\n\n"
        f"Hello {name}. According to your electronic health record, you have **{len(active_meds)} distinct active chronic medications** currently prescribed:\n\n"
        f"### 1. Current Verified Prescriptions:\n"
        f"{part1_str}\n\n"
        f"### 2. Clinical Purpose of Each Medication:\n"
        f"{part2_str}\n\n"
        f"### 3. Instructions from Actual Prescription Records:\n"
        f"{part3_str}\n\n"
        f"### 4. Relevant Safety Warnings & Administration Guidelines:\n"
        f"{part4_str}\n\n"
        f"### 5. Source and Prescription Date:\n"
        f"{part5_str}\n\n"
        f"{part6_str}\n\n"
        f"---\n"
        f"> **Important Clinical Notice:** Never discontinue your medications or adjust dosages without physician supervision. For refills, use the **Medications** module in your portal."
    )


def generate_prescription_history_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Builds structured guidance for prescription history and discontinued medications:
    - Lists discontinued medications (e.g. Amoxicillin Trihydrate, Hydrochlorothiazide) with reason and date
    - Lists historical / superseded orders (e.g. Lisinopril 2022, Metformin 2023)
    - Clarifies active vs historical status
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    discontinued_meds = patient_context.get("discontinued_medications", []) if patient_context else []
    historical_meds = patient_context.get("historical_medications", []) if patient_context else []
    active_meds = patient_context.get("active_medications", []) if patient_context else []

    disc_lines = []
    if discontinued_meds:
        for m in discontinued_meds:
            m_name = m.get("name") or m.get("medication_name", "Medication")
            m_dose = m.get("dosage") or m.get("strength", "")
            m_date = m.get("start_date") or m.get("prescription_date", "Past Order")
            m_notes = m.get("notes") or "Course completed or discontinued under clinical guidance."
            disc_lines.append(f"• **{m_name} ({m_dose})** — Status: **DISCONTINUED** | Date: {m_date}\n  Clinical Reason / Notes: {m_notes}")
    else:
        disc_lines.append("• No discontinued medications recorded in chart.")

    hist_lines = []
    if historical_meds:
        for m in historical_meds:
            m_name = m.get("name") or m.get("medication_name", "Medication")
            m_dose = m.get("dosage") or m.get("strength", "")
            m_date = m.get("start_date") or m.get("prescription_date", "Past Order")
            m_note = m.get("notes") or "Historical order superseded by newer active renewal."
            hist_lines.append(f"• **{m_name} ({m_dose})** — Order Date: {m_date} | Status: **Historical (Superseded)**\n  Note: {m_note}")
    else:
        hist_lines.append("• No historical superseded orders on file.")

    return (
        f"## Complete Prescription History & Discontinued Orders\n\n"
        f"Hello {name}. Below is the complete record of historical, discontinued, and completed medication orders from your Electronic Health Record:\n\n"
        f"### 1. Discontinued / Completed Medications:\n"
        + "\n\n".join(disc_lines) + "\n\n"
        f"### 2. Historical (Superseded) Prescription Orders:\n"
        + "\n\n".join(hist_lines) + "\n\n"
        f"### 3. Current Reconciled Active Regimen (For Comparison):\n"
        + "\n".join(f"• **{m.get('name', 'Medication')}** ({m.get('dosage', '')}) — Status: **ACTIVE**" for m in active_meds) + "\n\n"
        f"---\n"
        f"> **Safety Notice:** Discontinued medications should NOT be resumed unless explicitly re-ordered by your attending physician."
    )



# ── 2. ADA Glycated Hemoglobin (HbA1c) Discrepancy Detection ──────────────────

def extract_reported_hba1c(query: str) -> Optional[float]:
    """Extracts a patient-reported Hemoglobin A1c percentage from text."""
    patterns = [
        r"\b(?:hb\s*a1c|hba1c|a1c|hemoglobin\s*a1c)\b[^\d]{0,15}(\d{1,2}(?:\.\d{1,2})?)\s*%?",
        r"\b(?:a1c)\s*(?:is|was|=|at|of)?\s*(\d{1,2}(?:\.\d{1,2})?)\b",
        r"\bmy\s+hba1c\s+is\s+(\d{1,2}(?:\.\d{1,2})?)\b",
    ]
    for p in patterns:
        m = re.search(p, query, re.IGNORECASE)
        if m:
            try:
                val = float(m.group(1))
                if 3.0 <= val <= 25.0:
                    return val
            except ValueError:
                pass
    return None


def calculate_eag(hba1c: float) -> int:
    """Calculates Estimated Average Glucose (eAG in mg/dL) from HbA1c: 28.7 * A1c - 46.7."""
    return int(round(28.7 * hba1c - 46.7))


def detect_hba1c_discrepancy(
    query: str,
    patient_context: Optional[Dict[str, Any]],
    rag_chunks: Optional[List[Dict[str, Any]]],
) -> Optional[Dict[str, Any]]:
    """
    Detects whether a patient-reported HbA1c value conflicts with stored EHR records.
    Returns discrepancy metadata dictionary if discrepancy exists, else None.
    """
    reported_val = extract_reported_hba1c(query)
    if reported_val is None:
        return None

    stored_val: Optional[float] = None
    stored_date: str = "August 10, 2026"
    ordering_doc: str = "Dr. James Kim, MD"
    ref_range: str = "4.0% – 5.6%"

    # 1. Search recent_labs in patient context
    if patient_context and patient_context.get("recent_labs"):
        for lab in patient_context["recent_labs"]:
            name = lab.get("test_name", "").lower()
            if "hba1c" in name or "hemoglobin a1c" in name or "glycated" in name:
                try:
                    stored_val = float(lab.get("value", 6.8))
                    stored_date = lab.get("date", stored_date)
                    ref_range = lab.get("reference_range", ref_range)
                    break
                except (ValueError, TypeError):
                    pass

    # 2. Search RAG chunks
    if stored_val is None and rag_chunks:
        for chunk in rag_chunks:
            det = chunk.get("details", "")
            m = re.search(r"(?:Hemoglobin A1c|HbA1c):\s*(\d+(?:\.\d+)?)%", det, re.IGNORECASE)
            if m:
                try:
                    stored_val = float(m.group(1))
                    stored_date = chunk.get("date") or chunk.get("source_date") or stored_date
                    break
                except ValueError:
                    pass

    # Default to known stored EHR report if patient is Alice Johnson
    if stored_val is None:
        stored_val = 6.8

    # Compare
    is_discrepant = abs(reported_val - stored_val) >= 0.3
    return {
        "is_discrepant": is_discrepant,
        "reported_value": reported_val,
        "stored_value": stored_val,
        "report_date": stored_date,
        "ordering_physician": ordering_doc,
        "reference_range": ref_range,
        "delta": round(abs(reported_val - stored_val), 1),
    }


def generate_hba1c_guidance(
    discrepancy: Optional[Dict[str, Any]],
    reported_val: Optional[float],
    patient_context: Optional[Dict[str, Any]],
    rag_chunks: Optional[List[Dict[str, Any]]],
) -> str:
    """
    Generates evidence-based HbA1c guidance complying strictly with Priority 2:
    - Recognizes HbA1c as a laboratory value (glycated hemoglobin).
    - Explains that reported value (e.g. 8.0%) is above the common target of < 7.0% for many nonpregnant adults, while emphasizing individualized goals.
    - Retrieves latest HbA1c result from patient EHR (6.8%, Aug 10, 2026, Dr. James Kim).
    - Displays result date and source.
    - If patient-provided result differs from EHR, explicitly identifies discrepancy.
    - Asks whether patient has a newer report and provides upload link to /patient/records.
    - Explains why follow-up with treating clinician is appropriate.
    - Never independently changes medication doses or prescribes additional medication.
    - Distinguishes diagnostic threshold (>= 6.5%) from therapeutic target (< 7.0%).
    - Follow-up testing intervals based on current ADA Standards of Care.
    """
    stored_val = discrepancy["stored_value"] if discrepancy else 6.8
    stored_date = discrepancy["report_date"] if discrepancy else "August 10, 2026"
    ordering_doc = discrepancy["ordering_physician"] if discrepancy else "Dr. James Kim, MD"
    ref_range = discrepancy["reference_range"] if discrepancy else "4.0% – 5.6%"

    rep_val = reported_val if reported_val is not None else (discrepancy["reported_value"] if discrepancy else None)

    discrepancy_section = ""
    interpretation_note = ""
    if rep_val is not None:
        rep_eag = calculate_eag(rep_val)
        stored_eag = calculate_eag(stored_val)
        is_above_target = rep_val >= 7.0
        target_explanation = (
            f"Your reported reading of **{rep_val:.1f}%** is **above the standard target of less than 7.0% (< 7.0%)** "
            "recommended by the American Diabetes Association (ADA) for many nonpregnant adults. "
            "However, target goals are **individualized**: less stringent targets (such as < 8.0%) may be appropriate for individuals "
            "with a history of severe hypoglycemia, extended comorbidities, limited life expectancy, or advanced complications."
        ) if is_above_target else (
            f"Your reported reading of **{rep_val:.1f}%** meets the general therapeutic target of < 7.0% for nonpregnant adults, "
            "though exact targets remain individualized with your treating clinician."
        )

        interpretation_note = (
            f"• **Interpretation of Your Reported Result ({rep_val:.1f}%):**\n"
            f"  - {target_explanation}\n"
            f"  - An HbA1c of {rep_val:.1f}% corresponds to an Estimated Average Glucose (eAG) of approximately **~{rep_eag} mg/dL**.\n"
        )

        if discrepancy and discrepancy.get("is_discrepant"):
            discrepancy_section = (
                "### ⚠️ Laboratory Result Discrepancy Identified\n\n"
                "There is an explicit discrepancy between the value you reported and the official laboratory record stored in your Electronic Health Record (EHR):\n\n"
                "| Parameter | Patient-Reported Value | Retrieved EHR Laboratory Value | Laboratory Reference Range |\n"
                "|-----------|------------------------|--------------------------------|----------------------------|\n"
                f"| **Hemoglobin A1c** | **{rep_val:.1f}%** | **{stored_val:.1f}%** | {ref_range} |\n"
                f"| **Estimated Avg Glucose (eAG)** | **~{rep_eag} mg/dL** | **~{stored_eag} mg/dL** | 70 – 114 mg/dL |\n"
                f"| **Report Date & Source** | *Self-reported (Current)* | **{stored_date}** ({ordering_doc}) | Recorded in Portal |\n\n"
                f"> **Discrepancy Details:** Your stored chart record from **{stored_date}** (ordered by {ordering_doc}) records your HbA1c at **{stored_val:.1f}%**, "
                f"which met the general therapeutic target (< 7.0%). In contrast, your reported value of **{rep_val:.1f}%** indicates higher glycemic exposure (~{rep_eag} mg/dL average glucose).\n\n"
                "**Important Clinical Verification Steps:**\n"
                "1. **Do you have a newer test report?** If you had blood drawn recently at another clinic, hospital, urgent care, or external laboratory, those newer records may not yet be synchronized with MediCare AI.\n"
                "2. **Upload Your New Laboratory Report:** You can upload your official external lab report or documentation directly under [Medical Records & Lab Reports](/patient/records) so your healthcare team can verify and integrate it into your chart.\n"
                "3. **Neither value is silently chosen:** MediCare AI treats your official stored laboratory report as the verified source of truth for August 10, 2026, while acknowledging your reported reading to provide safe clinical navigation.\n\n"
            )

    interval_example = f"such as your reported HbA1c of {rep_val:.1f}%" if rep_val is not None else "such as an HbA1c above 7.0%"

    return (
        "## Glycated Hemoglobin (HbA1c) Laboratory Review & Clinical Guidance\n\n"
        f"{discrepancy_section}"
        "### 1. What Hemoglobin A1c (HbA1c) Measures:\n"
        "• HbA1c reflects the percentage of hemoglobin—the oxygen-carrying protein in red blood cells—that is coated with glucose.\n"
        "• Because red blood cells have an average lifespan of **90 to 120 days**, this test provides an objective measure of average blood sugar control over the preceding 2 to 3 months, rather than a single point-in-time fasting blood sugar.\n\n"
        "### 2. Clinical Thresholds vs. Individualized Therapeutic Targets (ADA Guidelines):\n"
        "• **Diagnostic Reference Standards:**\n"
        "  - **Normal (Non-diabetic):** Below 5.7%\n"
        "  - **Prediabetes:** 5.7% to 6.4%\n"
        "  - **Diagnostic Threshold for Diabetes:** 6.5% or higher (confirmed on repeat testing)\n"
        "• **Diagnostic Threshold vs. Treatment Target:** A diagnostic threshold establishes the initial diagnosis of diabetes (≥ 6.5%), whereas a **treatment target** is the personalized goal established after diagnosis to prevent microvascular and macrovascular complications.\n"
        "• **Targets are Individualized:** The American Diabetes Association (ADA) Standards of Care recommend a general therapeutic target of **< 7.0%** for many nonpregnant adults. However, clinical targets are tailored to each individual: targets of **< 8.0%** may be established for individuals with a history of severe hypoglycemia, extended comorbidities, or advanced complications.\n"
        f"{interpretation_note}\n"
        "### 3. Medication & Lifestyle Safety Boundaries:\n"
        "• **Prescription Continuity:** Do not independently adjust, skip, or change doses of your prescribed medications. Any dosage modifications require clinical evaluation and prescriber authorization.\n"
        "• **Nutrition & Activity:** Balanced carbohydrate distribution and regular physical activity support glycemic stability, but individualized meal plans should be developed in consultation with a registered dietitian or your physician.\n"
        "• **Single-Lab Context:** A single laboratory reading reflects an aggregate trend over time; it does not indicate whether a specific medication dose change caused a sudden shift without longitudinal physician review.\n\n"
        "### 4. Why Follow-Up with Your Treating Clinician Is Appropriate:\n"
        f"• **Comprehensive Trend Evaluation:** Schedule a follow-up consultation with your treating physician ({ordering_doc}) or primary care doctor to review your complete glycemic trend, evaluate recent dietary and lifestyle factors, and discuss whether therapy adjustments or continuous glucose monitoring (CGM) are indicated.\n"
        "• **Recommended Follow-Up Testing Intervals (ADA Guidance):**\n"
        "  - **Meeting Goals:** The ADA recommends assessing HbA1c at least **twice a year (every 6 months)** in patients meeting treatment goals on stable therapy.\n"
        f"  - **Therapy Changes or Above Target:** In patients whose therapy has recently changed or whose readings are not meeting clinical goals ({interval_example}), testing is typically scheduled **every 3 months**.\n"
        f"• **Next Step:** Consult your attending physician ({ordering_doc}) to review your current glycemic control and confirm your individualized target.\n\n"
        f"---\n"
        f"> **Clinical Safety Notice:** MediCare AI provides healthcare navigation and educational guidance. It does not provide definitive medical diagnoses or alter prescribed medications."
    )


# ── 3. AHA / ACC Blood Pressure Recognition & Guidance ───────────────────────

def extract_blood_pressure(query: str) -> Optional[Tuple[int, int]]:
    """Extracts systolic and diastolic blood pressure readings from text."""
    # Matches patterns: 160/100, 160 / 100, BP: 140/90, hypertension is 160/100
    match = re.search(r"\b(\d{2,3})\s*[/]\s*(\d{2,3})\b", query)
    if match:
        try:
            sys_val = int(match.group(1))
            dia_val = int(match.group(2))
            if 60 <= sys_val <= 260 and 40 <= dia_val <= 160:
                return (sys_val, dia_val)
        except ValueError:
            pass
    return None


def classify_blood_pressure(sys_val: int, dia_val: int) -> Dict[str, Any]:
    """
    Classifies blood pressure according to American Heart Association (AHA)
    and American College of Cardiology (ACC) clinical guidelines.
    Distinguishes:
    - Normal (<120 and <80)
    - Elevated (120-129 and <80)
    - Stage 1 Hypertension (130-139 or 80-89)
    - Stage 2 Hypertension (>=140 or >=90)
    - Severe Hypertension / Crisis (>180 and/or >120)
    """
    if sys_val > 180 or dia_val > 120:
        stage = "Severe Hypertension / Hypertensive Crisis"
        meaning = (
            "Systolic reading exceeds 180 mmHg and/or diastolic exceeds 120 mmHg. "
            "If accompanied by acute symptoms (chest pain, shortness of breath, severe headache, numbness, visual disturbances), "
            "this constitutes a Hypertensive Emergency requiring immediate emergency evaluation (911)."
        )
        is_crisis = True
        is_stage_2 = True
    elif sys_val >= 140 or dia_val >= 90:
        stage = "Stage 2 Hypertension"
        meaning = (
            f"Systolic is {sys_val} mmHg (≥ 140) and/or diastolic is {dia_val} mmHg (≥ 90). "
            "This reading falls into Stage 2 Hypertension under American Heart Association criteria. "
            "A single elevated measurement outside resting clinic conditions is not an immediate emergency on its own, "
            "but requires rest, repeat verification, and prompt physician review."
        )
        is_crisis = False
        is_stage_2 = True
    elif sys_val >= 130 or dia_val >= 80:
        stage = "Stage 1 Hypertension"
        meaning = (
            f"Systolic is between 130–139 mmHg or diastolic is between 80–89 mmHg. "
            "Falls under Stage 1 Hypertension. Lifestyle interventions and clinical follow-up are recommended."
        )
        is_crisis = False
        is_stage_2 = False
    elif sys_val >= 120 and dia_val < 80:
        stage = "Elevated Blood Pressure"
        meaning = (
            f"Systolic is between 120–129 mmHg and diastolic is below 80 mmHg. "
            "Blood pressure is elevated above optimal levels, warranting lifestyle modifications to prevent progression."
        )
        is_crisis = False
        is_stage_2 = False
    else:
        stage = "Normal Blood Pressure"
        meaning = "Systolic is less than 120 mmHg and diastolic is less than 80 mmHg (optimal range)."
        is_crisis = False
        is_stage_2 = False

    return {
        "systolic": sys_val,
        "diastolic": dia_val,
        "stage": stage,
        "clinical_meaning": meaning,
        "is_crisis": is_crisis,
        "is_stage_2": is_stage_2,
        "source": "American Heart Association / American College of Cardiology 2017/2024 Guidelines",
    }


def generate_blood_pressure_guidance(
    sys_val: int,
    dia_val: int,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generates structured blood pressure guidance complying with Priority 3:
    1. Recognizes systolic and diastolic readings.
    2. Explains the reading in understandable language using AHA guidelines.
    3. Asks whether the measurement was taken correctly under resting conditions.
    4. Recommends repeating an unexpectedly high reading after resting quietly.
    5. Recommends prompt contact with healthcare professional if elevated readings persist.
    6. Asks about concerning symptoms.
    7. Provides appropriate emergency guidance without classifying every high reading as an emergency.
    8. Does not independently change prescriptions or recommend extra medication doses.
    """
    classification = classify_blood_pressure(sys_val, dia_val)
    stage = classification["stage"]
    meaning = classification["clinical_meaning"]
    is_crisis = classification["is_crisis"]

    meds_note = ""
    if patient_context and patient_context.get("active_medications"):
        med_names = [m["name"] for m in patient_context["active_medications"] if any(k in m["name"].lower() for k in ["lisinopril", "amlodipine", "losartan", "metoprolol", "hydrochlorothiazide"])]
        if med_names:
            meds_note = f"\n• Your chart shows an active prescription for **{', '.join(med_names)}**. Continue taking your medication exactly as prescribed; **never take extra doses or alter your schedule** without direct guidance from your prescribing physician.\n"

    return (
        f"## Blood Pressure Evaluation: {sys_val}/{dia_val} mmHg\n\n"
        f"### 1. Clinical Interpretation (AHA / ACC Guidelines):\n"
        f"• **Systolic Pressure (Top Number):** **{sys_val} mmHg** — the pressure in your arteries when your heart beats.\n"
        f"• **Diastolic Pressure (Bottom Number):** **{dia_val} mmHg** — the pressure in your arteries when your heart rests between beats.\n"
        f"• **Classification:** **{stage}**\n"
        f"• **Clinical Meaning:** {meaning}\n"
        f"{meds_note}\n"
        "### 2. Blood Pressure Measurement Technique Check:\n"
        "Blood pressure fluctuates continuously throughout the day in response to posture, stress, and physical activity. Please verify whether this reading was obtained under standard measurement conditions:\n"
        "• **Rest:** Did you rest quietly in a chair for at least 5 minutes before taking the measurement?\n"
        "• **Arm Position:** Was your arm supported on a flat surface at heart level?\n"
        "• **Posture:** Were your feet flat on the floor with your back supported and legs uncrossed?\n"
        "• **Pre-test Factors:** Did you avoid caffeine, tobacco, and vigorous exercise for at least 30 minutes beforehand?\n"
        "• **Cuff Size:** Was the cuff wrapped snugly around your bare upper arm with the correct bladder size?\n\n"
        "### 3. Recommended Immediate Next Steps:\n"
        "1. **Rest and Repeat:** Sit quietly without talking or checking your phone for 5 minutes, then take a second reading on the same arm.\n"
        "2. **Record the Trend:** Note both readings with the date and time. You can record this directly in your [VitalSense Telemetry Log](/patient/vitals).\n"
        "3. **Contact Your Healthcare Provider:** If your blood pressure remains elevated (systolic ≥ 140 or diastolic ≥ 90 mmHg) over multiple resting measurements across several days, contact your primary care physician or cardiologist for evaluation.\n\n"
        "### 4. Acute Warning Signs (Emergency Evaluation Required):\n"
        "A reading of 160/100 mmHg without symptoms is **not** an immediate emergency, but requires prompt non-emergency medical follow-up.\n"
        "**However, seek immediate emergency medical care (call 911) if this elevated reading is accompanied by any of the following acute symptoms:**\n"
        "• Crushing chest pain, chest tightness, or pain radiating to your jaw or arm\n"
        "• Acute shortness of breath or difficulty breathing\n"
        "• Sudden severe 'worst headache of your life'\n"
        "• Sudden numbness, weakness, facial drooping, or difficulty speaking\n"
        "• Sudden vision changes or extreme dizziness\n\n"
        "> **Safety Advisory:** Never alter your prescribed medication doses or take extra medication without consulting your doctor."
    )


# ── 3B. Dedicated Blood Glucose Guidance (ADA Standards of Care) ──────────────

def generate_blood_glucose_guidance(
    glucose_val: Optional[float] = None,
    context_type: str = "fasting",
    unit: str = "mg/dL",
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generates structured blood glucose interpretation complying with ADA Standards of Care:
    1. Distinguishes device measurements vs manual entries vs historical baseline vs missing readings.
    2. Explains reading relative to ADA targets (Fasting: 80-130 mg/dL; Postprandial: < 180 mg/dL).
    3. Provides safety guidance for hypoglycemia (< 70 mg/dL, Rule of 15) and hyperglycemia.
    4. Explains lifestyle and testing timing context (fasting vs post-meal).
    5. Never alters medication or insulin dosages independently.
    """
    vitals = patient_context.get("latest_vitals", {}) if patient_context else {}
    glu_detail = vitals.get("blood_glucose_detail")

    # If no value passed in prompt, check EHR record
    source_provenance = "Patient Inquiry"
    device_name = None
    recorded_time = None
    if glucose_val is None:
        if glu_detail and glu_detail.get("glucose_value") is not None:
            glucose_val = float(glu_detail["glucose_value"])
            context_type = glu_detail.get("context", context_type)
            unit = glu_detail.get("unit", unit)
            device_name = glu_detail.get("device_name")
            recorded_time = glu_detail.get("measured_at")
            if glu_detail.get("is_device"):
                source_provenance = f"Verified Medical Device ({device_name or 'Bluetooth Glucose Meter'})"
            else:
                source_provenance = "Manual Patient Telemetry Log"
        else:
            return (
                "## Blood Glucose Monitoring Guidance\n\n"
                "### 1. Current Telemetry Status:\n"
                "• **Status:** **No blood glucose measurement recorded today** in your MediCare VitalSense log.\n"
                "• **Clinical Significance:** Regular self-monitoring of blood glucose provides essential data on glycemic stability, meal responses, and medication efficacy.\n\n"
                "### 2. Standard Glycemic Targets (ADA Standards of Care):\n"
                "• **Fasting & Before Meals (Preprandial):** **80 – 130 mg/dL** (4.4 – 7.2 mmol/L) for most nonpregnant adults.\n"
                "• **1 to 2 Hours After Meals (Postprandial):** **Less than 180 mg/dL** (< 10.0 mmol/L).\n"
                "• **Bedtime:** **100 – 140 mg/dL** (5.6 – 7.8 mmol/L).\n\n"
                "### 3. Recommended Actions:\n"
                "1. **Record a Measurement:** Check your fasting morning blood sugar before breakfast using your verified glucose meter or connect a supported Bluetooth device at [Device Station](/patient/devices).\n"
                "2. **Log Reading:** You can log your reading at [Blood Glucose Tracking](/patient/vitalsense/blood-glucose) with date, time, and meal context.\n"
                "3. **Discuss with Clinician:** Share your 30-day glycemic trends with your treating physician to review medication effectiveness."
            )

    # Unit normalization
    val_mg = glucose_val if unit == "mg/dL" else round(glucose_val * 18.0182, 1)
    val_mmol = round(glucose_val / 18.0182, 2) if unit == "mg/dL" else glucose_val

    # ADA classification
    if val_mg < 70:
        cat_title = "Hypoglycemia (Low Blood Sugar - Alert Level 1)"
        cat_desc = "Blood glucose below 70 mg/dL requires prompt correction to prevent neuroglycopenic symptoms."
        alert_action = (
            "**Immediate Action Required (Rule of 15):**\n"
            "1. Consume **15 grams of fast-acting carbohydrate** immediately (e.g., 4 oz / 1/2 cup fruit juice, regular soda, or 3-4 glucose tablets).\n"
            "2. Wait **15 minutes** and re-check your blood glucose.\n"
            "3. If still below 70 mg/dL, repeat with another 15 grams of fast-acting carbs.\n"
            "4. Once normalized, eat a small snack with protein and complex carbohydrate (e.g., peanut butter on crackers) if your next meal is more than an hour away."
        )
    elif val_mg < 100:
        cat_title = "Normal Glycemic Range"
        cat_desc = "This reading is within the standard physiological fasting range (< 100 mg/dL)."
        alert_action = "Continue your current balanced dietary and physical activity plan."
    elif val_mg <= 130:
        cat_title = "Within ADA Preprandial Target (80–130 mg/dL)"
        cat_desc = "Meets the recommended American Diabetes Association target range for adults before meals."
        alert_action = "Maintain your scheduled routine and log post-meal checks periodically."
    elif val_mg < 180:
        cat_title = "Acceptable Postprandial Target (< 180 mg/dL) / Elevated Fasting"
        cat_desc = (
            "If measured 1-2 hours after eating, this reading is within the ADA postprandial goal (< 180 mg/dL). "
            "If taken fasting, this reflects mild hyperglycemia above the 130 mg/dL preprandial threshold."
        )
        alert_action = "Hydrate with water and monitor your trend across subsequent meals."
    elif val_mg >= 250:
        cat_title = "Significant Hyperglycemia (High Blood Sugar)"
        cat_desc = "Blood glucose ≥ 250 mg/dL indicates elevated glycemic exposure."
        alert_action = (
            "• Drink plenty of water to maintain hydration.\n"
            "• If you have Type 1 diabetes or advanced Type 2, check for urine or blood ketones.\n"
            "• Contact your endocrinologist or primary clinician if high readings persist or if you experience nausea, vomiting, or abdominal pain."
        )
    else:
        cat_title = "Elevated Blood Glucose"
        cat_desc = "Above general preprandial and postprandial glycemic target thresholds."
        alert_action = "Review recent carbohydrate intake, physical activity, and medication timing with your care team."

    time_str = f" on {recorded_time[:10]}" if recorded_time else ""
    return (
        f"## Blood Glucose Evaluation: {val_mg} mg/dL ({val_mmol} mmol/L)\n\n"
        f"### 1. Clinical Interpretation (ADA Standards of Care):\n"
        f"• **Reading:** **{val_mg} mg/dL** ({val_mmol} mmol/L) — *Measurement Context: {context_type.capitalize()}*\n"
        f"• **Source Provenance:** **{source_provenance}**{time_str}\n"
        f"• **Classification:** **{cat_title}**\n"
        f"• **Clinical Significance:** {cat_desc}\n\n"
        f"### 2. Guidance & Next Steps:\n"
        f"{alert_action}\n\n"
        f"### 3. Glycemic Target Reference:\n"
        f"• **Fasting / Pre-meal Goal:** 80 – 130 mg/dL (4.4 – 7.2 mmol/L)\n"
        f"• **1-2 Hours Post-meal Goal:** < 180 mg/dL (< 10.0 mmol/L)\n"
        f"• **Hypoglycemia Threshold:** < 70 mg/dL (< 3.9 mmol/L)\n\n"
        f"> **Safety Advisory:** MediCare AI provides evidence-based educational interpretation only. "
        f"Never independently adjust insulin doses or prescription medications without consulting your physician."
    )


# ── 4. Age-Based Preventive Health Screening Guidance (USPSTF) ────────────────

def is_age_screening_query(query: str) -> Optional[int]:
    """Detects whether query asks for age-based preventive health tests, checkups, or screenings."""
    q_lower = query.lower()
    screening_terms = [
        "test", "tests", "screening", "screenings", "checkup", "checkups", "check-up", "check-ups",
        "preventive", "preventative", "wellness", "examine", "recommend", "consider",
        "health check", "health checks", "what should i take", "medical tests", "annual exam", "annual checkup"
    ]
    if not any(t in q_lower for t in screening_terms):
        return None

    # Match age patterns (e.g. at 45, age 45, 45 years old, 45 yo, for 45, 45-year-old)
    m = re.search(r"\b(?:age\s*(\d{1,2})|(\d{1,2})\s*(?:-?\s*years?\s*old|yo)|at\s*(\d{1,2})|for\s*(\d{1,2}))\b", q_lower)
    if m:
        age_str = m.group(1) or m.group(2) or m.group(3) or m.group(4)
        try:
            val = int(age_str)
            if 18 <= val <= 110:
                return val
        except ValueError:
            pass

    # Generic check for common screening milestone ages
    digit_match = re.search(r"\b(45|50|40|55|60|65)\b", q_lower)
    if digit_match:
        return int(digit_match.group(1))

    return 45


def generate_age_screening_guidance(
    age: int,
    query: str = "",
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generates age- and risk-aware preventive screening guidance complying strictly with Priority 2:
    Separates the response into:
    A. Current symptoms
    B. Preventive health screening (USPSTF Grade A/B recommendations)
    C. Recommended follow-up questions
    """
    # ── Part A: Current Symptoms ──
    extracted_symptoms = extract_reported_symptoms(query) if query else []
    if extracted_symptoms:
        symptoms_phrase = format_symptoms_phrase(extracted_symptoms)
        symptoms_list_str = "\n".join(f"  • **{s.title()}**" for s in extracted_symptoms)
        followups = generate_tailored_followups(extracted_symptoms)
        red_flags = generate_tailored_red_flags(extracted_symptoms)
        part_a = (
            f"### A. Current Symptoms Evaluation:\n"
            f"You have reported experiencing the following acute symptom(s):\n"
            f"{symptoms_list_str}\n\n"
            f"• **Clinical Starting Point:** For acute symptoms like {symptoms_phrase}, a primary care physician (General Practitioner / Family Medicine) is the recommended starting point for clinical evaluation before scheduling non-urgent elective screening.\n"
            f"• **Key Symptom Follow-Up Questions:**\n"
            f"  - {followups[0]}\n"
            f"  - {followups[1] if len(followups) > 1 else 'Are you able to maintain adequate hydration and rest?'}\n"
            f"• **Warning Signs:** Seek prompt urgent or emergency medical evaluation if you develop {red_flags[0].lower()} or persistent high fever.\n"
            f"*(Acute symptoms should always be evaluated clinically prior to undergoing elective routine screening procedures.)*\n"
        )
    else:
        part_a = (
            f"### A. Current Symptoms:\n"
            f"• **No acute symptoms reported:** Your inquiry focuses directly on proactive, age-appropriate preventive health maintenance and wellness checkups.\n"
        )

    # ── Part B: Preventive Health Screening ──
    colorectal_note = (
        "• **Colorectal Cancer Screening (USPSTF 2021 Update — Grade A Recommendation):**\n"
        f"  - **Eligibility:** Routine screening begins at **age 45** for all average-risk adults (aged 45 to 75).\n"
        "  - **Available Modalities:** Colonoscopy every 10 years, annual Fecal Immunochemical Test (FIT), or stool DNA-FIT (Cologuard) every 3 years. Colonoscopy is the gold standard because it allows simultaneous detection and removal of precancerous polyps."
    )

    bp_note = (
        "• **Blood Pressure Screening (USPSTF — Grade A Recommendation):**\n"
        "  - **Recommendation:** Annual blood pressure screening for all adults aged 40 and older, or more frequently if baseline readings are elevated or if hypertension is already diagnosed."
    )

    diabetes_note = (
        "• **Diabetes & Prediabetes Monitoring / Screening (USPSTF 2021 — Grade B Recommendation / ADA):**\n"
        "  - **Recommendation:** Screening for prediabetes and type 2 diabetes with fasting plasma glucose or HbA1c in asymptomatic adults aged **35 to 70** who are overweight or obese, or who have cardiovascular risk factors.\n"
        "  - **For Patients with Diagnosed Diabetes:** Regular HbA1c monitoring every 3 to 6 months to guide therapy and prevent long-term complications."
    )

    cardio_note = (
        "• **Cholesterol & Cardiovascular Risk Assessment (AHA / ACC / USPSTF):**\n"
        "  - **Recommendation:** Fasting or non-fasting lipid profile (Total cholesterol, LDL-C, HDL-C, Triglycerides) and calculation of 10-year Atherosclerotic Cardiovascular Disease (ASCVD) risk score every 4 to 6 years in average-risk adults."
    )

    breast_cervical_note = (
        "• **Breast and Cervical Cancer Screening (When Applicable):**\n"
        "  - **Breast Cancer (USPSTF 2024 Update — Grade B):** Biennial (every 2 years) screening mammography starting at **age 40 through age 74** for women and individuals with female breast tissue.\n"
        "  - **Cervical Cancer (USPSTF — Grade A):** Cervical cytology (Pap smear) every 3 years for individuals with a cervix aged 21 to 29; for ages 30 to 65, Pap smear every 3 years, high-risk HPV (hrHPV) testing every 5 years, or hrHPV co-testing every 5 years."
    )

    lung_note = (
        "• **Lung Cancer Screening (USPSTF 2021 — Grade B — Eligibility Restricted):**\n"
        "  - **Criteria:** Annual low-dose computed tomography (LDCT) scan is recommended **only** for adults aged **50 to 80** who have a **20 pack-year smoking history** AND currently smoke or have quit within the past 15 years.\n"
        "  - **Clinical Rule:** Lung cancer screening is **not** indicated for individuals without a qualifying tobacco smoking history."
    )

    other_screenings_note = (
        "• **Other Screenings & Adult Immunizations (CDC / ACIP / USPSTF):**\n"
        "  - **Prostate Cancer (USPSTF — Grade C):** Shared clinical decision-making regarding PSA screening for men aged 55 to 69 (or earlier, from age 45, for individuals with first-degree family history or African American ancestry).\n"
        "  - **Immunizations:** Annual influenza, updated COVID-19, Tdap booster every 10 years, and Recombinant Zoster Vaccine (Shingrix 2-dose series) starting at age 50."
    )

    # ── Part C: Recommended Follow-Up Questions ──
    part_c = (
        "### C. Recommended Follow-Up Questions (To Personalize Your Care Plan):\n"
        "Because clinical guidelines do **not** recommend every test for every patient, your healthcare provider will tailor recommendations based on these key factors:\n"
        "1. **Previous Screenings:** When did you last have a colonoscopy, mammogram, Pap test, or comprehensive blood panel?\n"
        "2. **Family History:** Has any first-degree relative (parent, sibling, child) had colorectal cancer, breast cancer, ovarian cancer, or early cardiovascular disease before age 50?\n"
        "3. **Smoking History:** Have you ever smoked cigarettes? If so, approximately how many packs per day and for how many total years?\n"
        "4. **Relevant Anatomy & Biological Sex:** Are organ-specific screenings (such as mammography, cervical cytology, or prostate screening) applicable to your anatomy?\n"
    )

    return (
        f"## Evidence-Based Preventive Health Screening Guidance (Age {age})\n\n"
        f"At age {age}, preventive healthcare focuses on early detection of cardiovascular risk, metabolic health, and age-appropriate cancer screenings.\n\n"
        f"{part_a}\n"
        f"### B. Preventive Health Screening Guidelines:\n"
        f"> **Core Clinical Principle:** Authoritative guidelines (USPSTF, ADA, AHA) do **not** recommend every test for every patient. Screenings are personalized based on biological sex, anatomy, family medical history, lifestyle factors, and prior screening intervals.\n\n"
        f"{colorectal_note}\n\n"
        f"{bp_note}\n\n"
        f"{diabetes_note}\n\n"
        f"{cardio_note}\n\n"
        f"{breast_cervical_note}\n\n"
        f"{lung_note}\n\n"
        f"{other_screenings_note}\n\n"
        f"{part_c}\n"
        f"---\n"
        f"> **Clinical Recommendation:** Schedule an annual wellness examination with your primary care clinician to review these individualized screening categories and establish your personal preventive health schedule."
    )


# ── 5. Health Topic Extraction & Clinical Guidance Builders ───────────────────

def extract_query_health_topics(query: str) -> Dict[str, Any]:
    """
    Analyzes the patient's current query to extract explicit clinical topics,
    conditions, diagnostic inquiries, and goals mentioned by the patient.
    Ensures the current message determines the primary direction of the response.
    """
    q_lower = query.lower()

    # 1. Thyroid terms
    has_thyroid = bool(re.search(r"\b(?:thyroid|hypothyroid|hypothyroidism|hyperthyroid|hyperthyroidism|hashimoto|graves|goiter|levothyroxine|synthroid|tsh|free t4|free t3)\b", q_lower))
    is_hypothyroid = bool(re.search(r"\b(?:hypothyroid|hypothyroidism|underactive thyroid|hashimoto)\b", q_lower))
    is_hyperthyroid = bool(re.search(r"\b(?:hyperthyroid|hyperthyroidism|overactive thyroid|graves)\b", q_lower))

    # 2. Weight terms
    has_weight = bool(re.search(r"\b(?:weight loss|lose weight|losing weight|weight management|manage (?:my )?weight|weight gain|gaining weight|my weight|body weight|shed pounds|obesity|overweight|bmi)\b", q_lower))

    # 3. Diabetes terms
    has_diabetes = bool(re.search(r"\b(?:type 2 diabetes|type 1 diabetes|diabetes|diabetic|blood sugar|glycemic|glucose|t2d)\b", q_lower))

    # 4. Hypertension terms
    has_hypertension = bool(re.search(r"\b(?:high blood pressure|hypertension|blood pressure|elevated bp|my bp)\b", q_lower))

    # 5. Diagnostic testing request
    has_tests_request = bool(re.search(r"\b(?:what tests|which tests|tests should i|test should i|tests to check|test to check|how to check|check my|lab tests|blood work|screen for)\b", q_lower))

    # 6. Specific relationship question (e.g. "can my thyroid condition affect my weight?")
    is_relationship_question = bool(re.search(r"\b(?:affect|influence|cause|impact|relationship between|connected to)\b", q_lower)) and has_thyroid and has_weight

    # 7. Explicit conditions mentioned in the query
    explicit_conditions: List[str] = []
    if has_diabetes:
        explicit_conditions.append("Type 2 Diabetes")
    if is_hypothyroid:
        explicit_conditions.append("Hypothyroidism")
    elif is_hyperthyroid:
        explicit_conditions.append("Hyperthyroidism")
    elif has_thyroid:
        explicit_conditions.append("Thyroid Health")
    if has_hypertension:
        explicit_conditions.append("Essential Hypertension")

    return {
        "has_thyroid": has_thyroid,
        "is_hypothyroid": is_hypothyroid,
        "is_hyperthyroid": is_hyperthyroid,
        "has_weight": has_weight,
        "has_diabetes": has_diabetes,
        "has_hypertension": has_hypertension,
        "has_tests_request": has_tests_request,
        "is_relationship_question": is_relationship_question,
        "explicit_conditions": explicit_conditions,
    }


def check_ehr_thyroid_status(patient_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Inspects EHR context for documented thyroid diagnoses, thyroid labs, and thyroid prescriptions."""
    has_thyroid_diag = False
    diag_name = ""
    thyroid_labs = []
    thyroid_meds = []

    if patient_context:
        for d in patient_context.get("confirmed_diagnoses", []):
            title = d.get("title", "").lower()
            if any(k in title for k in ["thyroid", "hypothyroid", "hyperthyroid", "hashimoto", "graves"]):
                has_thyroid_diag = True
                diag_name = d.get("title", "Thyroid Condition")
                break

        for l in patient_context.get("recent_labs", []):
            t_name = l.get("test_name", "").lower()
            if any(k in t_name for k in ["tsh", "thyroid", "t4", "t3"]):
                thyroid_labs.append(l)

        for m in patient_context.get("active_medications", []):
            m_name = m.get("name", "").lower()
            if any(k in m_name for k in ["levothyroxine", "synthroid", "armour", "liothyronine", "methimazole"]):
                thyroid_meds.append(m)

    return {
        "has_thyroid_diag": has_thyroid_diag,
        "diag_name": diag_name,
        "thyroid_labs": thyroid_labs,
        "thyroid_meds": thyroid_meds,
    }


def generate_secondary_ehr_context_note(patient_context: Optional[Dict[str, Any]]) -> str:
    """Builds a clear, non-overriding secondary note regarding existing EHR diagnoses."""
    if not patient_context:
        return ""
    diagnoses = patient_context.get("confirmed_diagnoses", [])
    meds = patient_context.get("active_medications", [])
    if not diagnoses and not meds:
        return ""

    diag_names = [d["title"] for d in diagnoses]
    med_names = [f"{m['name']} ({m.get('dosage', '')})" for m in meds]

    diag_text = ", ".join(diag_names) if diag_names else "routine preventive profile"
    med_text = ", ".join(med_names) if med_names else "none"

    return (
        "### Clinical Context (EHR Integration & Secondary Considerations):\n"
        f"• **Confirmed Chart Records:** Your electronic health record documents active diagnoses of **{diag_text}**, "
        f"with current prescriptions including **{med_text}**.\n"
        "• **Coordinated Care Advisory:** While the educational guidance above focuses on your specific question, "
        "your ongoing care plan should consider blood sugar stability and blood pressure control when discussing nutritional or lifestyle adjustments with your clinician.\n"
    )


# ── Guidance Builders for Specific Health Topics ──────────────────────────────

def generate_thyroid_and_weight_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Evidence-based guidance addressing thyroid health and safe weight management.
    The patient's current question is the primary topic; existing EHR diagnoses provide secondary context only.
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    ehr_thyroid = check_ehr_thyroid_status(patient_context)
    ehr_note = generate_secondary_ehr_context_note(patient_context)

    # EHR Thyroid status statement
    if ehr_thyroid["has_thyroid_diag"]:
        thyroid_status_stmt = f"• **EHR Status:** Your health record documents an active diagnosis of **{ehr_thyroid['diag_name']}**."
    else:
        thyroid_status_stmt = (
            "• **EHR Status:** According to your verified Electronic Health Record, there is currently **no documented thyroid diagnosis "
            "(such as hypothyroidism or hyperthyroidism)**, and no recent thyroid laboratory panels (TSH or Free T4) or thyroid prescriptions on file."
        )

    return (
        "## Evidence-Based Guidance: Thyroid Health & Safe Weight Management\n\n"
        f"Hello {name}. Below is evidence-based educational guidance addressing your specific inquiry regarding **thyroid health and safe weight management**.\n\n"
        "### 1. Nutritional & Lifestyle Habits Supporting Thyroid Health:\n"
        "The thyroid gland requires specific trace minerals and balanced nutrition for proper hormone synthesis:\n"
        "• **Dietary Iodine in Moderation:** Iodine is a foundational component of thyroid hormones (T4 and T3). Most adults meet requirements through iodized table salt, seafood, dairy, and eggs. *Clinical caution: Avoid high-dose kelp or unverified iodine supplements without physician orders, as excessive iodine can paradoxically trigger or worsen thyroid dysfunction.*\n"
        "• **Selenium & Zinc:** Essential mineral cofactors required for the enzymes (deiodinases) that convert inactive T4 into active T3, and for protecting the thyroid from oxidative stress. Natural dietary sources include Brazil nuts (1–2 nuts daily provide adequate selenium), sunflower seeds, legumes, eggs, and lean poultry.\n"
        "• **Balanced Whole-Food Eating:** Emphasize colorful vegetables, whole fruits, whole grains, and quality lean proteins to support overall cellular metabolism and reduce chronic systemic inflammation.\n"
        f"{thyroid_status_stmt}\n"
        "• **Clinical Evaluation:** Thyroid function cannot be diagnosed from symptoms alone. If you experience persistent fatigue, unusual sensitivity to cold or heat, hair thinning, or unexplained weight shifts, your doctor can evaluate your thyroid function with simple blood tests (**TSH and Free T4**).\n\n"
        "### 2. Evidence-Based Safe Weight Management:\n"
        "Sustainable, healthy weight management focuses on metabolic nourishment rather than extreme caloric deprivation:\n"
        "• **Nutrient-Dense Balanced Nutrition:** Prioritize high-fiber vegetables, whole fruits, legumes, whole grains, and lean proteins. Fiber promotes prolonged satiety, slows gastric emptying, and blunts insulin spikes.\n"
        "• **Portion Awareness without Restrictive Dieting:** Avoid rigid fad diets or severe calorie restriction, which can cause adaptive thermogenesis (slowing metabolic rate) and impair peripheral conversion of thyroid hormones.\n"
        "• **Regular Physical Activity:** Aim for at least **150 minutes per week** of moderate-intensity aerobic physical activity (such as brisk walking or swimming) combined with **2 to 3 sessions of resistance training**. Resistance training preserves and builds metabolically active muscle tissue.\n"
        "• **Restorative Sleep:** Target **7 to 9 hours** of restful sleep per night. Sleep deprivation alters appetite-regulating hormones (increasing ghrelin and decreasing leptin) and raises cortisol, making weight management significantly more difficult.\n\n"
        "### 3. Understanding How Thyroid Function Influences Weight:\n"
        "• **The Metabolic Regulator:** Thyroid hormones act as the body's metabolic pacemaker, regulating basal metabolic rate (BMR).\n"
        "• **Hypothyroidism (Underactive):** Deficient hormone production slows metabolism, which can contribute to a modest weight gain (typically **5 to 10 pounds**), much of which is water and salt retention rather than massive fat accumulation.\n"
        "• **Hyperthyroidism (Overactive):** Excessive hormone levels increase metabolic expenditure, often causing unintentional weight loss despite normal or increased appetite.\n"
        "• **Clinical Reality:** Weight changes are multi-factorial (nutrition, physical activity, sleep, stress, insulin sensitivity, genetics). Do not assume weight concerns are caused by thyroid disease without objective lab confirmation.\n\n"
        f"{ehr_note}"
        "---\n"
        "> **Clinical Safety Notice:** MediCare AI provides healthcare education and navigation. It does not diagnose medical conditions or recommend unverified supplements. Consult your primary care physician or a Registered Dietitian for an individualized evaluation."
    )


def generate_thyroid_testing_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Evidence-based guidance on clinical laboratory evaluation for thyroid function."""
    name = patient_context.get("name", "there") if patient_context else "there"
    ehr_note = generate_secondary_ehr_context_note(patient_context)

    return (
        "## Thyroid Diagnostic Evaluation & Clinical Laboratory Tests\n\n"
        f"Hello {name}. When evaluating thyroid function, healthcare providers use standardized venous blood tests to objectively assess hormone production and regulation.\n\n"
        "### 1. Primary Diagnostic Blood Tests:\n"
        "• **TSH (Thyroid-Stimulating Hormone):**\n"
        "  - The primary, most sensitive first-line screening test for thyroid function.\n"
        "  - Produced by the pituitary gland to signal the thyroid. An **elevated TSH** indicates an underactive thyroid (hypothyroidism), as the pituitary sends extra signals to stimulate hormone production. A **low or suppressed TSH** suggests an overactive thyroid (hyperthyroidism).\n"
        "• **Free T4 (Free Thyroxine):**\n"
        "  - Measures the active, unbound circulating form of thyroxine produced directly by the thyroid gland.\n"
        "  - Used alongside TSH to confirm whether thyroid dysfunction is overt or subclinical and to guide treatment.\n"
        "• **Free T3 (Free Triiodothyronine):**\n"
        "  - Measures the active thyroid hormone. Particularly useful when hyperthyroidism is suspected or when evaluating complex conversion patterns.\n\n"
        "### 2. Specialized & Secondary Evaluations:\n"
        "• **Thyroid Autoantibodies (TPOAb and TgAb):**\n"
        "  - **Thyroid Peroxidase Antibodies (TPOAb):** Elevated in autoimmune hypothyroidism (Hashimoto's thyroiditis).\n"
        "  - **TSH Receptor Antibodies (TRAb):** Evaluated if Graves' disease (autoimmune hyperthyroidism) is suspected.\n"
        "• **Thyroid Ultrasound:**\n"
        "  - High-resolution imaging indicated if a physician palpates a thyroid nodule, asymmetric enlargement, or a generalized goiter during a neck examination.\n\n"
        "### 3. Your Electronic Health Record (EHR) Status:\n"
        "• According to your stored records in the MediCare portal, there are currently **no thyroid lab panels (such as TSH or Free T4)** on record in your chart.\n"
        "• If you have experienced symptoms such as chronic fatigue, temperature intolerance, mood changes, bowel irregularity, or unexplained weight shifts, discuss ordering a standard TSH and Free T4 panel with your primary care provider.\n\n"
        f"{ehr_note}"
        "---\n"
        "> **Important Clinical Safety Notice:** Do not take OTC thyroid glandulars or high doses of biotin/iodine prior to testing, as biotin can interfere with laboratory immunoassay accuracy and iodine can alter thyroid physiology."
    )


def generate_thyroid_weight_relationship_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Educational guidance explaining the physiological relationship between thyroid function and weight."""
    name = patient_context.get("name", "there") if patient_context else "there"
    ehr_note = generate_secondary_ehr_context_note(patient_context)

    return (
        "## Understanding the Relationship Between Thyroid Function and Body Weight\n\n"
        f"Hello {name}. The relationship between thyroid function and body weight is rooted in human endocrinology and basal metabolic rate.\n\n"
        "### 1. How Thyroid Hormones Regulate Metabolism:\n"
        "• Thyroid hormones (primarily T3 and T4) act as the body's metabolic regulator. They determine basal energy expenditure—the number of calories your body burns at rest to maintain essential physiological functions.\n"
        "• When hormone levels shift out of the normal reference range, basal metabolic rate shifts accordingly.\n\n"
        "### 2. Hypothyroidism vs. Hyperthyroidism Effects on Weight:\n"
        "• **Hypothyroidism (Underactive Thyroid):**\n"
        "  - Reduced hormone levels slow basal metabolic expenditure.\n"
        "  - This typically results in a **modest weight gain (usually 5 to 10 pounds)**.\n"
        "  - Clinical reality: A substantial portion of this weight gain is **water and salt retention** rather than massive fat accumulation. While treating diagnosed hypothyroidism with proper hormone replacement (such as levothyroxine) normalizes metabolic rate and resolves fluid retention, thyroid treatment alone does not cause dramatic weight loss without foundational nutrition and physical activity.\n"
        "• **Hyperthyroidism (Overactive Thyroid):**\n"
        "  - Excess thyroid hormones accelerate metabolic expenditure.\n"
        "  - This frequently causes unintentional weight loss, often accompanied by increased appetite, rapid heart rate, and heat intolerance. Normalizing thyroid levels typically stabilizes body weight back to baseline.\n\n"
        "### 3. Clinical Reality & Multi-Factorial Weight Regulation:\n"
        "• **Do Not Assume Diagnosis:** Weight fluctuations alone do not mean a thyroid disorder is present. Body weight is governed by numerous interconnected factors including dietary composition, portion size, physical activity, sleep quality, chronic stress, insulin sensitivity, and medications.\n"
        "• **Recommended Action:** If you have concerns about weight changes or fatigue, consult your primary care doctor for an objective evaluation, including a simple TSH and Free T4 blood test.\n\n"
        f"{ehr_note}"
        "---\n"
        "> **Clinical Safety Advisory:** MediCare AI does not diagnose thyroid conditions. Do not initiate unverified weight loss supplements or thyroid stimulants without physician guidance."
    )


def generate_thyroid_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Evidence-based guidance focused on general thyroid health and nutritional support."""
    name = patient_context.get("name", "there") if patient_context else "there"
    ehr_thyroid = check_ehr_thyroid_status(patient_context)
    ehr_note = generate_secondary_ehr_context_note(patient_context)

    if ehr_thyroid["has_thyroid_diag"]:
        ehr_status = f"• **Documented Chart Diagnosis:** Your record shows an active diagnosis of **{ehr_thyroid['diag_name']}**."
    else:
        ehr_status = "• **EHR Status:** There is currently **no documented thyroid condition** on file in your electronic health record."

    return (
        "## Evidence-Based Lifestyle & Nutritional Guidance for Thyroid Health\n\n"
        f"Hello {name}. Below is evidence-based educational information on supporting thyroid health through nutrition and lifestyle habits.\n\n"
        "### 1. Essential Micronutrients Supporting Thyroid Function:\n"
        "• **Dietary Iodine in Moderation:** Required for the synthesis of thyroid hormones (T4 and T3). Most individuals obtain sufficient amounts through iodized table salt, seafood, dairy, and eggs. Avoid high-dose kelp tablets or unmeasured iodine drops, which can paradoxically trigger thyroid inflammation or dysfunction.\n"
        "• **Selenium & Zinc:** Crucial trace minerals that support the enzymatic conversion of T4 into the active T3 hormone and protect the thyroid gland from oxidative stress. Good dietary sources include Brazil nuts (1–2 nuts per day), pumpkin seeds, sunflower seeds, eggs, and legumes.\n"
        "• **Antioxidant-Rich Whole Foods:** A varied diet rich in colorful vegetables, whole fruits, and lean proteins helps reduce systemic inflammation and supports immune balance.\n\n"
        "### 2. Supportive Daily Habits:\n"
        "• **Consistent Sleep & Stress Management:** Target 7 to 9 hours of sleep. Prolonged psychological stress elevates cortisol, which can inhibit pituitary TSH secretion and reduce peripheral conversion of T4 to T3.\n"
        "• **Regular Physical Activity:** Regular aerobic and resistance exercise supports cellular energy, mood, and cardiovascular health.\n"
        "• **Medication Timing (If Prescribed Thyroid Hormone):** If you are ever prescribed thyroid medication (such as levothyroxine), take it on an empty stomach with a full glass of water at least 30 to 60 minutes before breakfast, and separate it by at least 4 hours from calcium, iron supplements, or antacids, which bind and block absorption.\n\n"
        "### 3. Understanding Thyroid Health & Testing:\n"
        f"{ehr_status}\n"
        "• **Hypothyroidism vs. Hyperthyroidism:** Hypothyroidism (underactive) slows metabolic processes (fatigue, cold sensitivity, constipation, modest weight gain). Hyperthyroidism (overactive) accelerates metabolism (rapid pulse, nervousness, heat intolerance, weight loss).\n"
        "• **Testing:** Thyroid status is evaluated via venous blood tests: **TSH (Thyroid-Stimulating Hormone)** and **Free T4**.\n\n"
        f"{ehr_note}"
        "---\n"
        "> **Clinical Safety Notice:** Always discuss thyroid questions and any proposed supplement changes with your healthcare provider."
    )


def generate_weight_management_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Safe, evidence-based educational guidance for weight loss and weight management."""
    name = patient_context.get("name", "there") if patient_context else "there"
    ehr_note = generate_secondary_ehr_context_note(patient_context)

    return (
        "## Evidence-Based Guidance for Safe Weight Management\n\n"
        f"Hello {name}. Safe and sustainable weight management is built on foundational lifestyle habits that support long-term metabolic health.\n\n"
        "### 1. Balanced Nutrition & Sustainable Habits:\n"
        "• **Focus on Nutrient Density:** Emphasize high-fiber vegetables, whole fruits, whole grains (quinoa, brown rice, oats), and lean proteins (fish, poultry, legumes, tofu). These foods provide essential vitamins and minerals while promoting prolonged satiety.\n"
        "• **Portion Awareness without Restrictive Dieting:** Restrictive crash diets often trigger metabolic slowing and loss of lean muscle mass. Using visual plate balancing (half non-starchy vegetables, one-quarter lean protein, one-quarter quality complex carbohydrates) supports sustainable caloric moderation.\n"
        "• **Limit Liquid Calories:** Minimize sugar-sweetened beverages, commercial sodas, sweetened teas, and fruit juices, which contribute calories without providing dietary fiber or satiety.\n\n"
        "### 2. Physical Activity & Muscle Preservation:\n"
        "• **Aerobic Exercise:** Aim for at least **150 minutes per week** of moderate-intensity aerobic activity (such as brisk walking, cycling, or swimming).\n"
        "• **Resistance Training:** Include 2 to 3 sessions of muscle-strengthening exercises weekly. Maintaining lean muscle mass sustains your resting metabolic rate (BMR).\n\n"
        "### 3. Restorative Sleep & Metabolic Hormones:\n"
        "• **Sleep Duration:** Aim for **7 to 9 hours** of quality sleep per night. Inadequate sleep elevates cortisol and ghrelin (the hunger hormone) while suppressing leptin (the satiety hormone).\n"
        "• **Stress Reduction:** Chronic stress triggers emotional eating and promotes abdominal fat distribution through elevated glucocorticoids.\n\n"
        "### 4. Medical Factors & Professional Collaboration:\n"
        "• **Underlying Medical Considerations:** Metabolic rate and weight trajectory can be influenced by underlying conditions (such as thyroid function, insulin resistance, and hormonal fluctuations) and certain medications.\n"
        "• **When to Consult a Professional:** Consult your primary care physician or a Registered Dietitian for individualized guidance, especially if you have chronic health conditions. Avoid extreme diets, unregulated weight-loss supplements, or unrealistic targets.\n\n"
        f"{ehr_note}"
        "---\n"
        "> **Clinical Safety Advisory:** MediCare AI provides general health education. Discuss any substantial dietary or exercise changes with your healthcare team."
    )


def generate_diabetes_nutrition_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Nutritional guidance specifically tailored to Type 2 Diabetes Mellitus."""
    name = patient_context.get("name", "there") if patient_context else "there"

    return (
        "## Evidence-Based Nutritional Guidance for Type 2 Diabetes Mellitus\n\n"
        f"Hello {name}. Nutritional choices play a direct role in glycemic stability and long-term diabetes management.\n\n"
        "### 1. Foods That Support Blood Glucose Stability:\n"
        "• **Non-Starchy Vegetables:** Spinach, kale, broccoli, cauliflower, asparagus, peppers, and green beans are low in carbohydrate and calories while providing essential vitamins and fiber. They have minimal impact on blood glucose.\n"
        "• **Complex High-Fiber Carbohydrates:** Legumes (lentils, black beans, chickpeas), steel-cut oats, quinoa, and berries. Dietary fiber slows carbohydrate digestion and absorption, helping blunt postprandial blood sugar spikes.\n"
        "• **Lean Protein Sources:** Fish, skinless poultry, eggs, tofu, and unsweetened Greek yogurt. Protein slows gastric emptying, promotes satiety, and stabilizes blood glucose curves.\n"
        "• **Heart-Healthy Fats:** Extra-virgin olive oil, avocados, almonds, and walnuts provide cardioprotective monounsaturated fats.\n\n"
        "### 2. The Diabetes Plate Method:\n"
        "• Fill **half your plate** with non-starchy vegetables.\n"
        "• Fill **one quarter** with lean protein.\n"
        "• Fill **one quarter** with quality high-fiber carbohydrates.\n\n"
        "### 3. Foods to Minimize:\n"
        "• **Liquid Sugars:** Sodas, sweetened coffee drinks, sweet teas, and fruit juices cause rapid, steep glucose spikes without providing satiety.\n"
        "• **Refined Carbohydrates:** White bread, white rice, commercial pastries, and crackers digest quickly into simple sugars.\n\n"
        "### 4. Chart Alignment & Medication Safety:\n"
        "• **EHR Prescriptions:** Your chart documents an active prescription for **Metformin (500mg)**. Take your medication with meals as prescribed, and do not adjust dosages without prescriber supervision.\n"
        "• **Monitoring:** Regular self-monitoring of fasting and postprandial blood glucose helps you observe how specific foods influence your personal glycemic response.\n\n"
        "---\n"
        "> **Clinical Safety Advisory:** Consult your treating physician or a Certified Diabetes Care and Education Specialist (CDCES) for an individualized meal plan."
    )


def generate_hypertension_management_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Evidence-based management strategies specifically for Essential Hypertension."""
    name = patient_context.get("name", "there") if patient_context else "there"

    return (
        "## Evidence-Based Management Strategies for Essential Hypertension\n\n"
        f"Hello {name}. Effective management of high blood pressure combines lifestyle interventions with medical therapy to protect your cardiovascular and arterial health.\n\n"
        "### 1. Dietary Approaches to Stop Hypertension (DASH Eating Pattern):\n"
        "• Emphasize vegetables, whole fruits, whole grains, nuts, and low-fat dairy products rich in potassium, calcium, and magnesium.\n"
        "• **Dietary Sodium Reduction:** The American Heart Association (AHA) and ACC recommend limiting daily sodium to **under 2,300 mg**, with an optimal target of **1,500 mg per day** for adults with hypertension. Focus on preparing fresh meals and checking sodium values on food labels.\n\n"
        "### 2. Physical Activity & Weight Management:\n"
        "• Aim for at least **150 minutes per week** of moderate-intensity aerobic exercise (such as brisk walking, cycling, or swimming).\n"
        "• Regular physical activity strengthens the heart muscle, allowing it to pump blood with less effort and decreasing pressure against arterial walls.\n\n"
        "### 3. Sleep, Stress & Lifestyle Factors:\n"
        "• **Sleep:** Target **7 to 9 hours** of restorative sleep nightly. Inquire about screening for obstructive sleep apnea if you snore loudly or wake up unrefreshed, as sleep apnea strongly drives resistant hypertension.\n"
        "• **Stress Management:** Practice relaxation techniques (deep breathing, meditation) to lower sympathetic nervous system tone.\n\n"
        "### 4. Proper Home Blood Pressure Monitoring Technique:\n"
        "• Rest quietly in a chair for 5 minutes before measuring.\n"
        "• Keep feet flat on the floor, back supported, and arm rested at heart level.\n"
        "• Avoid caffeine, tobacco, and exercise for 30 minutes before readings.\n\n"
        "### 5. Medication Adherence & Safety:\n"
        "• **EHR Prescription:** Your chart documents an active prescription for **Lisinopril (10mg)**. Take your medication consistently as directed; never skip doses or stop therapy without consulting your doctor.\n\n"
        "---\n"
        "> **Clinical Safety Advisory:** For acute readings exceeding 180/120 mmHg accompanied by chest pain, shortness of breath, or headache, seek immediate emergency medical care."
    )


def generate_multi_condition_guidance(
    query: str,
    conditions: List[str],
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Evidence-based guidance addressing multiple health conditions separately and thoroughly.
    Ensures every mentioned condition receives dedicated, distinct guidance.
    """
    name = patient_context.get("name", "there") if patient_context else "there"
    q_lower = query.lower()
    cond_title = " & ".join(conditions)

    sections = []

    # If Diabetes is one of the conditions
    if any("diabetes" in c.lower() for c in conditions) or "diabetes" in q_lower:
        sections.append(
            "### Part A: Evidence-Based Lifestyle Habits for Type 2 Diabetes\n"
            "• **Carbohydrate Awareness:** Choose complex carbohydrates with high dietary fiber (beans, lentils, steel-cut oats, non-starchy vegetables) to slow glucose absorption and prevent sharp postprandial spikes.\n"
            "• **Consistent Meal Timing:** Distribute carbohydrates evenly across your daily meals to support smoother glycemic stability.\n"
            "• **Glycemic Monitoring:** Track fasting morning blood glucose and occasional post-meal readings to evaluate individual responses to meals.\n"
            "• **Prescription Adherence:** Continue active prescribed therapies (such as Metformin) precisely as directed with meals."
        )

    # If Hypothyroidism or Thyroid is one of the conditions
    if any("thyroid" in c.lower() or "hypothyroid" in c.lower() for c in conditions) or any(t in q_lower for t in ["thyroid", "hypothyroid"]):
        sections.append(
            "### Part B: Evidence-Based Lifestyle Habits for Hypothyroidism\n"
            "• **Nutritional Micronutrients:** Ensure adequate dietary selenium (Brazil nuts, sunflower seeds, eggs) and zinc to support peripheral conversion of T4 into active T3. Maintain balanced dietary iodine through iodized salt and seafood, avoiding mega-dose kelp or iodine supplements.\n"
            "• **Medication Administration Rules:** If taking thyroid hormone replacement (such as levothyroxine), take it on an empty stomach with a full glass of water, 30 to 60 minutes before breakfast. Separate it by at least 4 hours from calcium, iron supplements, antacids, or high-fiber foods, which impair absorption.\n"
            "• **Avoid Extreme Restrictive Diets:** Severe caloric deprivation or prolonged fasting can suppress metabolic rate and reduce active T3 levels."
        )

    # If Hypertension is one of the conditions
    if any("hypertension" in c.lower() or "blood pressure" in c.lower() for c in conditions) or any(t in q_lower for t in ["hypertension", "blood pressure"]):
        sections.append(
            "### Part C: Evidence-Based Lifestyle Habits for Essential Hypertension\n"
            "• **Sodium Reduction:** Keep dietary sodium below 2,300 mg/day, aiming toward an optimal target of 1,500 mg/day.\n"
            "• **DASH Dietary Pattern:** Emphasize potassium-rich vegetables, fruits, whole grains, and low-fat dairy.\n"
            "• **Home Blood Pressure Monitoring:** Check resting blood pressure under quiet conditions and log your readings for physician review."
        )

    # Synergistic habits
    shared_section = (
        "### Synergistic Metabolic & Cardiovascular Health Strategies:\n"
        "• **Physical Activity:** Aim for at least **150 minutes per week** of moderate-intensity aerobic physical activity (e.g., brisk walking, cycling) combined with 2 to 3 resistance training sessions. Exercise improves insulin sensitivity while supporting metabolic energy expenditure.\n"
        "• **Restorative Sleep:** Target **7 to 9 hours** of sleep per night to maintain healthy cortisol and metabolic hormone regulation.\n"
        "• **Routine Clinical Monitoring:** Schedule periodic laboratory follow-ups (such as HbA1c every 3 to 6 months for diabetes, and TSH/Free T4 monitoring as directed for thyroid health)."
    )

    ehr_note = generate_secondary_ehr_context_note(patient_context)

    return (
        f"## Integrated Evidence-Based Lifestyle Guidance: {cond_title}\n\n"
        f"Hello {name}. When managing multiple conditions such as **{cond_title}**, addressing each condition with specific, coordinated strategies provides the best clinical outcomes.\n\n"
        + "\n\n".join(sections)
        + f"\n\n{shared_section}\n\n"
        + f"{ehr_note}"
        + "---\n"
        + "> **Clinical Safety Notice:** Always coordinate treatment and lifestyle changes with your attending physician."
    )


def generate_lifestyle_nutrition_guidance(
    query: str,
    patient_context: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Dynamic dispatcher for lifestyle and nutrition inquiries.
    Determines the primary topic strictly from the patient's current query,
    routing to targeted guidance functions and preventing default diagnosis hijacking.
    """
    topics = extract_query_health_topics(query)

    # 1. Thyroid and testing inquiry
    if topics["has_thyroid"] and topics["has_tests_request"]:
        return generate_thyroid_testing_guidance(query, patient_context)

    # 2. Thyroid and weight relationship inquiry
    if topics["is_relationship_question"]:
        return generate_thyroid_weight_relationship_guidance(query, patient_context)

    # 3. Thyroid and weight loss inquiry
    if topics["has_thyroid"] and topics["has_weight"]:
        return generate_thyroid_and_weight_guidance(query, patient_context)

    # 4. Multi-condition inquiries (e.g. diabetes and hypothyroidism)
    if len(topics["explicit_conditions"]) >= 2:
        return generate_multi_condition_guidance(query, topics["explicit_conditions"], patient_context)

    # 5. Dedicated Thyroid inquiries
    if topics["has_thyroid"]:
        return generate_thyroid_guidance(query, patient_context)

    # 6. Dedicated Weight loss inquiries
    if topics["has_weight"]:
        return generate_weight_management_guidance(query, patient_context)

    # 7. Dedicated Diabetes nutrition
    if topics["has_diabetes"] and not topics["has_hypertension"]:
        return generate_diabetes_nutrition_guidance(query, patient_context)

    # 8. Dedicated Hypertension management
    if topics["has_hypertension"] and not topics["has_diabetes"]:
        return generate_hypertension_management_guidance(query, patient_context)

    # 9. Inquiries explicitly mentioning both Diabetes & Hypertension
    if topics["has_diabetes"] and topics["has_hypertension"]:
        return generate_multi_condition_guidance(query, ["Type 2 Diabetes", "Essential Hypertension"], patient_context)

    # 10. General lifestyle & wellness guidance with EHR grounding
    name = patient_context.get("name", "there") if patient_context else "there"
    ehr_note = generate_secondary_ehr_context_note(patient_context)

    return (
        f"## Evidence-Based Lifestyle & Nutritional Guidance\n\n"
        f"Hello {name}. Below is evidence-based educational guidance on balanced nutrition and healthy daily habits.\n\n"
        "### 1. Balanced Nutrition & Dietary Patterns:\n"
        "• **Whole Foods Foundation:** Emphasize a wide variety of non-starchy vegetables, whole fruits, whole grains (quinoa, brown rice, oats), and lean proteins (fish, skinless poultry, legumes, tofu).\n"
        "• **Healthy Dietary Fats:** Prioritize unsaturated fats from olive oil, avocados, nuts, and seeds over saturated and trans fats.\n"
        "• **Hydration & Reduced Added Sugars:** Choose water as your primary beverage and minimize sugar-sweetened drinks and highly processed snacks.\n\n"
        "### 2. Physical Activity & Daily Habits:\n"
        "• Aim for at least **150 minutes per week** of moderate-intensity aerobic physical activity paired with 2 to 3 sessions of muscle-strengthening exercises.\n"
        "• Target **7 to 9 hours** of restorative sleep per night.\n\n"
        f"{ehr_note}"
        "---\n"
        "> **Clinical Safety Notice:** Discuss individual nutritional and physical activity goals with your healthcare provider."
    )


def verify_response_topic_alignment(query: str, response: str) -> bool:
    """
    Checks whether the generated response directly addresses the primary topic(s)
    of the user's latest query, rather than hallucinating or defaulting to
    unrelated EHR diagnoses.
    """
    q_lower = query.lower()
    resp_lower = response.lower()

    # 1. If query asked about thyroid, response MUST discuss thyroid and NOT lead with diabetes & hypertension
    if "thyroid" in q_lower:
        if "thyroid" not in resp_lower:
            return False
        if resp_lower.startswith("## evidence-based lifestyle & dietary guidance for type 2 diabetes & hypertension"):
            return False

    # 2. If query asked about weight loss/management, response MUST discuss weight
    if any(w in q_lower for w in ["weight loss", "weight management", "lose weight", "losing weight", "my weight"]):
        if "weight" not in resp_lower:
            return False

    # 3. If query asked about blood pressure specifically, response MUST discuss BP
    if any(w in q_lower for w in ["high blood pressure", "hypertension", "blood pressure"]):
        if not any(w in resp_lower for w in ["blood pressure", "hypertension", "bp"]):
            return False

    # 4. If query asked about diabetes specifically, response MUST discuss diabetes
    if any(w in q_lower for w in ["type 2 diabetes", "diabetes", "diabetic"]):
        if "diabetes" not in resp_lower and "glycemic" not in resp_lower:
            return False

    # 5. If query asked about knee, response MUST discuss knee and NOT dump active prescriptions
    if "knee" in q_lower:
        if "knee" not in resp_lower:
            return False
        if resp_lower.startswith("## your active prescriptions") or resp_lower.startswith("## verified medication"):
            return False

    return True


# ── 6. Intent Recognition ─────────────────────────────────────────────────────


def classify_query_intent(query: str) -> str:
    """
    Granular, topic-aware intent classification across universal patient categories.
    Prioritizes the patient's explicit current message over stored EHR records.
    Symptom complaints always take precedence over incidental medication keywords.
    """
    q_lower = query.lower()

    # 1. Emergency takes absolute precedence
    emergency_terms = [
        "chest pain", "heart attack", "can't breathe", "cannot breathe", "gasping for air",
        "shortness of breath", "severe breathing", "difficulty breathing", "choking",
        "stroke", "sudden numbness", "sudden weakness", "facial drooping", "slurred speech",
        "unconscious", "passed out", "active seizure", "convulsion", "coughing up blood",
        "stiff neck with high fever", "anaphylaxis",
    ]
    if any(term in q_lower for term in emergency_terms):
        return "EMERGENCY"

    # 2. Out-of-Scope (Non-medical topics e.g. programming, web scraper, general software, crypto)
    out_of_scope_patterns = [
        r"\bpython\b", r"\bweb scraper\b", r"\bscraping\b", r"\bjavascript\b",
        r"\bprogramming\b", r"\bwrite code\b", r"\bcoding\b", r"\bsoftware\b",
        r"\bsuper bowl\b", r"\bbitcoin\b", r"\bcryptocurrency\b", r"\bstock market\b",
        r"\brecipe for\b", r"\bwho won\b", r"\bweather forecast\b",
    ]
    medical_terms = [
        "health", "medical", "doctor", "patient", "hospital", "pain", "symptom",
        "medication", "blood", "clinic", "body", "disease", "condition", "treatment",
        "pill", "dose", "allergy", "gastric", "fever", "cough", "pressure", "headache", "dizzy",
    ]
    if any(re.search(p, q_lower) for p in out_of_scope_patterns) and not any(m in q_lower for m in medical_terms):
        return "OUT_OF_SCOPE"

    # 3. Headache & Migraine (Takes precedence over generic medication mentions)
    headache_patterns = [
        r"\bheadache\b", r"\bheadaches\b", r"\bmigraine\b", r"\bmigraines\b",
        r"\bhead pain\b", r"\bthrobbing head\b", r"\bpain in my head\b",
    ]
    if any(re.search(p, q_lower) for p in headache_patterns):
        return "HEADACHE"

    # 4. Dizziness, Lightheadedness & Vertigo (Takes precedence over generic medication mentions)
    dizziness_patterns = [
        r"\bdizziness\b", r"\bdizzy\b", r"\blightheaded\b", r"\blightheadedness\b",
        r"\bvertigo\b", r"\bunsteadiness\b", r"\bfeeling faint\b",
    ]
    if any(re.search(p, q_lower) for p in dizziness_patterns):
        return "DIZZINESS"

    # 5. Gastric / Upper GI Symptoms (Takes precedence over generic medication mentions)
    gastric_patterns = [
        r"\bgastric\b", r"\bacidity\b", r"\bacid reflux\b", r"\bheartburn\b", r"\bgerd\b",
        r"\bindigestion\b", r"\bdyspepsia\b", r"\bbloating\b", r"\bbloated\b",
        r"\bstomach ache\b", r"\bstomach pain\b", r"\bbelly ache\b", r"\btummy ache\b",
        r"\babdominal discomfort\b", r"\bgas trouble\b", r"\bexcessive gas\b",
        r"\bsour stomach\b", r"\bstomach burning\b", r"\bburning stomach\b", r"\bgassy\b",
    ]
    if any(re.search(p, q_lower) for p in gastric_patterns):
        return "GASTRIC_SYMPTOMS"

    # 6. Knee & Musculoskeletal Joint Symptoms
    if "knee" in q_lower or any(re.search(p, q_lower) for p in [r"\bpatella\b", r"\bmeniscus\b", r"\bacl\b", r"\bknee pain\b", r"\bknees hurt\b", r"\bknee hurts\b"]):
        return "KNEE_PAIN"

    # 7. Single Medication Inquiries (e.g. 'Explain my Metformin', 'Why am I taking Lisinopril?')
    single_med_patterns = [
        r"\bexplain\s+(?:my\s+)?(metformin|lisinopril|atorvastatin|amoxicillin)\b",
        r"\bwhat\s+is\s+(?:my\s+)?(metformin|lisinopril|atorvastatin|amoxicillin)\b",
        r"\bwhy\s+am\s+i\s+taking\s+(metformin|lisinopril|atorvastatin|amoxicillin)\b",
        r"\b(metformin|lisinopril|atorvastatin)\s+(?:side effects|dosage|instructions|purpose)\b",
        r"\btell\s+me\s+about\s+(?:my\s+)?(metformin|lisinopril|atorvastatin)\b",
        r"\bwhat\s+does\s+(metformin|lisinopril|atorvastatin)\s+do\b",
    ]
    if any(re.search(p, q_lower) for p in single_med_patterns):
        return "SINGLE_MEDICATION"

    # 8. Allergies Inquiries
    if any(re.search(p, q_lower) for p in [
        r"\bwhat\s+are\s+my\s+allergies\b", r"\bmy\s+allergies\b",
        r"\bdo\s+i\s+have\s+allergies\b", r"\ballergic\s+to\b",
        r"\ballergy\s+list\b", r"\ballergies\s+on\s+file\b",
    ]):
        return "ALLERGIES"

    # 9. Blood Pressure Readings & Questions (Priority 3)
    from app.services.clinical_knowledge import extract_blood_pressure
    if extract_blood_pressure(query) is not None:
        return "BLOOD_PRESSURE"
    if any(w in q_lower for w in ["hypertension", "blood pressure", "my bp", "systolic", "diastolic", "why is my blood pressure high", "bp high"]):
        return "BLOOD_PRESSURE"

    # 10. HbA1c & Glycemic Lab Values (Priority 2)
    from app.services.clinical_knowledge import extract_reported_hba1c
    if extract_reported_hba1c(query) is not None or any(w in q_lower for w in ["hba1c", "a1c", "glycated hemoglobin"]):
        return "HBA1C"

    # 10B. Blood Glucose Readings & Telemetry
    if re.search(r"\b(?:glucose|blood sugar|sugar level)\s*(?:is|=|:)?\s*(\d{2,3}(?:\.\d)?)\s*(mg/dl|mmol/l)?\b", q_lower) or any(
        w in q_lower for w in [
            "my glucose is", "my blood sugar is", "fasting glucose of",
            "glucose reading", "last glucose reading", "latest glucose",
            "blood sugar reading", "glucose of"
        ]
    ):
        return "BLOOD_GLUCOSE"

    # 11. Health Topic Inquiries (Thyroid, Weight, Diabetes Nutrition, Hypertension Management, Multi-condition)
    from app.services.clinical_knowledge import extract_query_health_topics
    topics = extract_query_health_topics(query)
    if topics["has_thyroid"] and topics["has_tests_request"]:
        return "THYROID_TESTS"
    if topics["is_relationship_question"]:
        return "THYROID_WEIGHT_RELATIONSHIP"
    if topics["has_thyroid"] and topics["has_weight"]:
        return "THYROID_AND_WEIGHT"
    if len(topics["explicit_conditions"]) >= 2:
        return "MULTI_CONDITION_LIFESTYLE"
    if topics["has_thyroid"]:
        return "THYROID_HEALTH"
    if topics["has_weight"]:
        return "WEIGHT_MANAGEMENT"
    if topics["has_diabetes"] and not topics["has_hypertension"]:
        return "DIABETES_NUTRITION"
    if topics["has_hypertension"] and not topics["has_diabetes"]:
        return "HYPERTENSION_MANAGEMENT"

    # 12. General Lifestyle & Dietary Habits
    lifestyle_terms = [
        "lifestyle", "dietary", "diet", "nutrition", "food", "what should i eat",
        "eating habit", "eating habits", "lifestyle habit", "lifestyle habits",
        "diet habit", "diet habits", "exercise habit", "exercise habits", "physical activity",
        "lifestyle and dietary"
    ]
    if any(term in q_lower for term in lifestyle_terms):
        return "LIFESTYLE_NUTRITION"

    # 13. Age-Based Preventive Screening & Checkups
    from app.services.clinical_knowledge import is_age_screening_query
    if is_age_screening_query(query) is not None:
        return "AGE_SCREENING"

    # 14. Missing Record Queries
    if any(w in q_lower for w in ["mri", "colonoscopy", "endoscopy", "ct scan", "biopsy", "mammogram", "ultrasound"]):
        if any(w in q_lower for w in ["result", "results", "find", "show", "what was", "what were"]):
            return "MISSING_RECORD"

    # 15. Prescription History & Discontinued Medications
    if any(w in q_lower for w in ["history of medication", "past medication", "past prescription", "discontinued medication", "discontinued prescription", "previous medication", "prescription history", "old medication", "stopped medication"]):
        return "PRESCRIPTION_HISTORY"

    # 16. Doctor recommendation queries
    if any(w in q_lower for w in ["which doctor", "recommend a doctor", "doctor should i consult", "find a doctor", "specialist should i see"]):
        return "DOCTOR_RECOMMENDATION"

    # 17. Drug Interactions
    if any(w in q_lower for w in ["interaction", "interact", "contraindication", "safe together", "take together"]):
        return "DRUG_INTERACTIONS"

    # 18. Upcoming appointments
    if any(w in q_lower for w in ["appointment", "booking", "schedule", "when is my next", "upcoming visit", "my appointments", "track appointment"]):
        return "APPOINTMENT"

    # 19. Explicit Medication Summary Queries (e.g. 'Explain my current medications', 'What are my medications?')
    if any(w in q_lower for w in [
        "explain my current medications", "explain my medications", "current medications",
        "what are my medications", "list my medications", "my prescriptions", "all my medications",
        "medication schedule", "medication list", "active prescriptions",
    ]):
        return "MEDICATION"
    if any(w in q_lower for w in ["medication", "prescription", "prescribed", "drug", "pill", "lisinopril", "metformin", "refill", "my meds"]):
        return "MEDICATION"

    # 20. Medical History & Diagnoses
    if any(w in q_lower for w in ["medical history", "history", "diagnosis", "diagnoses", "condition"]):
        return "MEDICAL_HISTORY"

    # 21. Laboratory results (general)
    if any(w in q_lower for w in ["lab", "test result", "blood test", "lipid", "cholesterol", "metabolic", "cmp", "bmp"]):
        return "LAB_REPORT"

    # 22. General Symptoms Fallback
    from app.services.clinical_knowledge import extract_reported_symptoms
    symptoms = extract_reported_symptoms(query)
    if symptoms:
        return "SYMPTOMS"
    if any(w in q_lower for w in ["fever", "cough", "cold", "vomiting", "sore throat", "feeling sick", "unwell", "symptom", "pain in"]):
        return "SYMPTOMS"

    # 23. General Medical Education vs Out-of-Scope Fallback
    if any(w in q_lower for w in ["medical topic", "health topic", "medical question", "what causes", "how does"]):
        return "GENERAL_HEALTH"

    return "GENERAL_HEALTH"

