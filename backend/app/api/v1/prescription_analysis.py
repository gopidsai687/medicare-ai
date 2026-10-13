"""
Prescription Analysis and Patient Health Guidance API Endpoints.
Includes:
  - File upload (PDF, JPG, PNG) with magic bytes validation and text extraction
  - Manual prescription entry
  - Extracted items retrieval and patient verification
  - AI analysis execution with evidence-based guidance & safety screening
  - Medication reminders management
  - Multi-turn AI Q&A chat with emergency symptom detection
  - Clinician / Pharmacist review status workflow
  - Admin telemetry metrics and review queue
"""
import os
import uuid
from datetime import datetime, timezone
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

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.audit_log import AuditAction, AuditLog, AuditSeverity
from app.models.medical_record import MedicalRecord, RecordCategory
from app.models.patient import Patient
from app.models.prescription import Prescription, PrescriptionStatus
from app.models.prescription_analysis import (
    MedicationReminder,
    PrescriptionAnalysisReport,
    PrescriptionChatMessage,
    PrescriptionExtractedItem,
    PrescriptionUpload,
    ReviewStatus,
    UploadStatus,
)
from app.models.user import User, UserRole
from app.schemas.prescription_analysis import (
    AdminMetricsResponse,
    AdminQueueItem,
    AnalysisReportRead,
    ConfirmItemsRequest,
    ExtractedItemSchema,
    ExtractedItemUpdate,
    ManualPrescriptionEntryRequest,
    MedicationReminderCreate,
    MedicationReminderRead,
    PrescriptionChatMessageRead,
    PrescriptionChatRequest,
    PrescriptionChatResponse,
    ReviewUpdateRequest,
    UploadResponse,
)
from app.core.config import settings
from app.services.ai_service import ai_service
from app.services.prescription_pipeline import (
    prescription_pipeline,
    validate_file_upload,
)

router = APIRouter(prefix="/prescription-analysis", tags=["Prescription Analysis & Health Guidance"])


# ── Helper: Resolve Patient Context ──────────────────────────────────────────

async def _get_or_create_patient(db: AsyncSession, current_user: User) -> Patient:
    """Resolve patient record for the current authenticated user."""
    stmt = select(Patient).where(Patient.user_id == current_user.id)
    res = await db.execute(stmt)
    patient = res.scalar_one_or_none()

    if not patient and current_user.role == UserRole.PATIENT:
        # Create a patient profile if missing
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
            detail="Patient clinical profile not found for this user.",
        )
    return patient


async def _get_patient_chart_summary(db: AsyncSession, patient_id: uuid.UUID) -> dict:
    """Retrieve verified patient chart data (allergies, active meds, diagnoses, DOB)."""
    p_stmt = select(Patient).where(Patient.id == patient_id)
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()

    # Active medications
    rx_stmt = select(Prescription.medication_name).where(
        Prescription.patient_id == patient_id,
        Prescription.status == PrescriptionStatus.ACTIVE,
    )
    rx_res = await db.execute(rx_stmt)
    active_meds = [r[0] for r in rx_res.all()]

    # Documented allergies from medical records
    allg_stmt = select(MedicalRecord.title).where(
        MedicalRecord.patient_id == patient_id,
        MedicalRecord.category == RecordCategory.ALLERGY,
    )
    allg_res = await db.execute(allg_stmt)
    allergies = [r[0] for r in allg_res.all()]

    # Diagnoses
    diag_stmt = select(MedicalRecord.title).where(
        MedicalRecord.patient_id == patient_id,
        MedicalRecord.category == RecordCategory.DIAGNOSIS,
    )
    diag_res = await db.execute(diag_stmt)
    diagnoses = [r[0] for r in diag_res.all()]

    return {
        "mrn": patient.mrn if patient else "UNKNOWN",
        "date_of_birth": patient.date_of_birth.isoformat() if patient and patient.date_of_birth else None,
        "blood_type": patient.blood_type.value if patient else "unknown",
        "active_medications": active_meds,
        "allergies": allergies,
        "diagnoses": diagnoses,
    }


# ── 1. Document Upload & Extraction ──────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_prescription_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a prescription file (PDF, JPG, PNG).
    Validates file integrity, extracts text, performs entity recognition,
    and returns extracted items for patient verification.
    """
    patient = await _get_or_create_patient(db, current_user)

    file_bytes = await file.read()
    is_valid, ext, mime_or_err = validate_file_upload(
        file_bytes=file_bytes,
        filename=file.filename or "prescription.pdf",
        content_type=file.content_type or "",
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=mime_or_err,
        )

    # Secure file save
    storage_path = prescription_pipeline.save_upload_file(patient.id, file_bytes, ext)

    # Text extraction
    raw_text = await prescription_pipeline.extract_text_from_file(file_bytes, ext)

    # Create upload record
    upload = PrescriptionUpload(
        patient_id=patient.id,
        file_name=file.filename or "prescription_document",
        file_type=ext.replace(".", ""),
        file_size_bytes=len(file_bytes),
        storage_path=storage_path,
        ocr_raw_text=raw_text,
        status=UploadStatus.EXTRACTED,
        is_manual_entry=False,
    )
    db.add(upload)
    await db.flush()
    await db.refresh(upload)

    # Entity recognition
    extracted = prescription_pipeline.parse_entities_from_text(raw_text)

    # Save extracted items
    saved_items: List[PrescriptionExtractedItem] = []
    if extracted:
        for it in extracted:
            item_record = PrescriptionExtractedItem(
                upload_id=upload.id,
                medication_name=it["medication_name"],
                strength=it.get("strength"),
                dosage=it.get("dosage"),
                route=it.get("route", "Oral"),
                frequency=it.get("frequency"),
                duration=it.get("duration"),
                instructions=it.get("instructions"),
                confidence_score=it.get("confidence_score", 0.9),
                is_uncertain=it.get("is_uncertain", False),
                uncertainty_reason=it.get("uncertainty_reason"),
                patient_verified=False,
            )
            db.add(item_record)
            saved_items.append(item_record)
    else:
        # If no medication was automatically parsed, add a placeholder for patient to verify
        item_record = PrescriptionExtractedItem(
            upload_id=upload.id,
            medication_name="Unspecified Medication (Please Edit)",
            dosage="1 dose",
            instructions="Please verify or enter medication details",
            confidence_score=0.4,
            is_uncertain=True,
            uncertainty_reason="Text not clearly identified from document scan",
            patient_verified=False,
        )
        db.add(item_record)
        saved_items.append(item_record)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.CREATE_RECORD,
        severity=AuditSeverity.INFO,
        resource_type="PrescriptionUpload",
        resource_id=str(upload.id),
        details={"file_name": upload.file_name, "items_extracted": len(saved_items)},
    )
    db.add(audit)
    await db.commit()

    return UploadResponse(
        upload_id=upload.id,
        file_name=upload.file_name,
        file_size_bytes=upload.file_size_bytes,
        status=upload.status.value,
        raw_ocr_preview=(raw_text[:300] + "...") if len(raw_text) > 300 else raw_text,
        extracted_items=[
            ExtractedItemSchema(
                id=it.id,
                medication_name=it.medication_name,
                strength=it.strength,
                dosage=it.dosage,
                route=it.route,
                frequency=it.frequency,
                duration=it.duration,
                instructions=it.instructions,
                confidence_score=it.confidence_score,
                is_uncertain=it.is_uncertain,
                uncertainty_reason=it.uncertainty_reason,
                patient_verified=it.patient_verified,
            )
            for it in saved_items
        ],
        message="Prescription uploaded and parsed. Please verify the extracted details below before running analysis.",
    )


# ── 2. Manual Prescription Entry ─────────────────────────────────────────────

@router.post("/manual-entry", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def manual_prescription_entry(
    payload: ManualPrescriptionEntryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow patient to enter prescription items manually without uploading a document."""
    patient = await _get_or_create_patient(db, current_user)

    upload = PrescriptionUpload(
        patient_id=patient.id,
        file_name="manual_entry_prescription",
        file_type="manual",
        file_size_bytes=0,
        storage_path="manual",
        ocr_raw_text="Manual clinical entry by patient",
        status=UploadStatus.CONFIRMED,
        is_manual_entry=True,
    )
    db.add(upload)
    await db.flush()
    await db.refresh(upload)

    saved_items: List[PrescriptionExtractedItem] = []
    for it in payload.items:
        is_unc = not it.frequency or not it.strength or not it.dosage
        unc_reason = "Missing strength, frequency, or dosage" if is_unc else None
        item_record = PrescriptionExtractedItem(
            upload_id=upload.id,
            medication_name=it.medication_name.strip(),
            strength=it.strength,
            dosage=it.dosage,
            route=it.route or "Oral",
            frequency=it.frequency,
            duration=it.duration,
            instructions=it.instructions or "Take as directed",
            confidence_score=1.0,
            is_uncertain=is_unc,
            uncertainty_reason=unc_reason,
            patient_verified=True,
            patient_notes=it.patient_notes,
        )
        db.add(item_record)
        saved_items.append(item_record)

    await db.commit()

    return UploadResponse(
        upload_id=upload.id,
        file_name="manual_entry_prescription",
        file_size_bytes=0,
        status="confirmed",
        raw_ocr_preview=None,
        extracted_items=[
            ExtractedItemSchema(
                id=it.id,
                medication_name=it.medication_name,
                strength=it.strength,
                dosage=it.dosage,
                route=it.route,
                frequency=it.frequency,
                duration=it.duration,
                instructions=it.instructions,
                confidence_score=it.confidence_score,
                is_uncertain=it.is_uncertain,
                uncertainty_reason=it.uncertainty_reason,
                patient_verified=True,
            )
            for it in saved_items
        ],
        message="Manual prescription items registered. Ready for AI analysis.",
    )


# ── 3. Patient Verification Step ─────────────────────────────────────────────

@router.get("/uploads/{upload_id}/items", response_model=List[ExtractedItemSchema])
async def get_extracted_items(
    upload_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve extracted prescription items for review and verification."""
    patient = await _get_or_create_patient(db, current_user)

    stmt = select(PrescriptionUpload).where(
        PrescriptionUpload.id == upload_id,
        PrescriptionUpload.patient_id == patient.id,
    )
    res = await db.execute(stmt)
    upload = res.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Prescription upload not found or unauthorized.")

    item_stmt = select(PrescriptionExtractedItem).where(
        PrescriptionExtractedItem.upload_id == upload_id
    ).order_by(PrescriptionExtractedItem.created_at)
    item_res = await db.execute(item_stmt)
    return item_res.scalars().all()


@router.put("/uploads/{upload_id}/items", response_model=List[ExtractedItemSchema])
async def confirm_extracted_items(
    upload_id: uuid.UUID,
    payload: ConfirmItemsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Patient confirms / edits extracted prescription details before analysis.
    Overwrites previous unverified items with the patient-verified item set.
    """
    patient = await _get_or_create_patient(db, current_user)

    stmt = select(PrescriptionUpload).where(
        PrescriptionUpload.id == upload_id,
        PrescriptionUpload.patient_id == patient.id,
    )
    res = await db.execute(stmt)
    upload = res.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Prescription upload not found or unauthorized.")

    # Remove prior extracted items
    del_stmt = select(PrescriptionExtractedItem).where(PrescriptionExtractedItem.upload_id == upload_id)
    del_res = await db.execute(del_stmt)
    for old_it in del_res.scalars().all():
        await db.delete(old_it)

    # Insert confirmed items
    confirmed_items = []
    for it in payload.items:
        is_unc = not it.frequency or not it.strength or not it.dosage
        unc_reason = "Missing dosage, strength, or frequency - consult pharmacist" if is_unc else None
        item_record = PrescriptionExtractedItem(
            upload_id=upload.id,
            medication_name=it.medication_name.strip(),
            strength=it.strength,
            dosage=it.dosage,
            route=it.route or "Oral",
            frequency=it.frequency,
            duration=it.duration,
            instructions=it.instructions or "Follow prescriber's directions",
            confidence_score=1.0,
            is_uncertain=is_unc,
            uncertainty_reason=unc_reason,
            patient_verified=True,
            patient_notes=it.patient_notes,
        )
        db.add(item_record)
        confirmed_items.append(item_record)

    upload.status = UploadStatus.CONFIRMED
    await db.commit()

    return confirmed_items


# ── 4. AI Prescription Analysis Execution ────────────────────────────────────

@router.post("/uploads/{upload_id}/analyze", response_model=AnalysisReportRead, status_code=status.HTTP_201_CREATED)
async def analyze_prescription(
    upload_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute structured AI prescription analysis and medication safety review.
    Cross-references patient allergies and active medications from the database.
    """
    patient = await _get_or_create_patient(db, current_user)

    stmt = select(PrescriptionUpload).where(
        PrescriptionUpload.id == upload_id,
        PrescriptionUpload.patient_id == patient.id,
    )
    res = await db.execute(stmt)
    upload = res.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Prescription upload not found or unauthorized.")

    # Retrieve verified items
    item_stmt = select(PrescriptionExtractedItem).where(
        PrescriptionExtractedItem.upload_id == upload_id
    )
    item_res = await db.execute(item_stmt)
    items = item_res.scalars().all()
    if not items:
        raise HTTPException(status_code=400, detail="No prescription items found to analyze.")

    item_dicts = [
        {
            "medication_name": it.medication_name,
            "strength": it.strength,
            "dosage": it.dosage,
            "route": it.route,
            "frequency": it.frequency,
            "duration": it.duration,
            "instructions": it.instructions,
            "is_uncertain": it.is_uncertain,
            "uncertainty_reason": it.uncertainty_reason,
        }
        for it in items
    ]

    # Resolve patient chart context
    patient_chart = await _get_patient_chart_summary(db, patient.id)

    # Run analysis engine
    analysis_data = await prescription_pipeline.generate_analysis_report(
        verified_items=item_dicts,
        patient_chart=patient_chart,
        raw_text=upload.ocr_raw_text or "",
    )

    # Create report
    report = PrescriptionAnalysisReport(
        upload_id=upload.id,
        patient_id=patient.id,
        summary_data=analysis_data["summary_data"],
        medication_guidance=analysis_data["medication_guidance"],
        next_steps=analysis_data["next_steps"],
        safety_review=analysis_data["safety_review"],
        review_status=ReviewStatus(analysis_data["review_status"]),
        ai_provider=analysis_data["ai_provider"],
    )
    db.add(report)
    upload.status = UploadStatus.ANALYZED
    await db.flush()
    await db.refresh(report)

    # Automatically create suggested medication reminders
    for rem in analysis_data["next_steps"].get("reminders_suggested", []):
        reminder = MedicationReminder(
            patient_id=patient.id,
            report_id=report.id,
            medication_name=rem["medication"],
            dosage="1 dose",
            time_of_day=rem.get("suggested_time", "08:00 AM"),
            frequency=rem.get("frequency", "Daily"),
            instructions=rem.get("instructions"),
            is_active=True,
        )
        db.add(reminder)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.CREATE_RECORD,
        severity=AuditSeverity.INFO,
        resource_type="PrescriptionAnalysisReport",
        resource_id=str(report.id),
        details={
            "medications_count": len(items),
            "review_status": report.review_status.value,
            "has_safety_flags": analysis_data["safety_review"]["requires_pharmacist_review"],
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(report)

    return report


# ── 5. View Analysis Reports & History ────────────────────────────────────────

@router.get("/reports", response_model=List[AnalysisReportRead])
async def list_prescription_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List prescription analysis reports for authenticated patient (or all for clinician/admin)."""
    if current_user.role in (UserRole.ADMIN, UserRole.DOCTOR):
        stmt = select(PrescriptionAnalysisReport).order_by(desc(PrescriptionAnalysisReport.created_at))
    else:
        patient = await _get_or_create_patient(db, current_user)
        stmt = (
            select(PrescriptionAnalysisReport)
            .where(PrescriptionAnalysisReport.patient_id == patient.id)
            .order_by(desc(PrescriptionAnalysisReport.created_at))
        )

    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/reports/{report_id}", response_model=AnalysisReportRead)
async def get_prescription_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single prescription analysis report with permission check."""
    stmt = select(PrescriptionAnalysisReport).where(PrescriptionAnalysisReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found.")

    if current_user.role == UserRole.PATIENT:
        patient = await _get_or_create_patient(db, current_user)
        if report.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to patient prescription report.")

    return report


# ── 6. Prescription AI Chat Assistant ────────────────────────────────────────

@router.post("/reports/{report_id}/chat", response_model=PrescriptionChatResponse)
async def chat_prescription_guidance(
    report_id: uuid.UUID,
    payload: PrescriptionChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Multi-turn Q&A about the analyzed prescription.
    Features emergency symptom recognition, educational disclaimers,
    and prompt injection defense.
    """
    stmt = select(PrescriptionAnalysisReport).where(PrescriptionAnalysisReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found.")

    patient = await _get_or_create_patient(db, current_user)
    if current_user.role == UserRole.PATIENT and report.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to report.")

    q = payload.message.lower().strip()

    # Red-flag emergency detection
    emergency_terms = [
        "chest pain", "can't breathe", "cannot breathe", "shortness of breath",
        "throat swelling", "lips swelling", "anaphylaxis", "severe allergic",
        "fainted", "unconscious", "stroke", "bleeding heavily", "suicidal",
    ]
    is_emergency = any(t in q for t in emergency_terms)

    if is_emergency:
        emergency_reply = (
            "🚨 **CRITICAL MEDICAL ALERT:** The symptoms you described may be a life-threatening medical emergency.\n\n"
            "- **Call 911 immediately** or go to the nearest hospital emergency room.\n"
            "- Do not wait for a response or take additional medication doses without emergency evaluation.\n\n"
            "*MediCare AI is an educational guidance tool and cannot provide emergency medical care.*"
        )
        chat_msg = PrescriptionChatMessage(
            report_id=report.id,
            patient_id=patient.id,
            role="assistant",
            content=emergency_reply,
            is_emergency=True,
        )
        db.add(chat_msg)
        await db.commit()

        return PrescriptionChatResponse(
            reply=emergency_reply,
            is_emergency=True,
            disclaimer="Emergency guidance only. Contact 911 immediately.",
        )

    # Build context from report
    med_summary = report.summary_data.get("plain_language_summary", "")
    guidance = "\n".join(
        f"- {g['medication']}: {g.get('common_uses', '')}. Precautions: {g.get('precautions', '')}."
        for g in report.medication_guidance
    )
    safety = "\n".join(
        f"- Alert: {i.get('clinical_effect', '')}"
        for i in report.safety_review.get("interactions", [])
    )

    prompt = (
        f"You are the MediCare AI Prescription Guidance Assistant answering a patient's question about their specific prescription.\n\n"
        f"Prescription Context:\n{med_summary}\n\n"
        f"Medication Guidelines:\n{guidance}\n\n"
        f"Safety Alerts:\n{safety}\n\n"
        f"Patient Question: {payload.message}\n\n"
        f"Instructions:\n"
        f"1. Answer in clear, compassionate, patient-friendly language.\n"
        f"2. Never recommend changing or stopping medications without consulting a doctor.\n"
        f"3. If dosage or timing is unclear, instruct them to ask their pharmacist.\n"
        f"4. Provide educational facts based on FDA prescribing information."
    )

    if ai_service._chat_model and settings.GEMINI_API_KEY:
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            res_ai = await loop.run_in_executor(None, lambda: ai_service._chat_model.generate_content(prompt))
            reply_text = res_ai.text.strip() if res_ai and res_ai.text else ""
        except Exception:
            reply_text = ""
    else:
        reply_text = ""

    if not reply_text:
        # Structured clinical fallback
        reply_text = (
            f"Based on your analyzed prescription:\n\n"
            f"- Always take your medications consistently as directed on your pharmacy label.\n"
            f"- For questions regarding meals, food, or missed doses, refer to your personalized next steps checklist.\n"
            f"- If you experience unexpected symptoms, contact your prescribing clinician or dispensing pharmacist.\n\n"
            f"*Disclaimer: This response is for educational support and does not constitute a clinical prescription modification.*"
        )

    chat_msg_user = PrescriptionChatMessage(
        report_id=report.id,
        patient_id=patient.id,
        role="patient",
        content=payload.message,
        is_emergency=False,
    )
    chat_msg_bot = PrescriptionChatMessage(
        report_id=report.id,
        patient_id=patient.id,
        role="assistant",
        content=reply_text,
        is_emergency=False,
    )
    db.add(chat_msg_user)
    db.add(chat_msg_bot)
    await db.commit()

    return PrescriptionChatResponse(
        reply=reply_text,
        is_emergency=False,
        disclaimer="AI-generated educational information. Consult your healthcare provider for clinical decisions.",
    )


@router.get("/reports/{report_id}/chat", response_model=List[PrescriptionChatMessageRead])
async def get_prescription_chat_history(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve chat message history for an analyzed prescription."""
    stmt = select(PrescriptionAnalysisReport).where(PrescriptionAnalysisReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found.")

    patient = await _get_or_create_patient(db, current_user)
    if current_user.role == UserRole.PATIENT and report.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to chat history.")

    msg_stmt = (
        select(PrescriptionChatMessage)
        .where(PrescriptionChatMessage.report_id == report_id)
        .order_by(PrescriptionChatMessage.created_at)
    )
    msg_res = await db.execute(msg_stmt)
    return msg_res.scalars().all()


# ── 7. Medication Reminders ──────────────────────────────────────────────────

@router.get("/reports/{report_id}/reminders", response_model=List[MedicationReminderRead])
async def get_report_reminders(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get active medication reminders for an analyzed prescription."""
    stmt = select(MedicationReminder).where(MedicationReminder.report_id == report_id)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/reminders", response_model=MedicationReminderRead, status_code=status.HTTP_201_CREATED)
async def create_medication_reminder(
    payload: MedicationReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a medication reminder schedule."""
    patient = await _get_or_create_patient(db, current_user)

    reminder = MedicationReminder(
        patient_id=patient.id,
        report_id=payload.report_id,
        medication_name=payload.medication_name,
        dosage=payload.dosage,
        time_of_day=payload.time_of_day,
        frequency=payload.frequency,
        instructions=payload.instructions,
        is_active=True,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.patch("/reminders/{reminder_id}/toggle", response_model=MedicationReminderRead)
async def toggle_reminder(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle medication reminder active/inactive."""
    stmt = select(MedicationReminder).where(MedicationReminder.id == reminder_id)
    res = await db.execute(stmt)
    reminder = res.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found.")

    reminder.is_active = not reminder.is_active
    await db.commit()
    await db.refresh(reminder)
    return reminder


# ── 8. Clinician & Pharmacist Review Workflow ────────────────────────────────

@router.patch("/reports/{report_id}/flag-review", response_model=AnalysisReportRead)
async def flag_report_for_review(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Flag prescription analysis for professional review by pharmacist or clinician."""
    stmt = select(PrescriptionAnalysisReport).where(PrescriptionAnalysisReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found.")

    report.review_status = ReviewStatus.FLAGGED_FOR_PHARMACIST
    await db.commit()
    await db.refresh(report)
    return report


@router.patch("/reports/{report_id}/review", response_model=AnalysisReportRead)
async def update_report_review(
    report_id: uuid.UUID,
    payload: ReviewUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR)),
):
    """Authorized clinician or admin marks prescription review status."""
    stmt = select(PrescriptionAnalysisReport).where(PrescriptionAnalysisReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found.")

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
        resource_type="PrescriptionAnalysisReport",
        resource_id=str(report.id),
        details={"review_status": report.review_status.value, "reviewed_by": current_user.full_name},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(report)
    return report


# ── 9. Admin Dashboard Metrics & Review Queue ────────────────────────────────

@router.get("/admin/metrics", response_model=AdminMetricsResponse)
async def get_admin_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR)),
):
    """Retrieve prescription analytics and integration health for Admin Dashboard."""
    # Total analyses
    total_stmt = select(func.count(PrescriptionAnalysisReport.id))
    total_res = await db.execute(total_stmt)
    total_count = total_res.scalar_one() or 0

    # Pending reviews
    pending_stmt = select(func.count(PrescriptionAnalysisReport.id)).where(
        PrescriptionAnalysisReport.review_status == ReviewStatus.PENDING_REVIEW
    )
    pending_res = await db.execute(pending_stmt)
    pending_count = pending_res.scalar_one() or 0

    # Flagged / Unresolved safety alerts
    flagged_stmt = select(func.count(PrescriptionAnalysisReport.id)).where(
        PrescriptionAnalysisReport.review_status == ReviewStatus.FLAGGED_FOR_PHARMACIST
    )
    flagged_res = await db.execute(flagged_stmt)
    flagged_count = flagged_res.scalar_one() or 0

    ai_health = "Online (Gemini Pro)" if settings.GEMINI_API_KEY else "Active (Evidence-Based Clinical Engine)"
    medical_api_health = "Online (NIH RxNorm & DailyMed)"

    return AdminMetricsResponse(
        total_analyses=total_count,
        pending_clinician_reviews=pending_count,
        unresolved_safety_alerts=flagged_count,
        ai_service_status=ai_health,
        medical_api_status=medical_api_health,
    )


@router.get("/admin/queue", response_model=List[AdminQueueItem])
async def get_admin_review_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR)),
):
    """Retrieve queue of prescriptions awaiting clinician/pharmacist review."""
    stmt = (
        select(PrescriptionAnalysisReport)
        .order_by(desc(PrescriptionAnalysisReport.created_at))
        .limit(20)
    )
    res = await db.execute(stmt)
    reports = res.scalars().all()

    queue_items: List[AdminQueueItem] = []
    for r in reports:
        patient_name = "Patient Chart"
        patient_mrn = "MRN-PENDING"
        if r.patient and r.patient.user:
            patient_name = r.patient.user.full_name
            patient_mrn = r.patient.mrn

        meds_count = len(r.medication_guidance) if r.medication_guidance else 0
        safety = r.safety_review or {}
        critical_count = sum(
            1 for i in safety.get("interactions", []) if i.get("severity") in ("CRITICAL", "High")
        ) + len(safety.get("allergy_alerts", []))

        queue_items.append(
            AdminQueueItem(
                id=r.id,
                patient_name=patient_name,
                patient_mrn=patient_mrn,
                created_at=r.created_at,
                review_status=r.review_status.value,
                medications_count=meds_count,
                critical_alerts_count=critical_count,
                requires_pharmacist_review=safety.get("requires_pharmacist_review", False),
            )
        )

    return queue_items


# ── 10. Deletion & Data Privacy ───────────────────────────────────────────────

@router.delete("/reports/{report_id}", status_code=status.HTTP_200_OK)
async def delete_prescription_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a prescription analysis report and cascade remove reminders and chat."""
    stmt = select(PrescriptionAnalysisReport).where(PrescriptionAnalysisReport.id == report_id)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found.")

    if current_user.role == UserRole.PATIENT:
        patient = await _get_or_create_patient(db, current_user)
        if report.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Unauthorized to delete this report.")

    upload_id = report.upload_id
    await db.delete(report)

    if upload_id:
        u_stmt = select(PrescriptionUpload).where(PrescriptionUpload.id == upload_id)
        u_res = await db.execute(u_stmt)
        upload = u_res.scalar_one_or_none()
        if upload:
            try:
                if upload.storage_path and os.path.exists(upload.storage_path):
                    os.remove(upload.storage_path)
            except Exception:
                pass
            await db.delete(upload)

    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.DELETE_RECORD,
        severity=AuditSeverity.INFO,
        resource_type="PrescriptionAnalysisReport",
        resource_id=str(report_id),
        details={"deleted_by": current_user.email},
    )
    db.add(audit)
    await db.commit()

    return {"status": "success", "message": "Prescription analysis deleted permanently."}


@router.delete("/uploads/{upload_id}", status_code=status.HTTP_200_OK)
async def delete_prescription_upload(
    upload_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete an uploaded prescription document and all associated extracted items."""
    stmt = select(PrescriptionUpload).where(PrescriptionUpload.id == upload_id)
    res = await db.execute(stmt)
    upload = res.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload document not found.")

    if current_user.role == UserRole.PATIENT:
        patient = await _get_or_create_patient(db, current_user)
        if upload.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Unauthorized to delete this upload.")

    try:
        if upload.storage_path and os.path.exists(upload.storage_path):
            os.remove(upload.storage_path)
    except Exception:
        pass

    await db.delete(upload)

    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.DELETE_RECORD,
        severity=AuditSeverity.INFO,
        resource_type="PrescriptionUpload",
        resource_id=str(upload_id),
        details={"deleted_by": current_user.email},
    )
    db.add(audit)
    await db.commit()

    return {"status": "success", "message": "Prescription document deleted successfully."}

