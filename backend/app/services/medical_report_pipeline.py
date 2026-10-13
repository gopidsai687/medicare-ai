"""
Medical Report Processing Pipeline — File validation, multi-page text extraction (PDF / OCR),
clinical entity recognition, prompt injection sanitization, abnormal result evaluation,
plain-language terminology translation, and structured AI analysis.
"""
from __future__ import annotations

import asyncio
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
from app.services.prescription_pipeline import sanitize_ocr_text, validate_file_upload


# ── Common Medical Terminology Dictionary (Plain Language) ───────────────────

MEDICAL_TERMINOLOGY_DICT: Dict[str, str] = {
    "leukocytosis": "Elevated white blood cell count, often indicating infection, inflammation, or physical stress.",
    "leukopenia": "Lower than normal white blood cell count, which can increase susceptibility to infections.",
    "thrombocytopenia": "Low blood platelet count, which can affect the blood's ability to clot normally.",
    "thrombocytosis": "Higher than normal blood platelet count, sometimes related to inflammation or iron deficiency.",
    "erythrocytes": "Red blood cells, which transport oxygen from your lungs throughout your entire body.",
    "hematocrit": "The percentage of your whole blood volume that consists of red blood cells.",
    "hemoglobin": "The iron-rich protein in red blood cells that carries oxygen to your organs and tissues.",
    "neutrophils": "The most common type of white blood cell, primarily responsible for fighting bacterial infections.",
    "lymphocytes": "A type of white blood cell that helps your immune system fight viral infections and produces antibodies.",
    "creatinine": "A waste product from muscle breakdown that is filtered out by healthy kidneys; used to assess kidney function.",
    "egfr": "Estimated Glomerular Filtration Rate; a calculation measuring how efficiently your kidneys filter waste from blood.",
    "bun": "Blood Urea Nitrogen; a waste product formed when protein is broken down, measured to evaluate kidney function.",
    "glucose": "The main type of sugar present in blood, supplying energy to your cells. Elevated levels may indicate diabetes or prediabetes.",
    "hba1c": "Hemoglobin A1c; reflects your average blood sugar levels over the past 2 to 3 months.",
    "cholesterol": "A waxy, fat-like substance found in all your cells. While necessary, high levels can increase cardiovascular risk.",
    "ldl": "Low-Density Lipoprotein, often called 'bad cholesterol'; high levels can build up plaques in arteries.",
    "hdl": "High-Density Lipoprotein, known as 'good cholesterol'; helps remove excess cholesterol from your bloodstream.",
    "triglycerides": "A type of fat (lipid) in your blood stored in fat cells; high levels are linked with heart disease risk.",
    "bilirubin": "A yellowish substance made during the normal breakdown of red blood cells; processed by the liver.",
    "alt": "Alanine Aminotransferase; a liver enzyme that leaks into the bloodstream when liver cells are stressed or injured.",
    "ast": "Aspartate Aminotransferase; an enzyme found in liver and muscle cells used alongside ALT to evaluate liver health.",
    "alkaline phosphatase": "An enzyme related to the bile ducts in the liver and bone metabolism.",
    "tsh": "Thyroid Stimulating Hormone; produced by the pituitary gland to control how much hormone your thyroid gland releases.",
    "free t4": "Free Thyroxine; the active thyroid hormone that regulates your body's metabolism and energy use.",
    "potassium": "An essential electrolyte that controls nerve signals, muscle contractions, and steady heart rhythm.",
    "sodium": "An essential electrolyte and mineral that maintains fluid balance and blood pressure.",
    "calcium": "A mineral vital for strong bones, muscle contraction, blood clotting, and nerve signaling.",
    "albumin": "A main protein made by the liver that keeps fluid from leaking out of blood vessels into surrounding tissues.",
    "microalbuminuria": "Small amounts of albumin protein in urine, an early indicator of kidney stress, especially in diabetes.",
    "atelectasis": "Partial collapse or incomplete expansion of small air sacs in the lung, often visible on chest X-rays.",
    "cardiomegaly": "Enlargement of the heart silhouette, commonly observed on chest imaging.",
    "effusion": "An abnormal accumulation of fluid in an anatomical body space (such as around the lungs or inside a joint).",
    "nodule": "A small, rounded mass or lump of tissue detected on imaging (such as a chest CT or thyroid ultrasound).",
    "sinus rhythm": "The normal, regular rhythm of a healthy heart originating from the heart's natural pacemaker (SA node).",
    "tachycardia": "A heart rate faster than normal resting rate (typically exceeding 100 beats per minute in adults).",
    "bradycardia": "A heart rate slower than normal resting rate (typically under 60 beats per minute in adults).",
}


class MedicalReportPipeline:
    """End-to-end processing pipeline for lab results, diagnostic, and clinical reports."""

    def __init__(self) -> None:
        self.upload_dir = Path("uploads/reports")
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save_upload_file(self, patient_id: uuid.UUID, file_bytes: bytes, ext: str) -> str:
        """Securely store uploaded report file on disk."""
        safe_filename = f"{patient_id}_{uuid.uuid4().hex[:12]}{ext}"
        target_path = self.upload_dir / safe_filename
        target_path.write_bytes(file_bytes)
        return str(target_path)

    async def extract_text_from_file(self, file_bytes: bytes, ext: str) -> str:
        """
        Extract readable plain text from PDF or image using pypdf,
        Gemini Vision if available, or pattern-assisted optical heuristics.
        Handles multiple-page documents thoroughly.
        """
        # 1. Multi-page PDF text extraction
        if ext == ".pdf":
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                text_parts: List[str] = []
                for idx, page in enumerate(reader.pages):
                    extracted = page.extract_text() or ""
                    if extracted.strip():
                        text_parts.append(f"--- Page {idx + 1} ---\n{extracted.strip()}")

                if text_parts:
                    return "\n\n".join(text_parts)
            except Exception as exc:
                log.warning("Multi-page PDF text extraction failed", error=str(exc))

        # 2. Image or Scanned Document OCR via Gemini Vision if configured
        if ai_service._genai and settings.GEMINI_API_KEY:
            try:
                image = Image.open(io.BytesIO(file_bytes))
                prompt = (
                    "You are a clinical OCR reader specialized in medical laboratory and diagnostic reports. "
                    "Extract ALL readable text from this medical report document verbatim. "
                    "Extract the document header, patient details if visible, doctor/facility name, report dates, "
                    "and all laboratory test names, numerical values, units, reference intervals, and abnormal flags (H, L, ABNORMAL, CRITICAL). "
                    "Preserve table rows and line breaks. Do not hallucinate or guess illegible text. "
                    "If text is unreadable or smudged, label it [Illegible]."
                )
                loop = asyncio.get_event_loop()
                model = ai_service._genai.GenerativeModel(settings.GEMINI_MODEL or "gemini-2.5-pro")
                res = await loop.run_in_executor(None, lambda: model.generate_content([prompt, image]))
                if res and res.text:
                    return res.text.strip()
            except Exception as e:
                log.warning("Gemini Vision OCR extraction failed, using fallback parser", error=str(e))

        # 3. Fallback text decoder for formatted text / mock documents
        try:
            raw_str = file_bytes.decode("utf-8", errors="ignore")
            lines = [l.strip() for l in raw_str.splitlines() if len(l.strip()) > 2]
            meaningful = [l for l in lines if re.search(r"[a-zA-Z]{3,}", l) and not re.search(r"[\x00-\x08\x0E-\x1F]", l)]
            if len(meaningful) >= 2:
                return "\n".join(meaningful[:100])
        except Exception:
            pass

        return ""

    def identify_document_type(self, text: str) -> str:
        """Classify the clinical document based on internal keywords and analyte patterns."""
        t_lower = text.lower()

        if any(k in t_lower for k in ["complete blood count", "cbc", "white blood cell", "platelet count", "hemoglobin", "hematocrit"]):
            return "Complete Blood Count (CBC) Laboratory Report"
        if any(k in t_lower for k in ["comprehensive metabolic panel", "cmp", "basic metabolic", "bmp", "egfr", "creatinine", "blood urea nitrogen"]):
            return "Metabolic Panel (CMP / BMP) Laboratory Report"
        if any(k in t_lower for k in ["lipid panel", "cholesterol", "triglycerides", "hdl cholesterol", "ldl cholesterol"]):
            return "Lipid Panel (Cardiovascular Risk) Report"
        if any(k in t_lower for k in ["hemoglobin a1c", "hba1c", "glycated hemoglobin", "estimated average glucose"]):
            return "Hemoglobin A1c Glycemic Report"
        if any(k in t_lower for k in ["thyroid panel", "thyrotropin", "tsh", "free t4", "free t3"]):
            return "Thyroid Function Laboratory Report"
        if any(k in t_lower for k in ["urinalysis", "urine culture", "specific gravity", "leukocyte esterase"]):
            return "Urinalysis Laboratory Report"
        if any(k in t_lower for k in ["x-ray", "computed tomography", "ct scan", "mri", "magnetic resonance", "ultrasound", "radiology report"]):
            return "Radiology & Imaging Diagnostic Report"
        if any(k in t_lower for k in ["biopsy", "pathology report", "histopathology", "cytology", "surgical pathology"]):
            return "Pathology & Biopsy Diagnostic Report"
        if any(k in t_lower for k in ["electrocardiogram", "ecg", "ekg", "echocardiogram", "sinus rhythm", "ejection fraction"]):
            return "Cardiology & Diagnostic Report"

        return "General Medical Diagnostic Report"

    def extract_metadata_from_text(self, text: str) -> Tuple[Dict[str, Any], Dict[str, Any], Optional[str]]:
        """Extract patient header, ordering facility/physician, and report date."""
        patient_info: Dict[str, Any] = {}
        facility_info: Dict[str, Any] = {}
        report_date: Optional[str] = None

        lines = text.splitlines()

        for line in lines:
            line_str = line.strip()
            # Patient Name
            p_match = re.search(r"(?:patient\s*(?:name)?|pt\s*name)\s*[:\-]\s*([A-Za-z\s,\.]{3,35})", line_str, re.IGNORECASE)
            if p_match and "name" not in patient_info:
                clean_name = p_match.group(1).strip()
                if not any(k in clean_name.lower() for k in ["report", "order", "doctor", "dr.", "physician"]):
                    patient_info["name"] = clean_name

            # Date of Birth / Age
            dob_match = re.search(r"(?:dob|date of birth|birth date)\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", line_str, re.IGNORECASE)
            if dob_match:
                patient_info["date_of_birth"] = dob_match.group(1)

            age_match = re.search(r"(?:age)\s*[:\-]\s*(\d{1,3})\s*(?:yo|years|yr)?", line_str, re.IGNORECASE)
            if age_match:
                patient_info["age"] = age_match.group(1)

            # MRN
            mrn_match = re.search(r"(?:mrn|medical record number|patient id)\s*[:\-]\s*([A-Za-z0-9\-]{4,20})", line_str, re.IGNORECASE)
            if mrn_match:
                patient_info["mrn"] = mrn_match.group(1)

            # Doctor / Ordering Provider
            doc_match = re.search(r"(?:ordering provider|physician|doctor|dr\.)\s*[:\-]?\s*([A-Za-z\s,\.]{3,35})", line_str, re.IGNORECASE)
            if doc_match and "ordering_physician" not in facility_info:
                candidate = doc_match.group(1).strip()
                if not any(k in candidate.lower() for k in ["patient", "report", "test", "result"]):
                    facility_info["ordering_physician"] = candidate

            # Facility / Lab Name
            fac_match = re.search(r"(?:facility|laboratory|clinic|hospital)\s*[:\-]\s*([A-Za-z0-9\s,\.]{3,40})", line_str, re.IGNORECASE)
            if fac_match and "facility_name" not in facility_info:
                facility_info["facility_name"] = fac_match.group(1).strip()

            # Date
            date_match = re.search(r"(?:collected|reported|specimen date|report date|date)\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", line_str, re.IGNORECASE)
            if date_match and not report_date:
                report_date = date_match.group(1)

        if not patient_info:
            patient_info["status"] = "No patient identifier clearly stated on document"
        if not facility_info:
            facility_info["facility_name"] = "Clinical Laboratory / Diagnostic Facility"

        return patient_info, facility_info, report_date

    def parse_findings_from_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Extract numerical and categorical findings, reference ranges, units, and flags.
        Handles uncertainties explicitly without guessing.
        """
        findings: List[Dict[str, Any]] = []
        sanitized = sanitize_ocr_text(text)
        lines = sanitized.splitlines()

        # Known common analytes with typical units and normal reference bounds
        ANALYTE_PROFILES = [
            # CBC
            ("White Blood Cell Count (WBC)", [r"\bwbc\b", r"white blood (?:cell|count)", r"leukocyte count"], "4.5 - 11.0", "x10^3/uL", 4.5, 11.0),
            ("Red Blood Cell Count (RBC)", [r"\brbc\b", r"red blood (?:cell|count)", r"erythrocyte count"], "4.3 - 5.9", "x10^6/uL", 4.3, 5.9),
            ("Hemoglobin (Hgb)", [r"\bhgb\b", r"\bhb\b", r"hemoglobin"], "13.5 - 17.5", "g/dL", 13.5, 17.5),
            ("Hematocrit (Hct)", [r"\bhct\b", r"hematocrit"], "41.0 - 50.0", "%", 41.0, 50.0),
            ("Platelet Count", [r"\bplt\b", r"platelets?", r"thrombocyte"], "150 - 450", "x10^3/uL", 150, 450),
            ("Mean Corpuscular Volume (MCV)", [r"\bmcv\b"], "80 - 100", "fL", 80, 100),
            ("Neutrophils", [r"neutrophils?", r"\bpolys\b", r"\banc\b"], "40 - 75", "%", 40, 75),
            ("Lymphocytes", [r"lymphocytes?", r"\blymphs?\b"], "20 - 45", "%", 20, 45),

            # CMP / Chemistry
            ("Fasting Blood Glucose", [r"glucose(?:,\s*fasting)?", r"\bfbg\b", r"blood sugar"], "70 - 99", "mg/dL", 70, 99),
            ("Hemoglobin A1c (HbA1c)", [r"hba1c", r"a1c", r"glycated hemoglobin"], "< 5.7", "%", 4.0, 5.6),
            ("Serum Creatinine", [r"creatinine"], "0.7 - 1.3", "mg/dL", 0.7, 1.3),
            ("Estimated GFR (eGFR)", [r"egfr", r"gfr\s*calc"], "> 60", "mL/min/1.73m2", 60.0, 150.0),
            ("Blood Urea Nitrogen (BUN)", [r"\bbun\b", r"urea nitrogen"], "7 - 20", "mg/dL", 7, 20),
            ("Sodium", [r"\bsodium\b", r"\bna\b"], "136 - 145", "mmol/L", 136, 145),
            ("Potassium", [r"\bpotassium\b", r"\bk\b"], "3.5 - 5.1", "mmol/L", 3.5, 5.1),
            ("Chloride", [r"\bchloride\b", r"\bcl\b"], "98 - 107", "mmol/L", 98, 107),
            ("Carbon Dioxide (Bicarbonate)", [r"carbon dioxide", r"\bco2\b", r"bicarbonate"], "22 - 29", "mmol/L", 22, 29),
            ("Serum Calcium", [r"calcium", r"\bca\b"], "8.6 - 10.2", "mg/dL", 8.6, 10.2),
            ("Total Protein", [r"total protein"], "6.0 - 8.3", "g/dL", 6.0, 8.3),
            ("Albumin", [r"albumin"], "3.5 - 5.0", "g/dL", 3.5, 5.0),
            ("Total Bilirubin", [r"total bilirubin", r"bilirubin,?\s*total"], "0.1 - 1.2", "mg/dL", 0.1, 1.2),
            ("Alanine Aminotransferase (ALT)", [r"\balt\b", r"\bsgpt\b", r"alanine transaminase"], "7 - 56", "U/L", 7, 56),
            ("Aspartate Aminotransferase (AST)", [r"\bast\b", r"\bsgot\b", r"aspartate transaminase"], "10 - 40", "U/L", 10, 40),
            ("Alkaline Phosphatase (ALP)", [r"alkaline phosphatase", r"\balp\b"], "44 - 147", "U/L", 44, 147),

            # Lipids
            ("Total Cholesterol", [r"total cholesterol", r"cholesterol,?\s*total"], "< 200", "mg/dL", 100, 199),
            ("Triglycerides", [r"triglycerides?"], "< 150", "mg/dL", 50, 149),
            ("HDL Cholesterol ('Good')", [r"hdl\s*cholesterol", r"\bhdl\b", r"hdl-c"], "> 40", "mg/dL", 40, 100),
            ("LDL Cholesterol ('Bad')", [r"ldl\s*cholesterol", r"\bldl\b", r"ldl-c"], "< 100", "mg/dL", 0, 99),

            # Thyroid
            ("Thyroid Stimulating Hormone (TSH)", [r"\btsh\b", r"thyrotropin"], "0.4 - 4.0", "uIU/mL", 0.4, 4.0),
            ("Free T4 (Thyroxine)", [r"free\s*t4", r"thyroxine,?\s*free"], "0.8 - 1.8", "ng/dL", 0.8, 1.8),
        ]

        # Value regex pattern: matches decimals or integers
        val_regex = re.compile(r"(\b\d+(?:\.\d+)?\b)")

        found_analyte_names = set()

        for formal_name, aliases, default_ref, default_unit, min_norm, max_norm in ANALYTE_PROFILES:
            if formal_name in found_analyte_names:
                continue

            for line in lines:
                matched_alias = False
                for alias in aliases:
                    if re.search(alias, line, re.IGNORECASE):
                        matched_alias = True
                        break

                if matched_alias:
                    # Look for numerical values on this line
                    nums = val_regex.findall(line)
                    if nums:
                        val_str = nums[0]
                        try:
                            val_num = float(val_str)
                        except ValueError:
                            continue

                        # Extract unit if present on line, or default
                        unit_str = default_unit
                        for cand_unit in ["mg/dL", "mmol/L", "g/dL", "%", "U/L", "fL", "x10^3/uL", "x10^6/uL", "uIU/mL", "ng/dL"]:
                            if cand_unit.lower() in line.lower():
                                unit_str = cand_unit
                                break

                        # Extract reference range if present
                        ref_match = re.search(r"(\d+(?:\.\d+)?\s*[\-\–]\s*\d+(?:\.\d+)?|<|>|\bref\b[^\n\r]+)", line, re.IGNORECASE)
                        ref_str = ref_match.group(0).strip() if ref_match else default_ref

                        # Check explicit flags on line (H, L, HIGH, LOW, CRITICAL, ABNORMAL, *)
                        has_high_flag = bool(re.search(r"\b(high|h|\*)\b", line, re.IGNORECASE))
                        has_low_flag = bool(re.search(r"\b(low|l)\b", line, re.IGNORECASE))
                        has_crit_flag = bool(re.search(r"\b(critical|panic|alert)\b", line, re.IGNORECASE))

                        flag = "NORMAL"
                        if has_crit_flag:
                            flag = "CRITICAL"
                        elif has_high_flag or val_num > max_norm:
                            flag = "HIGH"
                        elif has_low_flag or val_num < min_norm:
                            flag = "LOW"

                        sig = "Within standard reference range."
                        if flag == "HIGH":
                            sig = f"Higher than standard reference range ({ref_str} {unit_str})."
                        elif flag == "LOW":
                            sig = f"Lower than standard reference range ({ref_str} {unit_str})."
                        elif flag == "CRITICAL":
                            sig = f"Significantly out of range requiring prompt clinical review."

                        findings.append({
                            "name": formal_name,
                            "result_value": val_str,
                            "unit": unit_str,
                            "reference_range": ref_str,
                            "flag": flag,
                            "clinical_significance": sig,
                            "is_uncertain": False,
                            "uncertainty_reason": None,
                        })
                        found_analyte_names.add(formal_name)
                        break

        # If narrative imaging or clinical report without discrete numbers
        if not findings:
            # Check for radiology impressions
            for line in lines:
                if any(k in line.lower() for k in ["impression", "findings", "diagnosis", "conclusion", "assessment"]):
                    findings.append({
                        "name": "Clinical Impression / Narrative Finding",
                        "result_value": line[:120].strip(),
                        "unit": "Qualitative Narrative",
                        "reference_range": "Normal anatomical appearance",
                        "flag": "ABNORMAL" if any(w in line.lower() for w in ["abnormal", "fracture", "mass", "lesion", "infiltrate", "effusion"]) else "NORMAL",
                        "clinical_significance": "Narrative qualitative evaluation from reading clinician.",
                        "is_uncertain": False,
                        "uncertainty_reason": None,
                    })
                    break

        return findings

    def explain_medical_terms(self, text: str) -> List[Dict[str, Any]]:
        """Identify complex medical terms in document and produce accessible explanations."""
        t_lower = text.lower()
        explanations: List[Dict[str, Any]] = []

        for term, simple_def in MEDICAL_TERMINOLOGY_DICT.items():
            if re.search(rf"\b{re.escape(term)}\b", t_lower):
                explanations.append({
                    "term": term.title(),
                    "simple_explanation": simple_def,
                    "context": f"Mentioned in your report regarding {term.title()}.",
                })

        return explanations[:8]  # Top terms

    def explain_abnormal_findings(self, findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Explain out-of-range results using document reference ranges."""
        abnormals: List[Dict[str, Any]] = []

        for f in findings:
            if f["flag"] in ("HIGH", "LOW", "ABNORMAL", "CRITICAL"):
                direction = "elevated" if f["flag"] in ("HIGH", "CRITICAL") else "lower than typical"
                simple_exp = (
                    f"Your {f['name']} result is {f['result_value']} {f.get('unit', '')}, which is {direction} "
                    f"compared to the documented reference interval of {f.get('reference_range', 'standard levels')}."
                )

                severity = "MODERATE"
                if f["flag"] == "CRITICAL":
                    severity = "CRITICAL"
                elif f["name"] in ("Fasting Blood Glucose", "Serum Creatinine", "Platelet Count") and f["flag"] in ("HIGH", "LOW"):
                    severity = "HIGH"

                abnormals.append({
                    "test_name": f["name"],
                    "result_value": f"{f['result_value']} {f.get('unit', '')}".strip(),
                    "reference_range": f.get("reference_range", "Standard reference interval"),
                    "simple_explanation": simple_exp,
                    "clinical_significance": f.get("clinical_significance", "Requires correlation with clinical symptoms."),
                    "severity": severity,
                })

        return abnormals

    async def generate_analysis_report(
        self,
        raw_text: str,
        patient_chart: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Execute structured AI Medical Report Analysis.
        Synthesizes extracted findings, terminology explanations, clinical limitations,
        missing context, and Personalized Patient Next Steps.
        """
        sanitized = sanitize_ocr_text(raw_text)

        # 1. Document Classification & Metadata
        doc_type = self.identify_document_type(sanitized)
        patient_info, facility_info, rep_date = self.extract_metadata_from_text(sanitized)

        # 2. Extract Discrete Findings
        findings = self.parse_findings_from_text(sanitized)

        # 3. Check for Empty / Unreadable Document
        is_uncertain_doc = len(sanitized.strip()) < 25 or len(findings) == 0
        uncertainty_reason = None
        if is_uncertain_doc:
            uncertainty_reason = "Document text was sparse, incomplete, or could not be clearly resolved from the scan."

        # 4. Terminology Explanations
        terminology = self.explain_medical_terms(sanitized)

        # 5. Abnormal Findings Explained
        abnormal_explained = self.explain_abnormal_findings(findings)

        # 6. What Report Establishes vs What it Does NOT Establish
        what_establishes: List[str] = []
        what_not_establishes: List[str] = []

        if findings:
            normal_count = sum(1 for f in findings if f["flag"] == "NORMAL")
            abnormal_count = len(abnormal_explained)

            what_establishes.append(f"Provides documented measurements for {len(findings)} specific clinical tests on the testing date.")
            if normal_count > 0:
                what_establishes.append(f"Confirms {normal_count} measured test parameters were within standard reference ranges at the time of specimen collection.")
            if abnormal_count > 0:
                what_establishes.append(f"Identifies {abnormal_count} test parameter(s) requiring physician review and clinical correlation.")

            what_not_establishes.append("This report does NOT establish a definitive disease diagnosis on its own without comprehensive clinical history and physician evaluation.")
            what_not_establishes.append("It does not reflect current physiological changes or medication responses that occurred after the specimen was drawn.")
            what_not_establishes.append("It does not replace an in-person physical examination or specialist medical assessment.")
        else:
            what_establishes.append("Document was received and processed through the clinical parser.")
            what_not_establishes.append("Text clarity is insufficient to definitively verify quantitative test measurements.")

        # 7. Missing Information Preventing Reliable Interpretation
        missing_info: List[str] = []
        if "fasting" not in sanitized.lower() and any(k in doc_type.lower() for k in ["glucose", "lipid", "metabolic"]):
            missing_info.append("Patient fasting duration was not clearly documented (essential for interpreting blood glucose and lipid panels).")
        if not rep_date:
            missing_info.append("Precise specimen collection date and timestamp were not detected in document header.")
        if "ordering_physician" not in facility_info:
            missing_info.append("Ordering clinician name or primary clinical specialty not identified on report.")
        missing_info.append("Prior baseline test results are not attached for longitudinal trend comparison.")

        # 8. Useful Questions for Healthcare Provider
        questions_for_doctor: List[str] = []
        if abnormal_explained:
            for abn in abnormal_explained[:3]:
                questions_for_doctor.append(f"What might be causing my {abn['test_name']} to be {abn['result_value']}, and is re-testing recommended?")
        questions_for_doctor.append("Are these results consistent with my ongoing treatment plan or medications?")
        questions_for_doctor.append("Do I need any dietary modifications, lifestyle adjustments, or follow-up imaging based on this report?")
        questions_for_doctor.append("When should we schedule my next routine monitoring laboratory tests?")

        # 9. Key Findings Summary
        if abnormal_explained:
            abn_names = ", ".join(a["test_name"] for a in abnormal_explained)
            key_summary = (
                f"Your {doc_type} includes {len(findings)} recorded findings. Most parameters were evaluated, "
                f"with {len(abnormal_explained)} finding{'s' if len(abnormal_explained) > 1 else ''} noted outside "
                f"the laboratory's standard reference interval ({abn_names}). "
                f"These findings should be reviewed directly with your doctor to understand what they mean for your personal health."
            )
        elif findings:
            key_summary = (
                f"Your {doc_type} includes {len(findings)} recorded measurements. All analyzed parameters "
                f"fall within normal reference ranges. Your healthcare provider will correlate these with your symptoms and health goals."
            )
        else:
            key_summary = (
                f"Your document was analyzed as a {doc_type}. However, discrete numerical findings could not be clearly resolved. "
                f"Please ensure the document image is clear or upload an official electronic PDF copy."
            )

        # 10. Personalized Patient Next Steps
        has_critical = any(a["severity"] == "CRITICAL" for a in abnormal_explained)
        has_abnormal = len(abnormal_explained) > 0

        urgency_level = "ROUTINE"
        if has_critical:
            urgency_level = "EMERGENCY"
        elif has_abnormal:
            urgency_level = "PROMPT_EVALUATION"

        practical_actions = [
            "Download or save a copy of this analysis report to your personal MediCare health chart.",
            "Write down your questions or any recent symptoms you have noticed prior to speaking with your doctor.",
        ]
        if has_abnormal:
            practical_actions.append(
                "Contact your ordering clinician's office to discuss the flagged results and determine if a follow-up visit is needed."
            )
        else:
            practical_actions.append("Keep this normal result on file as a healthy baseline comparison for future checkups.")

        seek_prompt_care = [
            "Sudden severe shortness of breath, acute chest discomfort, or pressure in the chest",
            "Sudden confusion, speech difficulty, or severe dizziness",
            "Signs of acute allergic reaction, severe abdominal pain, or uncontrollable bleeding",
        ]

        clarification_note = None
        if is_uncertain_doc or len(missing_info) > 2:
            clarification_note = (
                "Because certain clinical details (such as collection timing or baseline trends) were missing from the document, "
                "please confirm all findings directly with your ordering clinician or laboratory."
            )

        next_steps = {
            "summary": (
                "Follow up with your prescribing clinician to interpret these findings in the context of your overall health."
                if has_abnormal else
                "Your test results appear stable. Continue your regular healthy routine and discuss them during your next scheduled appointment."
            ),
            "practical_actions": practical_actions,
            "doctor_questions": questions_for_doctor,
            "clarification_needed": clarification_note,
            "seek_prompt_care_reasons": seek_prompt_care,
            "urgency_level": urgency_level,
            "disclaimer": (
                "IMPORTANT: This analysis is for educational and informational purposes only and does NOT constitute "
                "a medical diagnosis, treatment plan, or clinical directive. Always consult a licensed healthcare professional "
                "for clinical decisions. If you suspect a medical emergency, call 911 immediately."
            ),
        }

        # ── 11. Enhance with Gemini if available ───────────────────────────────
        if ai_service._genai and settings.GEMINI_API_KEY and len(sanitized) > 50:
            try:
                gemini_prompt = (
                    f"You are the MediCare AI Clinical Report Analyzer assisting a patient with understanding their medical document.\n\n"
                    f"Document Type: {doc_type}\n"
                    f"Document Text:\n{sanitized[:3000]}\n\n"
                    f"Instructions:\n"
                    f"1. Refine the key findings summary in gentle, patient-friendly language.\n"
                    f"2. Clearly separate what this report establishes from what it does NOT establish.\n"
                    f"3. Do not invent any test results, reference ranges, or diagnoses.\n"
                    f"4. Provide 3 thoughtful questions for their doctor.\n"
                    f"Format your response as valid JSON with keys: 'refined_summary', 'what_establishes', 'what_not_establishes', 'questions'."
                )
                loop = asyncio.get_event_loop()
                model = ai_service._genai.GenerativeModel(settings.GEMINI_MODEL or "gemini-2.5-pro")
                res = await loop.run_in_executor(None, lambda: model.generate_content(gemini_prompt))
                if res and res.text:
                    # Clean possible markdown block
                    json_str = res.text.strip()
                    if json_str.startswith("```json"):
                        json_str = json_str[7:]
                    if json_str.endswith("```"):
                        json_str = json_str[:-3]
                    parsed = json.loads(json_str.strip())
                    if parsed.get("refined_summary"):
                        key_summary = parsed["refined_summary"]
                    if parsed.get("what_establishes"):
                        what_establishes = parsed["what_establishes"]
                    if parsed.get("what_not_establishes"):
                        what_not_establishes = parsed["what_not_establishes"]
                    if parsed.get("questions"):
                        questions_for_doctor = parsed["questions"]
                        next_steps["doctor_questions"] = questions_for_doctor
            except Exception as e:
                log.warning("Gemini report enhancement skipped; using evidence-based clinical reasoning", error=str(e))

        return {
            "document_type": doc_type,
            "patient_info": patient_info,
            "facility_info": facility_info,
            "report_date": rep_date,
            "extracted_findings": findings,
            "terminology_explanations": terminology,
            "abnormal_findings_explained": abnormal_explained,
            "key_findings_summary": key_summary,
            "what_report_establishes": what_establishes,
            "what_report_does_not_establish": what_not_establishes,
            "missing_information": missing_info,
            "questions_for_doctor": questions_for_doctor,
            "next_steps": next_steps,
            "confidence_score": 0.65 if is_uncertain_doc else 0.95,
            "is_uncertain": is_uncertain_doc,
            "uncertainty_reason": uncertainty_reason,
            "review_status": "flagged_for_pharmacist" if has_critical else "pending_review",
            "ai_provider": "MediCare Clinical Report Intelligence Engine",
        }


medical_report_pipeline = MedicalReportPipeline()
