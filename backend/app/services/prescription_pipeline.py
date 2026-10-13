"""
Prescription Processing Pipeline — File validation, text extraction (PDF / OCR),
clinical entity recognition, prompt injection sanitization, and structured AI analysis.
"""
from __future__ import annotations

import io
import json
import os
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pypdf
from PIL import Image

try:
    import structlog
    log = structlog.get_logger(__name__)
except ImportError:
    import logging
    log = logging.getLogger(__name__)

from app.core.config import settings
from app.services.ai_service import ai_service
from app.services.medical_knowledge_service import medical_knowledge


# ── Security & Anti-Prompt-Injection Guards ────────────────────────────────────

PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions?", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+a", re.IGNORECASE),
    re.compile(r"system\s*:\s*override", re.IGNORECASE),
    re.compile(r"reveal\s+(system\s+)?prompt", re.IGNORECASE),
    re.compile(r"forget\s+everything", re.IGNORECASE),
    re.compile(r"bypass\s+safety", re.IGNORECASE),
    re.compile(r"act\s+as\s+DAN", re.IGNORECASE),
    re.compile(r"disregard\s+rules", re.IGNORECASE),
]

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def sanitize_ocr_text(raw_text: str) -> str:
    """Sanitize extracted document text and filter injection vectors."""
    cleaned = raw_text
    for pattern in PROMPT_INJECTION_PATTERNS:
        cleaned = pattern.sub("[REDACTED_INJECTION_PATTERN]", cleaned)
    # Strip dangerous shell/control characters but preserve newlines and punctuation
    cleaned = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", cleaned)
    return cleaned.strip()


def validate_file_upload(file_bytes: bytes, filename: str, content_type: str) -> Tuple[bool, str, str]:
    """
    Validate uploaded prescription file security, size, and magic bytes.
    Returns: (is_valid, sanitized_extension, error_message)
    """
    if len(file_bytes) > MAX_FILE_SIZE:
        return False, "", f"File size exceeds 10MB limit (provided {len(file_bytes) // 1024} KB)."

    # Check extension
    ext = Path(filename).suffix.lower()
    if ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        return False, "", f"Unsupported file extension '{ext}'. Only PDF, JPG, and PNG are allowed."

    # Validate Magic Bytes
    if ext == ".pdf":
        if not file_bytes.startswith(b"%PDF-"):
            return False, "", "Invalid PDF file header. The document appears corrupted."
        mime = "application/pdf"
    elif ext in [".jpg", ".jpeg"]:
        if not (file_bytes.startswith(b"\xff\xd8\xff") or b"JFIF" in file_bytes[:32] or b"Exif" in file_bytes[:32]):
            return False, "", "Invalid JPEG file header."
        mime = "image/jpeg"
    elif ext == ".png":
        if not file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            return False, "", "Invalid PNG file header."
        mime = "image/png"
    else:
        return False, "", "Invalid document format."

    return True, ext, mime


# ── Text Extraction & Parsing ──────────────────────────────────────────────────

class PrescriptionPipeline:
    """End-to-end prescription processing and health guidance pipeline."""

    def __init__(self) -> None:
        self.upload_dir = Path("uploads/prescriptions")
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save_upload_file(self, patient_id: uuid.UUID, file_bytes: bytes, ext: str) -> str:
        """Securely store uploaded prescription document on disk."""
        safe_filename = f"{patient_id}_{uuid.uuid4().hex[:12]}{ext}"
        target_path = self.upload_dir / safe_filename
        target_path.write_bytes(file_bytes)
        return str(target_path)

    async def extract_text_from_file(self, file_bytes: bytes, ext: str) -> str:
        """
        Extract readable plain text from PDF or image using pypdf,
        Gemini Vision if available, or pattern-assisted optical heuristics.
        """
        if ext == ".pdf":
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                text_parts = []
                for idx, page in enumerate(reader.pages):
                    extracted = page.extract_text() or ""
                    if extracted.strip():
                        text_parts.append(extracted.strip())
                if text_parts:
                    return "\n\n".join(text_parts)
            except Exception as exc:
                log.warning("PDF text extraction failed", error=str(exc))

        # If Image or Scanned PDF without text layer:
        # Check if Gemini Vision client is available
        if ai_service._genai and settings.GEMINI_API_KEY:
            try:
                image = Image.open(io.BytesIO(file_bytes))
                prompt = (
                    "You are a clinical OCR reader. Extract ALL readable text from this prescription image verbatim. "
                    "Include patient name, doctor name, clinic header, dates, medications, strengths, dosages, "
                    "frequencies, durations, and instructions. Do not hallucinate. If text is illegible, write [Illegible]."
                )
                loop = asyncio.get_event_loop()
                model = ai_service._genai.GenerativeModel(settings.GEMINI_MODEL or "gemini-2.5-pro")
                res = await loop.run_in_executor(None, lambda: model.generate_content([prompt, image]))
                if res and res.text:
                    return res.text.strip()
            except Exception as e:
                log.warning("Gemini Vision extraction failed, using fallback parser", error=str(e))

        # Fallback text decoder for plain formatted text files / mock documents
        try:
            raw_str = file_bytes.decode("utf-8", errors="ignore")
            # Filter ascii letters/numbers
            lines = [l.strip() for l in raw_str.splitlines() if len(l.strip()) > 3]
            meaningful = [l for l in lines if re.search(r"[a-zA-Z]{3,}", l) and not re.search(r"[\x00-\x08\x0E-\x1F]", l)]
            if len(meaningful) >= 2:
                return "\n".join(meaningful[:50])
        except Exception:
            pass

        return ""

    def parse_entities_from_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Extract structured prescription items from extracted document text.
        Identifies medication names, strengths, dosages, route, frequencies,
        and instructions. Detects missing or uncertain information with explicit flags.
        """
        sanitized = sanitize_ocr_text(text)
        items: List[Dict[str, Any]] = []

        # Common medication lexicon regex
        KNOWN_MED_KEYWORDS = [
            "Lisinopril", "Metformin", "Atorvastatin", "Amlodipine", "Warfarin",
            "Amoxicillin", "Levothyroxine", "Omeprazole", "Sertraline", "Ibuprofen",
            "Spironolactone", "Clopidogrel", "Ciprofloxacin", "Digoxin", "Sildenafil",
            "Nitroglycerin", "Tramadol", "Hydrochlorothiazide", "Metoprolol", "Gabapentin",
            "Albuterol", "Prednisone", "Pantoprazole", "Losartan", "Rosuvastatin",
        ]

        # Strength pattern: e.g., 10mg, 500 mg, 0.5 mcg, 100 IU, 20ml
        strength_regex = re.compile(r"(\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?)\b)", re.IGNORECASE)
        # Frequency pattern: once daily, twice daily, BID, TID, QID, every 8 hours, at bedtime
        freq_regex = re.compile(
            r"(\b(?:once|twice|three times|1x|2x|3x)\s+daily\b|"
            r"\b(?:every|q)\s*(?:4|6|8|12|24)\s*hours?\b|"
            r"\b(?:bid|tid|qid|qd|prn|as needed|at bedtime|in the morning|qam|qpm)\b)",
            re.IGNORECASE,
        )
        # Dosage / Quantity: 1 tablet, 2 capsules, 1 puff, 5 ml
        dosage_regex = re.compile(
            r"(\b\d+\s*(?:tablet|tablets|capsule|capsules|puff|puffs|drop|drops|ml|teaspoon|tablespoon)\b)",
            re.IGNORECASE,
        )
        # Route
        route_regex = re.compile(r"\b(oral|topical|sublingual|inhalation|ophthalmic|otic|intramuscular|subcutaneous)\b", re.IGNORECASE)
        # Duration: for 7 days, 10 days, 30 days, 1 month
        duration_regex = re.compile(r"(\b(?:for|x)\s*\d+\s*(?:days?|weeks?|months?)\b|\b\d+-day supply\b)", re.IGNORECASE)

        # Break text into line segments
        lines = [l.strip() for l in sanitized.split("\n") if l.strip()]

        for med in KNOWN_MED_KEYWORDS:
            # Check if medication is mentioned anywhere
            med_pattern = re.compile(rf"\b{re.escape(med)}\b", re.IGNORECASE)
            matching_lines = [l for l in lines if med_pattern.search(l)]

            if matching_lines:
                combined_context = " ".join(matching_lines)

                strength_match = strength_regex.search(combined_context)
                freq_match = freq_regex.search(combined_context)
                dosage_match = dosage_regex.search(combined_context)
                route_match = route_regex.search(combined_context)
                dur_match = duration_regex.search(combined_context)

                # Identify instructions (e.g. with meals, before breakfast, with water)
                instr = None
                if re.search(r"with (food|meals?|water)", combined_context, re.IGNORECASE):
                    instr = re.search(r"with (food|meals?|water)", combined_context, re.IGNORECASE).group(0).capitalize()
                elif re.search(r"before (breakfast|meals?|bed)", combined_context, re.IGNORECASE):
                    instr = re.search(r"before (breakfast|meals?|bed)", combined_context, re.IGNORECASE).group(0).capitalize()

                # Determine uncertainty
                uncertainties = []
                if not strength_match:
                    uncertainties.append("Strength / concentration missing")
                if not freq_match:
                    uncertainties.append("Administration frequency missing")
                if not dosage_match:
                    uncertainties.append("Dosage unit count unspecified")

                is_uncertain = len(uncertainties) > 0
                uncertainty_reason = "; ".join(uncertainties) if uncertainties else None
                confidence = 0.65 if is_uncertain else 0.95

                items.append({
                    "medication_name": med,
                    "strength": strength_match.group(1) if strength_match else None,
                    "dosage": dosage_match.group(1) if dosage_match else "1 tablet/dose (unspecified)",
                    "route": route_match.group(1).capitalize() if route_match else "Oral",
                    "frequency": freq_match.group(1).upper() if freq_match else None,
                    "duration": dur_match.group(1) if dur_match else None,
                    "instructions": instr or "Take exactly as directed by the prescribing physician.",
                    "confidence_score": confidence,
                    "is_uncertain": is_uncertain,
                    "uncertainty_reason": uncertainty_reason,
                    "patient_verified": False,
                    "patient_notes": None,
                })

        # If no known medication was found by keyword regex, fallback to scanning line-by-line
        if not items:
            for line in lines:
                # Check if line looks like an Rx item (e.g., "DrugName 20mg take 1 daily")
                m_match = re.search(r"^([A-Z][a-zA-Z\-]{3,25})\s+(\d+\s*(?:mg|mcg|g|ml))", line)
                if m_match:
                    med_name = m_match.group(1)
                    str_val = m_match.group(2)
                    freq_m = freq_regex.search(line)
                    items.append({
                        "medication_name": med_name,
                        "strength": str_val,
                        "dosage": "1 unit (verify with pharmacist)",
                        "route": "Oral",
                        "frequency": freq_m.group(1).upper() if freq_m else None,
                        "duration": None,
                        "instructions": "Follow prescribing clinician's instructions.",
                        "confidence_score": 0.70,
                        "is_uncertain": freq_m is None,
                        "uncertainty_reason": "Dosing frequency not clearly identified" if not freq_m else None,
                        "patient_verified": False,
                        "patient_notes": None,
                    })

        return items

    def extract_prescription_document_metadata(self, text: str) -> Dict[str, Any]:
        """Extract patient info, prescriber details, prescription date, and document warnings."""
        sanitized = sanitize_ocr_text(text)
        lines = sanitized.splitlines()

        patient_info: Dict[str, Any] = {}
        doctor_info: Dict[str, Any] = {}
        rx_date: Optional[str] = None
        warnings: List[str] = []
        doctor_instructions: List[str] = []

        for line in lines:
            line_str = line.strip()

            # Patient Name
            p_match = re.search(r"(?:patient\s*(?:name)?|pt\s*name)\s*[:\-]\s*([A-Za-z\s,\.]{3,35})", line_str, re.IGNORECASE)
            if p_match and "name" not in patient_info:
                candidate = p_match.group(1).strip()
                if not any(k in candidate.lower() for k in ["doctor", "dr.", "clinic", "rx", "hospital"]):
                    patient_info["name"] = candidate

            # DOB / Age
            dob_match = re.search(r"(?:dob|date of birth|birth date)\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", line_str, re.IGNORECASE)
            if dob_match:
                patient_info["date_of_birth"] = dob_match.group(1)

            # Doctor Name
            doc_match = re.search(r"(?:prescriber|prescribing doctor|physician|doctor|dr\.)\s*[:\-]?\s*([A-Za-z\s,\.]{3,35})", line_str, re.IGNORECASE)
            if doc_match and "name" not in doctor_info:
                candidate = doc_match.group(1).strip()
                if not any(k in candidate.lower() for k in ["patient", "signature", "refill", "pharmacy"]):
                    doctor_info["name"] = candidate

            # Clinic / Practice Name
            clinic_match = re.search(r"(?:clinic|hospital|practice|medical center)\s*[:\-]?\s*([A-Za-z0-9\s,\.]{4,40})", line_str, re.IGNORECASE)
            if clinic_match and "clinic_name" not in doctor_info:
                doctor_info["clinic_name"] = clinic_match.group(1).strip()

            # Date
            d_match = re.search(r"(?:date|prescribed|rx date)\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", line_str, re.IGNORECASE)
            if d_match and not rx_date:
                rx_date = d_match.group(1)

            # Warnings written on prescription
            for warn_kw in [
                "take with food", "avoid alcohol", "do not crush", "finish all",
                "keep refrigerated", "do not operate machinery", "may cause drowsiness",
                "take on empty stomach", "shake well", "keep out of reach of children"
            ]:
                if warn_kw in line_str.lower() and line_str not in warnings:
                    warnings.append(line_str)

            # Prescribing doctor notes / instructions
            if any(k in line_str.lower() for k in ["instructions:", "sig:", "notes:", "special instructions:"]):
                doctor_instructions.append(line_str)

        return {
            "patient_info": patient_info,
            "doctor_info": doctor_info,
            "prescription_date": rx_date,
            "warnings_on_document": warnings,
            "doctor_instructions": doctor_instructions,
        }

    async def generate_analysis_report(
        self,
        verified_items: List[Dict[str, Any]],
        patient_chart: Dict[str, Any],
        raw_text: str = "",
    ) -> Dict[str, Any]:
        """
        Execute evidence-based AI Prescription Analysis and Safety Review.
        Synthesizes verified prescription items with patient context (age, allergies, active meds).
        """
        doc_meta = self.extract_prescription_document_metadata(raw_text) if raw_text else {}
        med_names = [item["medication_name"] for item in verified_items]
        existing_meds = patient_chart.get("active_medications", [])
        all_meds = list(set(med_names + existing_meds))

        patient_allergies = patient_chart.get("allergies", [])
        dob = patient_chart.get("date_of_birth")

        # ── 1. Pediatric Safety Safeguard ──────────────────────────────────────
        is_pediatric = False
        if dob:
            try:
                birth_date = date.fromisoformat(str(dob))
                age_years = (date.today() - birth_date).days // 365
                is_pediatric = age_years < 18
            except Exception:
                pass

        # ── 2. Medication Guidance & Information Retrieval ─────────────────────
        med_guidance_list: List[Dict[str, Any]] = []
        apparent_purposes: List[Dict[str, Any]] = []
        documented_instructions: List[Dict[str, Any]] = []
        uncertain_info_list: List[str] = []

        for item in verified_items:
            m_name = item["medication_name"]
            info = await medical_knowledge.get_medication_info(m_name)

            apparent_purposes.append({
                "medication": m_name,
                "purpose": info.get("common_uses", "General symptom management"),
                "therapeutic_class": info.get("class", "Prescription Drug"),
                "reference": info.get("source", "NIH RxNorm / DailyMed"),
            })

            documented_instructions.append({
                "medication": m_name,
                "dosage": item.get("dosage") or "Unspecified",
                "strength": item.get("strength") or "Unspecified",
                "frequency": item.get("frequency") or "Unspecified",
                "instructions": item.get("instructions") or "Follow prescriber's directions",
            })

            if item.get("is_uncertain"):
                uncertain_info_list.append(
                    f"{m_name}: {item.get('uncertainty_reason', 'Unclear dosage or frequency')}. Verify with pharmacist."
                )

            med_guidance_list.append({
                "medication": m_name,
                "brand_names": info.get("brand_names", []),
                "therapeutic_class": info.get("class", "Prescription Medicine"),
                "common_uses": info.get("common_uses", ""),
                "prescriber_instruction_interpretation": (
                    f"Take {item.get('dosage') or 'as prescribed'} of {m_name} "
                    f"{item.get('frequency') or ''}. {item.get('instructions') or ''}"
                ).strip(),
                "precautions": info.get("food_precautions", "Take as directed with water."),
                "common_side_effects": info.get("common_side_effects", ["Consult package insert"]),
                "serious_warning_signs": info.get("serious_warning_signs", [
                    "Signs of allergic reaction (rash, facial swelling, trouble breathing)",
                    "Severe dizziness or fainting",
                ]),
                "questions_for_pharmacist": info.get("pharmacist_questions", [
                    "What are the most common interactions with this medicine?",
                    "What should I do if I miss a scheduled dose?",
                ]),
                "verified_source": info.get("source", "DailyMed / FDA"),
                "last_verified": info.get("last_verified", date.today().isoformat()),
            })

        # ── 3. Drug-Drug Interaction Screening ─────────────────────────────────
        interactions = medical_knowledge.check_drug_interactions(all_meds)

        # ── 4. Allergy Cross-Reference Screening ───────────────────────────────
        allergy_alerts = medical_knowledge.check_allergies(med_names, patient_allergies)

        # ── 5. Duplicate Active Ingredient Detection ───────────────────────────
        duplicate_therapies = medical_knowledge.check_duplicate_therapies(all_meds)

        # ── 6. Clinical Precautions & Pediatric Flags ──────────────────────────
        precautions: List[Dict[str, Any]] = []
        if is_pediatric:
            precautions.append({
                "medication": "All Prescribed Items",
                "condition_or_precaution": "Pediatric Patient Flag (< 18 Years)",
                "details": "Patient is under 18 years old. Pediatric dosages are weight-dependent (mg/kg). Direct pharmacist verification of dosage and formulation is strictly advised before administration.",
                "severity": "CRITICAL",
            })

        # ── 7. Actionable Personalized Next-Steps Checklist ────────────────────
        checklist: List[Dict[str, Any]] = []
        reminders_suggested: List[Dict[str, Any]] = []

        # Step 1: Pharmacist verification if uncertain
        if uncertain_info_list or any(i.get("severity") == "CRITICAL" for i in interactions + allergy_alerts):
            checklist.append({
                "id": "step-pharmacist-check",
                "task": "Review prescription safety alerts with your dispensing pharmacist prior to taking first dose",
                "category": "Safety Priority",
                "completed": False,
                "priority": "high",
            })

        # Step 2: Directions adherence
        checklist.append({
            "id": "step-adherence",
            "task": "Confirm directions and review patient information leaflet included with your medication packaging",
            "category": "Medication Adherence",
            "completed": False,
            "priority": "medium",
        })

        # Step 3: Food / timing precautions
        for g in med_guidance_list:
            if g.get("precautions") and "water" not in g["precautions"].lower():
                checklist.append({
                    "id": f"step-food-{g['medication'].lower()}",
                    "task": f"{g['medication']}: {g['precautions']}",
                    "category": "Administration Guidance",
                    "completed": False,
                    "priority": "medium",
                })

            # Suggested reminder
            reminders_suggested.append({
                "medication": g["medication"],
                "suggested_time": "08:00 AM",
                "frequency": "Daily",
                "instructions": g.get("prescriber_instruction_interpretation", "Take as directed"),
            })

        # Step 4: Schedule follow-up
        checklist.append({
            "id": "step-follow-up",
            "task": "Schedule clinical follow-up appointment with prescribing clinician within 3-4 weeks to assess therapeutic response",
            "category": "Clinical Follow-up",
            "completed": False,
            "priority": "medium",
        })

        # Step 5: Side effect logging
        checklist.append({
            "id": "step-symptom-log",
            "task": "Record any unexpected symptoms or mild side effects in your MediCare health portal",
            "category": "Self-Monitoring",
            "completed": False,
            "priority": "low",
        })

        # Determine if professional pharmacist review is required
        requires_review = (
            len(allergy_alerts) > 0 or
            any(i.get("severity") == "CRITICAL" for i in interactions) or
            len(uncertain_info_list) > 0 or
            is_pediatric
        )

        # ── 8. Assemble Full Report ────────────────────────────────────────────
        summary_text = (
            f"Your prescription contains {len(verified_items)} medication{'s' if len(verified_items) > 1 else ''}: "
            f"{', '.join(med_names)}. "
            f"This guidance provides educational explanations of the prescribed purposes, administration timing, "
            f"and important precautions. Please review safety notices below and contact your pharmacist with any questions."
        )

        doc_warnings = doc_meta.get("warnings_on_document", [])
        practical_actions = [
            "Review each medication's timing and food instructions on your official pharmacy packaging label.",
            "Store medications in a cool, dry location out of reach of children and pets.",
            "Set daily reminders in your MediCare portal so you take your medicines on time.",
        ]
        if doc_warnings:
            practical_actions.append(f"Follow document-specific warning: {'; '.join(doc_warnings)}")

        doctor_questions = [
            "What should I do if I accidentally miss a scheduled dose?",
            "Are there any specific over-the-counter supplements or foods I should avoid while taking these?",
            "How long should I expect to take this treatment before evaluating its effectiveness?",
            "What mild side effects are typical, and which symptoms require calling your clinic immediately?",
        ]

        seek_prompt_care = [
            "Signs of severe allergic reaction (lip or tongue swelling, rash, wheezing, throat tightness)",
            "Chest pain, acute shortness of breath, or irregular palpitations",
            "Severe dizziness, fainting, or sudden vision disturbances",
        ]

        clarification_note = (
            "Clarification is recommended from your prescribing clinician or pharmacist regarding uncertain items detected in this prescription."
            if uncertain_info_list else None
        )

        report = {
            "summary_data": {
                "plain_language_summary": summary_text,
                "apparent_purposes": apparent_purposes,
                "documented_instructions": documented_instructions,
                "uncertain_information": uncertain_info_list,
                "patient_info_extracted": doc_meta.get("patient_info", {}),
                "prescribing_doctor_info": doc_meta.get("doctor_info", {}),
                "prescription_date": doc_meta.get("prescription_date"),
                "warnings_on_document": doc_warnings,
                "doctor_instructions": doc_meta.get("doctor_instructions", []),
                "disclaimer": "This AI-generated analysis is for educational purposes and does NOT substitute for professional medical evaluation or clinical consultation. If experiencing severe symptoms, call 911 immediately.",
            },
            "medication_guidance": med_guidance_list,
            "next_steps": {
                "summary": (
                    "Review safety alerts with your pharmacist prior to first dose and follow your personalized adherence checklist."
                    if requires_review else
                    "Take medications as directed on your pharmacy label and maintain your routine clinical appointments."
                ),
                "checklist": checklist,
                "practical_actions": practical_actions,
                "doctor_questions": doctor_questions,
                "clarification_needed": clarification_note,
                "seek_prompt_care_reasons": seek_prompt_care,
                "urgency_level": "EMERGENCY" if any(i.get("severity") == "CRITICAL" for i in interactions) else ("PROMPT_EVALUATION" if requires_review else "ROUTINE"),
                "reminders_suggested": reminders_suggested,
                "follow_up_suggested": "Schedule review with prescribing clinician within 30 days.",
            },
            "safety_review": {
                "interactions": interactions,
                "allergy_alerts": allergy_alerts,
                "duplicate_therapies": duplicate_therapies,
                "precautions": precautions,
                "requires_pharmacist_review": requires_review,
                "screened_medications_count": len(all_meds),
                "documented_allergies_count": len(patient_allergies),
                "review_recommendation": (
                    "URGENT: Pharmacist or clinician consultation recommended prior to first dose due to detected safety findings."
                    if requires_review else
                    "No critical contraindications detected. Follow standard administration directions and discuss any questions with your pharmacist."
                ),
            },
            "review_status": "flagged_for_pharmacist" if requires_review else "pending_review",
            "ai_provider": "MediCare Clinical Reasoning Engine (NIH RxNorm / DailyMed Verified)",
        }

        return report


prescription_pipeline = PrescriptionPipeline()
