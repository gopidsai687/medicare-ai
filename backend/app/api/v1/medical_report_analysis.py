"""
Medical Report Analysis and Clinical Guidance API Endpoints.
Includes:
  - File upload (PDF, JPG, PNG) with magic bytes validation and multi-page text extraction
  - Structured AI analysis: findings, abnormal results with reference ranges, plain-language terminology
  - What report establishes / does NOT establish, missing clinical info, doctor questions
  - Personalized Patient Next Steps
  - Document-grounded follow-up Q&A chat with emergency symptom detection
  - Patient data isolation and secure deletion
  - Clinician / Admin review workflow
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.audit_log import AuditAction, AuditLog, AuditSeverity
from app.models.medical_report_analysis import (
    MedicalReportAnalysisResult,
    MedicalReportChatMessage,
    MedicalReportUpload,
)
from app.models.patient import Patient
from app.models.prescription_analysis import ReviewStatus, UploadStatus
from app.models.user import User, UserRole
from app.schemas.medical_report_analysis import (
    MedicalReportAnalysisRead,
    MedicalReportChatMessageRead,
    MedicalReportChatRequest,
    MedicalReportChatResponse,
    MedicalReportReviewUpdateRequest,
    MedicalReportUploadResponse,
)
from app.services.ai_service import ai_service
from app.services.medical_report_pipeline import (
    medical_report_pipeline,
)
from app.services.prescription_pipeline import validate_file_upload

router = APIRouter(prefix="/medical-report-analysis", tags=["Medical Report Analysis & Guidance"])


# ── Helper: Patient Context ───────────────────────────────────────────────────

async def _get_or_create_patient(db: AsyncSession, current_user: User) -> Patient:
    """Resolve patient record for the current authenticated user."""
    stmt = select(Patient).where(Patient.user_id == current_user.id)
    res = await db.execute(stmt)
    patient = res.scalar_one_or_none()

    if not patient and current_user.role == UserRole.PATIENT:
        mrn = f"MRN-{uuid.uuid4().hex[:8].upper()}"
        patient = Patient(
            user_id=current_user.id,
            mrn=mrn,
        )
        db.add(patient)
        await db.flush()
        await db.refresh(patient)

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for this user account.",
        )
    return patient


# ── 1. Document Upload & Immediate AI Analysis ────────────────────────────────

@router.post("/upload", response_model=MedicalReportAnalysisRead, status_code=status.HTTP_201_CREATED)
async def upload_and_analyze_medical_report(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a medical report or laboratory result (PDF, JPG, PNG).
    Validates file integrity, extracts multi-page text via OCR/PDF parser,
    and performs structured AI clinical report analysis.
    """
    patient = await _get_or_create_patient(db, current_user)

    file_bytes = await file.read()
    is_valid, ext, mime_or_err = validate_file_upload(
        file_bytes=file_bytes,
        filename=file.filename or "medical_report.pdf",
        content_type=file.content_type or "",
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=mime_or_err,
        )

    # Secure file save
    storage_path = medical_report_pipeline.save_upload_file(patient.id, file_bytes, ext)

    # Multi-page Text extraction
    raw_text = await medical_report_pipeline.extract_text_from_file(file_bytes, ext)

    # Classify document type
    doc_type = medical_report_pipeline.identify_document_type(raw_text)

    # Create upload record
    upload = MedicalReportUpload(
        patient_id=patient.id,
        file_name=file.filename or "medical_report_document",
        file_type=ext.replace(".", ""),
        file_size_bytes=len(file_bytes),
        storage_path=storage_path,
        ocr_raw_text=raw_text,
        status=UploadStatus.ANALYZED,
        is_manual_entry=False,
    )
    db.add(upload)
    await db.flush()
    await db.refresh(upload)

    # Patient chart context for correlation
    patient_chart = {
        "mrn": patient.mrn,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "blood_type": patient.blood_type.value if patient.blood_type else "unknown",
    }

    # Run Structured Analysis Pipeline
    analysis_data = await medical_report_pipeline.generate_analysis_report(
        raw_text=raw_text,
        patient_chart=patient_chart,
    )

    # Create analysis result record
    report_result = MedicalReportAnalysisResult(
        upload_id=upload.id,
        patient_id=patient.id,
        document_type=analysis_data["document_type"],
        patient_info=analysis_data["patient_info"],
        facility_info=analysis_data["facility_info"],
        report_date=analysis_data["report_date"],
        extracted_findings=analysis_data["extracted_findings"],
        terminology_explanations=analysis_data["terminology_explanations"],
        abnormal_findings_explained=analysis_data["abnormal_findings_explained"],
        key_findings_summary=analysis_data["key_findings_summary"],
        what_report_establishes=analysis_data["what_report_establishes"],
        what_report_does_not_establish=analysis_data["what_report_does_not_establish"],
        missing_information=analysis_data["missing_information"],
        questions_for_doctor=analysis_data["questions_for_doctor"],
        next_steps=analysis_data["next_steps"],
        confidence_score=analysis_data["confidence_score"],
        is_uncertain=analysis_data["is_uncertain"],
        uncertainty_reason=analysis_data["uncertainty_reason"],
        review_status=ReviewStatus(analysis_data["review_status"]),
        ai_provider=analysis_data["ai_provider"],
    )
    db.add(report_result)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.CREATE_RECORD,
        severity=AuditSeverity.INFO,
        resource_type="MedicalReportAnalysisResult",
        resource_id=str(report_result.id),
        details={
            "document_type": report_result.document_type,
            "findings_count": len(report_result.extracted_findings),
            "has_abnormal_findings": len(report_result.abnormal_findings_explained) > 0,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(report_result)

    return report_result


# ── 2. View Reports History ───────────────────────────────────────────────────

@router.get("/reports", response_model=List[MedicalReportAnalysisRead])
async def list_medical_report_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List medical report analyses for authenticated patient (or all for clinician/admin)."""
    if current_user.role in (UserRole.ADMIN, UserRole.DOCTOR):
        stmt = select(MedicalReportAnalysisResult).order_by(desc(MedicalReportAnalysisResult.created_at))
    else:
        patient = await _get_or_create_patient(db, current_user)
        stmt = (
            select(MedicalReportAnalysisResult)
            .where(MedicalReportAnalysisResult.patient_id == patient.id)
            .order_by(desc(MedicalReportAnalysisResult.created_at))
        )

    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/reports/{report_id}", response_model=MedicalReportAnalysisRead)
async def get_medical_report_analysis(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve single medical report analysis with patient access verification."""
    stmt = select(MedicalReportAnalysisResult).where(MedicalReportAnalysisResult.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Medical report analysis not found.")

    if current_user.role == UserRole.PATIENT:
        patient = await _get_or_create_patient(db, current_user)
        if report.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this medical report.")

    return report


# ── 3. Grounded Follow-up AI Chat ────────────────────────────────────────────

@router.post("/reports/{report_id}/chat", response_model=MedicalReportChatResponse)
async def chat_about_medical_report(
    report_id: uuid.UUID,
    payload: MedicalReportChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ask follow-up questions strictly grounded in the analyzed medical report.
    Never hallucinates unmentioned data; recognizes red-flag medical emergencies.
    """
    stmt = select(MedicalReportAnalysisResult).where(MedicalReportAnalysisResult.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Medical report analysis not found.")

    patient = await _get_or_create_patient(db, current_user)
    if current_user.role == UserRole.PATIENT and report.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this report.")

    q = payload.message.lower().strip()

    # Red-flag emergency detection
    emergency_terms = [
        "chest pain", "can't breathe", "cannot breathe", "shortness of breath",
        "throat swelling", "lips swelling", "anaphylaxis", "severe allergic",
        "fainted", "unconscious", "stroke", "bleeding heavily", "suicidal",
        "crushing pressure", "severe headache sudden",
    ]
    is_emergency = any(t in q for t in emergency_terms)

    if is_emergency:
        emergency_reply = (
            "🚨 **CRITICAL MEDICAL ALERT:** The symptoms you described may indicate a life-threatening emergency.\n\n"
            "- **Call 911 immediately** or go to the nearest emergency department.\n"
            "- Do not wait for an online response or delay professional emergency medical evaluation.\n\n"
            "*MediCare AI is an educational document interpreter and cannot provide emergency medical care.*"
        )
        chat_msg = MedicalReportChatMessage(
            report_analysis_id=report.id,
            patient_id=patient.id,
            role="assistant",
            content=emergency_reply,
            is_emergency=True,
        )
        db.add(chat_msg)
        await db.commit()

        return MedicalReportChatResponse(
            reply=emergency_reply,
            is_emergency=True,
            grounded_in_document=True,
            disclaimer="Emergency situation detected. Call 911 immediately.",
        )

    # Document Context Summary
    findings_summary = "\n".join(
        f"- {f['name']}: {f['result_value']} {f.get('unit', '')} (Ref: {f.get('reference_range', 'N/A')}, Flag: {f.get('flag', 'NORMAL')})"
        for f in report.extracted_findings
    )
    abnormal_summary = "\n".join(
        f"- {a['test_name']}: {a['result_value']} (Ref: {a.get('reference_range', 'N/A')}) — {a.get('simple_explanation', '')}"
        for a in report.abnormal_findings_explained
    )
    terms_summary = "\n".join(
        f"- {t['term']}: {t.get('simple_explanation', '')}"
        for t in report.terminology_explanations
    )

    doc_context = (
        f"Document Type: {report.document_type}\n"
        f"Key Summary: {report.key_findings_summary}\n"
        f"Measured Findings:\n{findings_summary}\n"
        f"Abnormal Results:\n{abnormal_summary}\n"
        f"Medical Terms:\n{terms_summary}\n"
        f"What Report Establishes: {'; '.join(report.what_report_establishes)}\n"
        f"What Report Does NOT Establish: {'; '.join(report.what_report_does_not_establish)}\n"
        f"Missing Clinical Info: {'; '.join(report.missing_information)}"
    )

    reply_text = ""

    if ai_service._chat_model and settings.GEMINI_API_KEY:
        try:
            prompt = (
                "You are the MediCare AI Medical Document Assistant. A patient is asking a question about their medical report.\n\n"
                f"DOCUMENT DATA (Ground Truth):\n{doc_context}\n\n"
                f"PATIENT QUESTION: {payload.message}\n\n"
                "STRICT RULES:\n"
                "1. Answer ONLY using the facts from the uploaded document provided above.\n"
                "2. If the document does not contain the answer (e.g. asking for medications or conditions not tested), "
                "state clearly: 'This medical report does not contain that information. Please consult your physician.'\n"
                "3. Explain medical concepts in clear, comforting, accessible language.\n"
                "4. Do NOT diagnose diseases or tell the patient to start or stop any medication.\n"
                "5. Remind them to verify abnormal findings with their ordering doctor."
            )
            loop = asyncio.get_event_loop()
            res_ai = await loop.run_in_executor(None, lambda: ai_service._chat_model.generate_content(prompt))
            if res_ai and res_ai.text:
                reply_text = res_ai.text.strip()
        except Exception:
            reply_text = ""

    if not reply_text:
        # Structured clinical reasoning grounded strictly in document data
        if any(k in q for k in ["treatment", "treat", "therapy", "medication", "medicine", "pill", "cure", "drug", "prescription", "how to treat"]):
            treatment_parts = [
                f"### Clinical Treatment & Therapy Guidance for this {report.document_type}",
                "",
                "**Clinical Boundary:** Diagnostic laboratory and imaging reports document objective physiological measurements and identify potential abnormalities — they do **not** prescribe or modify medications directly. Medical treatments must always be evaluated and prescribed by your physician in the context of your overall clinical history.",
                "",
            ]
            if report.abnormal_findings_explained:
                treatment_parts.append("**Findings in this Report Requiring Clinical Management:**")
                for a in report.abnormal_findings_explained:
                    treatment_parts.append(f"• **{a['test_name']}** ({a['result_value']}): {a.get('simple_explanation', '')}")
                treatment_parts.append("")

            # Extract practical next steps if available
            if report.next_steps and isinstance(report.next_steps, dict):
                actions = report.next_steps.get("practical_actions", [])
                if actions:
                    treatment_parts.append("**Recommended Next Steps & Clinical Management:**")
                    for act in actions:
                        treatment_parts.append(f"• {act}")
                    treatment_parts.append("")

            if report.questions_for_doctor:
                treatment_parts.append("**Recommended Questions for Your Doctor Regarding Treatment:**")
                for q_item in report.questions_for_doctor[:3]:
                    treatment_parts.append(f"• \"{q_item}\"")
                treatment_parts.append("")

            treatment_parts.append("*Always consult your prescribing doctor before starting, stopping, or altering any medication or therapy.*")
            reply_text = "\n".join(treatment_parts)

        elif any(k in q for k in ["abnormal", "flag", "high", "low", "out of range"]):
            if report.abnormal_findings_explained:
                items = "\n".join(
                    f"• **{a['test_name']}**: {a['result_value']} (Standard reference range: {a.get('reference_range', 'N/A')})\n  _{a.get('simple_explanation', '')}_"
                    for a in report.abnormal_findings_explained
                )
                reply_text = f"Here are the findings flagged outside standard reference ranges in this report:\n\n{items}\n\nBe sure to discuss what these mean for your individual health with your doctor."
            else:
                reply_text = "Good news — all analyzed findings in this document fall within standard reference intervals."

        elif any(k in q for k in ["normal", "in range", "passed"]):
            normal_findings = [f for f in report.extracted_findings if f.get("flag") == "NORMAL"]
            if normal_findings:
                items = "\n".join(
                    f"• **{f['name']}**: {f['result_value']} {f.get('unit', '')} (Ref: {f.get('reference_range', 'N/A')})"
                    for f in normal_findings[:8]
                )
                reply_text = f"The following tests in this report are within standard normal reference ranges:\n\n{items}\n\nNormal values indicate these specific biological markers are functioning as expected."
            else:
                reply_text = "No tests were explicitly marked as standard normal in this report."

        elif any(k in q for k in ["term", "mean", "meaning", "definition"]):
            matching_terms = [
                t for t in report.terminology_explanations
                if t["term"].lower() in q
            ]
            if matching_terms:
                t = matching_terms[0]
                reply_text = f"**{t['term']}**: {t['simple_explanation']}\n\nIn your report, this was noted in the context of {t.get('context', 'your laboratory evaluation')}."
            else:
                terms_list = ", ".join(t["term"] for t in report.terminology_explanations[:6])
                reply_text = f"Here are key medical terms explained in your report: {terms_list}. You can ask about any of these terms specifically!"

        elif any(k in q for k in ["question", "doctor", "ask", "appointment"]):
            q_list = "\n".join(f"• {item}" for item in report.questions_for_doctor)
            reply_text = f"Here are recommended questions you can ask your healthcare provider about this report:\n\n{q_list}"

        elif any(k in q for k in ["summary", "simple words", "explain", "overview"]):
            reply_text = f"**Overview of your {report.document_type}:**\n\n{report.key_findings_summary}\n\n" + (
                "Remember: This report gives an objective snapshot of specific laboratory measurements. Your doctor will interpret these alongside your physical examination, symptoms, and medical history."
            )
        else:
            # Check if user mentioned a specific test name from findings
            matched_finding = None
            for f in report.extracted_findings:
                if f["name"].lower() in q or (f.get("short_name") and f["short_name"].lower() in q):
                    matched_finding = f
                    break

            if matched_finding:
                reply_text = (
                    f"### Result for **{matched_finding['name']}**\n\n"
                    f"• **Measured Value:** {matched_finding['result_value']} {matched_finding.get('unit', '')}\n"
                    f"• **Reference Range:** {matched_finding.get('reference_range', 'Standard laboratory interval')}\n"
                    f"• **Clinical Status:** {matched_finding.get('flag', 'NORMAL')}\n\n"
                    f"_{matched_finding.get('clinical_significance', 'Measured as part of your comprehensive diagnostic panel.')}_\n\n"
                    f"If you have questions about how this result relates to your symptoms or medication regimen, consult your doctor."
                )
            else:
                reply_text = (
                    f"This **{report.document_type}** specifically documents the ordered test panels. "
                    f"It does not contain clinical data or findings regarding \"{payload.message}\".\n\n"
                    f"Diagnostic laboratory tests measure specific biological markers rather than recording a complete medical history. "
                    f"Please consult your healthcare provider or review your other medical records for information on this topic."
                )

    # Save conversation turn
    chat_msg_user = MedicalReportChatMessage(
        report_analysis_id=report.id,
        patient_id=patient.id,
        role="patient",
        content=payload.message,
        is_emergency=False,
    )
    chat_msg_bot = MedicalReportChatMessage(
        report_analysis_id=report.id,
        patient_id=patient.id,
        role="assistant",
        content=reply_text,
        is_emergency=False,
    )
    db.add(chat_msg_user)
    db.add(chat_msg_bot)
    await db.commit()

    return MedicalReportChatResponse(
        reply=reply_text,
        is_emergency=False,
        grounded_in_document=True,
        disclaimer="AI-generated informational guidance. Consult your clinician for clinical decisions.",
    )


@router.get("/reports/{report_id}/chat", response_model=List[MedicalReportChatMessageRead])
async def get_medical_report_chat_history(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve chat message history for an analyzed medical report."""
    stmt = select(MedicalReportAnalysisResult).where(MedicalReportAnalysisResult.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Medical report analysis not found.")

    patient = await _get_or_create_patient(db, current_user)
    if current_user.role == UserRole.PATIENT and report.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to chat history.")

    msg_stmt = (
        select(MedicalReportChatMessage)
        .where(MedicalReportChatMessage.report_analysis_id == report_id)
        .order_by(MedicalReportChatMessage.created_at)
    )
    msg_res = await db.execute(msg_stmt)
    return msg_res.scalars().all()


# ── 4. Deletion Functionality (Security & Privacy) ─────────────────────────────

@router.delete("/reports/{report_id}", status_code=status.HTTP_200_OK)
async def delete_medical_report_analysis(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently delete a medical report analysis and associated chat history.
    Enforces patient ownership authorization and creates an audit record.
    """
    stmt = select(MedicalReportAnalysisResult).where(MedicalReportAnalysisResult.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Medical report analysis not found.")

    if current_user.role == UserRole.PATIENT:
        patient = await _get_or_create_patient(db, current_user)
        if report.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Unauthorized to delete this medical report analysis.")

    # Check if upload needs removal
    upload_id = report.upload_id

    await db.delete(report)

    if upload_id:
        u_stmt = select(MedicalReportUpload).where(MedicalReportUpload.id == upload_id)
        u_res = await db.execute(u_stmt)
        upload = u_res.scalar_one_or_none()
        if upload:
            # Delete file on disk if exists
            try:
                if upload.storage_path and os.path.exists(upload.storage_path):
                    os.remove(upload.storage_path)
            except Exception as e:
                log.warning("Could not delete report file from storage", path=upload.storage_path, error=str(e))
            await db.delete(upload)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.DELETE_RECORD,
        severity=AuditSeverity.INFO,
        resource_type="MedicalReportAnalysisResult",
        resource_id=str(report_id),
        details={"deleted_by": current_user.email},
    )
    db.add(audit)
    await db.commit()

    return {"status": "success", "message": "Medical report analysis and associated document deleted permanently."}


# ── 5. Clinician Review Status Workflow ───────────────────────────────────────

@router.patch("/reports/{report_id}/review", response_model=MedicalReportAnalysisRead)
async def update_medical_report_review(
    report_id: uuid.UUID,
    payload: MedicalReportReviewUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR)),
):
    """Authorized clinician or admin updates medical report review status."""
    stmt = select(MedicalReportAnalysisResult).where(MedicalReportAnalysisResult.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Medical report analysis not found.")

    try:
        report.review_status = ReviewStatus(payload.review_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid review status '{payload.review_status}'.")

    report.reviewed_by_id = current_user.id
    report.reviewed_at = datetime.now(timezone.utc)
    report.review_notes = payload.review_notes

    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.UPDATE_RECORD,
        severity=AuditSeverity.INFO,
        resource_type="MedicalReportAnalysisResult",
        resource_id=str(report.id),
        details={"review_status": report.review_status.value, "reviewed_by": current_user.full_name},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(report)
    return report
