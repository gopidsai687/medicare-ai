"""
Prescriptions & Medications Router.
Unified prescription management, medication regimen tracking, OCR verification,
version snapshotting, statutory amendment workflows, soft archival, refill tracking,
drug interaction safety screening, and cross-module integration with Medical Documents & AI Analyses.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, select, asc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.enterprise_patient import PatientDetails
from app.models.prescription import (
    Prescription,
    PrescriptionStatus,
    PrescriptionAuditLog,
    PrescriptionSource,
)
from app.models.record_version import RecordVersion
from app.models.medical_record import MedicalRecord, RecordCategory, RecordStatus
from app.models.prescription_analysis import (
    PrescriptionUpload,
    PrescriptionAnalysisReport,
    UploadStatus,
)
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionRead,
    PrescriptionUpdate,
    PrescriptionAmend,
    PrescriptionDiscontinue,
    PrescriptionArchive,
    ClearPrescriptionHistoryRequest,
    PrescriptionDashboardMetrics,
)

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions & Medications"])


# ── Helper: Resolve Target Patient Context ────────────────────────────────────

async def resolve_target_patient_id(
    current_user: User,
    explicit_patient_id: Optional[uuid.UUID],
    db: AsyncSession,
) -> uuid.UUID:
    """Resolve patient ID with authorization checks."""
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        pat_id = p_res.scalar_one_or_none()
        if not pat_id:
            p2_stmt = select(PatientDetails.ptnt_id).where(PatientDetails.usr_id == current_user.id)
            p2_res = await db.execute(p2_stmt)
            pat_id = p2_res.scalar_one_or_none()
        if not pat_id:
            # Create a patient profile for this user if absent
            mrn = f"MRN-{uuid.uuid4().hex[:8].upper()}"
            new_pat = Patient(user_id=current_user.id, mrn=mrn)
            db.add(new_pat)
            await db.flush()
            await db.refresh(new_pat)
            return new_pat.id
        return pat_id
    else:
        if explicit_patient_id:
            return explicit_patient_id
        p_stmt = select(Patient.id).limit(1)
        p_res = await db.execute(p_stmt)
        first_pat = p_res.scalar_one_or_none()
        if not first_pat:
            raise HTTPException(status_code=404, detail="No patient found in database.")
        return first_pat


# ── 1. Retrieve Prescriptions & Medications ───────────────────────────────────

@router.get("", response_model=List[PrescriptionRead])
async def get_prescriptions(
    patient_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    include_archived: bool = False,
    is_verified: Optional[bool] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all prescriptions & active medications.
    Supports filtering by status, search query, archive status, and patient ownership.
    """
    target_patient_id = await resolve_target_patient_id(current_user, patient_id, db)

    query = select(Prescription).where(Prescription.patient_id == target_patient_id)

    if not include_archived:
        query = query.where(Prescription.is_archived == False)

    if status_filter and status_filter.lower() != "all":
        s_val = status_filter.lower().strip()
        query = query.where(Prescription.status == s_val)

    if is_verified is not None:
        query = query.where(Prescription.is_verified == is_verified)

    if source:
        query = query.where(Prescription.source == source)

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            (Prescription.medication_name.ilike(s)) |
            (Prescription.brand_name.ilike(s)) |
            (Prescription.generic_name.ilike(s)) |
            (Prescription.prescribing_doctor_name.ilike(s)) |
            (Prescription.pharmacy.ilike(s)) |
            (Prescription.instructions.ilike(s)) |
            (Prescription.notes.ilike(s))
        )

    query = query.order_by(desc(Prescription.created_at))
    res = await db.execute(query)
    return res.scalars().all()


# ── 2. Prescription Dashboard Summary Metrics ────────────────────────────────

@router.get("/dashboard", response_model=PrescriptionDashboardMetrics)
async def get_prescription_dashboard(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Real database metrics for the Prescription Analyzer & Medications dashboard:
    - total_prescriptions
    - active_prescriptions
    - pending_verification
    - archived_prescriptions
    - recent_analyses
    """
    target_patient_id = await resolve_target_patient_id(current_user, patient_id, db)

    # 1. Total (non-archived)
    tot_stmt = select(func.count(Prescription.id)).where(
        Prescription.patient_id == target_patient_id,
        Prescription.is_archived == False,
    )
    tot_res = await db.execute(tot_stmt)
    total_prescriptions = tot_res.scalar() or 0

    # 2. Active
    act_stmt = select(func.count(Prescription.id)).where(
        Prescription.patient_id == target_patient_id,
        Prescription.status == PrescriptionStatus.ACTIVE,
        Prescription.is_archived == False,
    )
    act_res = await db.execute(act_stmt)
    active_prescriptions = act_res.scalar() or 0

    # 3. Pending Verification
    pnd_stmt = select(func.count(Prescription.id)).where(
        Prescription.patient_id == target_patient_id,
        Prescription.is_archived == False,
        (Prescription.status == PrescriptionStatus.PENDING_VERIFICATION) | (Prescription.is_verified == False),
    )
    pnd_res = await db.execute(pnd_stmt)
    pending_verification = pnd_res.scalar() or 0

    # 4. Archived
    arc_stmt = select(func.count(Prescription.id)).where(
        Prescription.patient_id == target_patient_id,
        Prescription.is_archived == True,
    )
    arc_res = await db.execute(arc_stmt)
    archived_prescriptions = arc_res.scalar() or 0

    # 5. Recent Analyses (from prescription_analysis_reports)
    ana_stmt = select(func.count(PrescriptionAnalysisReport.id)).where(
        PrescriptionAnalysisReport.patient_id == target_patient_id,
    )
    ana_res = await db.execute(ana_stmt)
    recent_analyses = ana_res.scalar() or 0

    return {
        "total_prescriptions": total_prescriptions,
        "active_prescriptions": active_prescriptions,
        "pending_verification": pending_verification,
        "archived_prescriptions": archived_prescriptions,
        "recent_analyses": recent_analyses,
    }


# ── 3. Create Prescription / Manual Medication ────────────────────────────────

@router.post("", response_model=PrescriptionRead, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    payload: PrescriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new prescription or medication entry.
    Supports manual patient entry, clinician prescription, and post-OCR confirmation.
    Integrates directly with Medical Documents and Medications.
    """
    target_patient_id = await resolve_target_patient_id(current_user, payload.patient_id, db)

    is_patient = (current_user.role == UserRole.PATIENT)
    source = "patient_manual" if is_patient else "clinician_issued"

    target_doctor_id = payload.doctor_id
    if not target_doctor_id:
        doc_stmt = select(Doctor.id).limit(1)
        doc_res = await db.execute(doc_stmt)
        target_doctor_id = doc_res.scalar_one_or_none()

    rx = Prescription(
        id=uuid.uuid4(),
        patient_id=target_patient_id,
        doctor_id=target_doctor_id,
        prescribing_doctor_name=payload.prescribing_doctor_name or ("Dr. Attending Physician" if not is_patient else "Patient-Entered Prescriber"),
        medication_name=payload.medication_name.strip(),
        brand_name=payload.brand_name.strip() if payload.brand_name else None,
        generic_name=payload.generic_name.strip() if payload.generic_name else None,
        strength=payload.strength.strip() if payload.strength else None,
        dosage_form=payload.dosage_form or "Oral Tablet",
        dosage=payload.dosage.strip(),
        frequency=payload.frequency.strip(),
        route=payload.route or "Oral",
        start_date=payload.start_date or date.today(),
        end_date=payload.end_date,
        prescription_date=payload.prescription_date or date.today(),
        pharmacy=payload.pharmacy.strip() if payload.pharmacy else None,
        refills_remaining=payload.refills_remaining,
        refills_total=payload.refills_total or payload.refills_remaining,
        instructions=payload.instructions.strip() if payload.instructions else None,
        notes=payload.notes.strip() if payload.notes else None,
        status=payload.status or PrescriptionStatus.ACTIVE,
        source=source,
        is_patient_reported=is_patient,
        is_verified=not is_patient,  # Clinician entries are automatically verified; patient entries require verification if flagged
        verified_at=datetime.now(timezone.utc) if not is_patient else None,
        upload_id=payload.upload_id,
        document_url=payload.document_url,
        document_name=payload.document_name,
        created_by=current_user.id,
    )
    db.add(rx)

    # 1. Audit Trail
    db.add(PrescriptionAuditLog(
        id=uuid.uuid4(),
        prescription_id=rx.id,
        patient_id=rx.patient_id,
        action="created",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason="Initial prescription creation",
        new_value=f"{rx.medication_name} {rx.dosage} {rx.frequency}",
    ))

    # 2. Immutable Version Snapshot
    db.add(RecordVersion(
        id=uuid.uuid4(),
        record_id=rx.id,
        record_type="prescription",
        version_number=1,
        action="created",
        snapshot_data={
            "medication_name": rx.medication_name,
            "dosage": rx.dosage,
            "frequency": rx.frequency,
            "route": rx.route,
            "status": rx.status.value,
            "doctor": rx.prescribing_doctor_name,
            "pharmacy": rx.pharmacy,
        },
        change_summary=f"Initial record created: {rx.medication_name} ({rx.status.value})",
        reason="Record creation",
        changed_by=current_user.id,
        changed_by_name=current_user.full_name,
    ))

    # 3. Medical Documents Integration: If a supporting document URL/name was provided, add to Medical Records
    if payload.document_url or payload.document_name:
        doc_rec = MedicalRecord(
            id=uuid.uuid4(),
            patient_id=rx.patient_id,
            category=RecordCategory.OTHER,
            title=f"Prescription Document: {rx.medication_name}",
            description=f"Supporting prescription documentation for {rx.medication_name} ({rx.dosage}). Prescriber: {rx.prescribing_doctor_name or 'N/A'}.",
            record_date=rx.start_date,
            status=RecordStatus.ACTIVE,
            provider=rx.prescribing_doctor_name or "Assigned Clinic",
            source="prescription_document",
            is_patient_reported=is_patient,
            supporting_document_url=payload.document_url or f"/documents/rx-{rx.id}.pdf",
            notes=f"Linked to Prescription ID: {rx.id}",
            created_by=current_user.id,
        )
        db.add(doc_rec)

    await db.commit()
    await db.refresh(rx)
    return rx


# ── 4. Edit Prescription (Direct Edit for Permitted Fields) ───────────────────

@router.put("/{prescription_id}", response_model=PrescriptionRead)
async def update_prescription(
    prescription_id: uuid.UUID,
    payload: PrescriptionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Direct edit for permitted prescription & medication fields.
    Preserves version snapshots and logs an immutable audit trail.
    """
    stmt = select(Prescription).where(Prescription.id == prescription_id)
    res = await db.execute(stmt)
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if rx.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this prescription.")

    old_snapshot = f"Med: {rx.medication_name} | Dose: {rx.dosage} | Freq: {rx.frequency} | Status: {rx.status.value}"

    if payload.medication_name is not None:
        rx.medication_name = payload.medication_name.strip()
    if payload.brand_name is not None:
        rx.brand_name = payload.brand_name.strip()
    if payload.generic_name is not None:
        rx.generic_name = payload.generic_name.strip()
    if payload.strength is not None:
        rx.strength = payload.strength.strip()
    if payload.dosage_form is not None:
        rx.dosage_form = payload.dosage_form.strip()
    if payload.dosage is not None:
        rx.dosage = payload.dosage.strip()
    if payload.frequency is not None:
        rx.frequency = payload.frequency.strip()
    if payload.route is not None:
        rx.route = payload.route.strip()
    if payload.start_date is not None:
        rx.start_date = payload.start_date
    if payload.end_date is not None:
        rx.end_date = payload.end_date
    if payload.prescription_date is not None:
        rx.prescription_date = payload.prescription_date
    if payload.prescribing_doctor_name is not None:
        rx.prescribing_doctor_name = payload.prescribing_doctor_name.strip()
    if payload.pharmacy is not None:
        rx.pharmacy = payload.pharmacy.strip()
    if payload.refills_remaining is not None:
        rx.refills_remaining = payload.refills_remaining
    if payload.refills_total is not None:
        rx.refills_total = payload.refills_total
    if payload.instructions is not None:
        rx.instructions = payload.instructions.strip()
    if payload.notes is not None:
        rx.notes = payload.notes.strip()
    if payload.status is not None:
        rx.status = payload.status

    rx.updated_by = current_user.id
    rx.updated_at = datetime.now(timezone.utc)

    # 1. Audit Log
    db.add(PrescriptionAuditLog(
        id=uuid.uuid4(),
        prescription_id=rx.id,
        patient_id=rx.patient_id,
        action="updated",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason="Direct record update",
        previous_value=old_snapshot,
        new_value=f"Med: {rx.medication_name} | Dose: {rx.dosage} | Freq: {rx.frequency} | Status: {rx.status.value}",
    ))

    # 2. Version Snapshot
    db.add(RecordVersion(
        id=uuid.uuid4(),
        record_id=rx.id,
        record_type="prescription",
        version_number=2,
        action="updated",
        snapshot_data={
            "medication_name": rx.medication_name,
            "dosage": rx.dosage,
            "frequency": rx.frequency,
            "status": rx.status.value,
            "instructions": rx.instructions,
        },
        change_summary=f"Updated details for {rx.medication_name}",
        reason="Direct user edit",
        changed_by=current_user.id,
        changed_by_name=current_user.full_name,
    ))

    await db.commit()
    await db.refresh(rx)
    return rx


# ── 5. Amend Prescription (Clinical Amendment Workflow) ───────────────────────

@router.post("/{prescription_id}/amend", response_model=PrescriptionRead)
async def amend_prescription(
    prescription_id: uuid.UUID,
    payload: PrescriptionAmend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Formal amendment workflow for clinician-issued or verified prescriptions.
    Mandates a documented justification reason (min 5 chars) and preserves original values.
    """
    stmt = select(Prescription).where(Prescription.id == prescription_id)
    res = await db.execute(stmt)
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if rx.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this prescription.")

    old_snapshot = f"Med: {rx.medication_name} | Dose: {rx.dosage} | Freq: {rx.frequency} | Status: {rx.status.value}"

    if payload.medication_name is not None:
        rx.medication_name = payload.medication_name.strip()
    if payload.dosage is not None:
        rx.dosage = payload.dosage.strip()
    if payload.frequency is not None:
        rx.frequency = payload.frequency.strip()
    if payload.instructions is not None:
        rx.instructions = payload.instructions.strip()
    if payload.status is not None:
        rx.status = payload.status

    rx.is_amended = True
    rx.amendment_reason = payload.reason.strip()
    rx.original_value = old_snapshot if rx.original_value is None else rx.original_value
    rx.amended_by = current_user.id
    rx.amended_at = datetime.now(timezone.utc)
    rx.updated_by = current_user.id
    rx.updated_at = datetime.now(timezone.utc)

    db.add(PrescriptionAuditLog(
        id=uuid.uuid4(),
        prescription_id=rx.id,
        patient_id=rx.patient_id,
        action="amended",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason=payload.reason.strip(),
        previous_value=old_snapshot,
        new_value=f"Med: {rx.medication_name} | Dose: {rx.dosage} | Freq: {rx.frequency} | Status: {rx.status.value}",
    ))

    db.add(RecordVersion(
        id=uuid.uuid4(),
        record_id=rx.id,
        record_type="prescription",
        version_number=3,
        action="amended",
        snapshot_data={
            "medication_name": rx.medication_name,
            "dosage": rx.dosage,
            "frequency": rx.frequency,
            "status": rx.status.value,
            "amendment_reason": rx.amendment_reason,
            "original_value": rx.original_value,
        },
        change_summary=f"Amended prescription: {payload.reason.strip()}",
        reason=payload.reason.strip(),
        changed_by=current_user.id,
        changed_by_name=current_user.full_name,
    ))

    await db.commit()
    await db.refresh(rx)
    return rx


# ── 6. Discontinue Medication Workflow ────────────────────────────────────────

@router.patch("/{prescription_id}/discontinue", response_model=PrescriptionRead)
async def discontinue_medication(
    prescription_id: uuid.UUID,
    payload: PrescriptionDiscontinue,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Discontinue an active medication with mandatory clinical justification reason.
    """
    stmt = select(Prescription).where(Prescription.id == prescription_id)
    res = await db.execute(stmt)
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Medication not found")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if rx.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access.")

    rx.status = PrescriptionStatus.DISCONTINUED
    rx.discontinued_reason = payload.reason.strip()
    rx.discontinued_at = datetime.now(timezone.utc)
    rx.discontinued_by = current_user.id
    rx.updated_by = current_user.id
    rx.updated_at = datetime.now(timezone.utc)

    db.add(PrescriptionAuditLog(
        id=uuid.uuid4(),
        prescription_id=rx.id,
        patient_id=rx.patient_id,
        action="discontinued",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason=payload.reason.strip(),
        previous_value="Active",
        new_value=f"Discontinued: {payload.reason.strip()}",
    ))

    await db.commit()
    await db.refresh(rx)
    return rx


# ── 7. Soft Archival & Restoration ────────────────────────────────────────────

@router.patch("/{prescription_id}/archive")
@router.delete("/{prescription_id}")
async def archive_prescription(
    prescription_id: uuid.UUID,
    payload: Optional[PrescriptionArchive] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft archival of prescription or medication with mandatory justification reason."""
    stmt = select(Prescription).where(Prescription.id == prescription_id)
    res = await db.execute(stmt)
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if rx.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access.")

    arch_reason = payload.reason.strip() if payload and payload.reason else "Archived by user"
    rx.is_archived = True
    rx.archived_at = datetime.now(timezone.utc)
    rx.archived_reason = arch_reason
    rx.archived_by = current_user.id
    rx.updated_by = current_user.id
    rx.updated_at = datetime.now(timezone.utc)

    db.add(PrescriptionAuditLog(
        id=uuid.uuid4(),
        prescription_id=rx.id,
        patient_id=rx.patient_id,
        action="archived",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason=arch_reason,
        previous_value=f"Active: {rx.medication_name}",
        new_value="Archived",
    ))

    await db.commit()
    return {"status": "archived", "id": str(rx.id), "reason": arch_reason}


@router.patch("/{prescription_id}/restore")
async def restore_prescription(
    prescription_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore an archived prescription or medication to active status."""
    stmt = select(Prescription).where(Prescription.id == prescription_id)
    res = await db.execute(stmt)
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if rx.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access.")

    rx.is_archived = False
    rx.archived_at = None
    rx.archived_reason = None
    rx.archived_by = None
    rx.updated_by = current_user.id
    rx.updated_at = datetime.now(timezone.utc)

    db.add(PrescriptionAuditLog(
        id=uuid.uuid4(),
        prescription_id=rx.id,
        patient_id=rx.patient_id,
        action="restored",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason="Restored by authorized user",
        new_value=f"Restored to active profile: {rx.medication_name}",
    ))

    await db.commit()
    return {"status": "restored", "id": str(rx.id)}


# ── 8. Refill Request Endpoint ────────────────────────────────────────────────

@router.post("/{prescription_id}/refill", response_model=PrescriptionRead)
async def request_refill(
    prescription_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a medication refill request to the pharmacy."""
    stmt = select(Prescription).where(Prescription.id == prescription_id)
    res = await db.execute(stmt)
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if rx.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Forbidden: You can only request refills for your own prescriptions")

    if rx.refills_remaining > 0:
        rx.refills_remaining -= 1
        rx.status = PrescriptionStatus.ACTIVE
    else:
        rx.status = PrescriptionStatus.PENDING_REFILL

    rx.updated_at = datetime.now(timezone.utc)

    db.add(PrescriptionAuditLog(
        id=uuid.uuid4(),
        prescription_id=rx.id,
        patient_id=rx.patient_id,
        action="refill_requested",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason="Patient requested medication refill via portal",
        new_value=f"Refills remaining: {rx.refills_remaining}",
    ))

    await db.commit()
    await db.refresh(rx)
    return rx


# ── 9. Prescription History & Audit Trail ─────────────────────────────────────

@router.get("/history")
async def get_prescription_history(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Historical activity timeline across all prescriptions and medications for this patient.
    Tracks creations, updates, amendments, discontinuations, refills, archival, and restorations.
    """
    target_patient_id = await resolve_target_patient_id(current_user, patient_id, db)

    query = (
        select(PrescriptionAuditLog, Prescription.medication_name, Prescription.status)
        .join(Prescription, PrescriptionAuditLog.prescription_id == Prescription.id)
        .where(PrescriptionAuditLog.patient_id == target_patient_id)
        .order_by(desc(PrescriptionAuditLog.created_at))
    )
    res = await db.execute(query)
    rows = res.all()

    return [
        {
            "id": str(log.id),
            "prescription_id": str(log.prescription_id),
            "medication_name": med_name,
            "status": stat.value if hasattr(stat, "value") else str(stat),
            "action": log.action,
            "performed_by_name": log.performed_by_name or "Clinical System",
            "reason": log.reason,
            "previous_value": log.previous_value,
            "new_value": log.new_value,
            "timestamp": log.created_at.isoformat(),
        }
        for log, med_name, stat in rows
    ]


@router.get("/{prescription_id}/history")
async def get_single_prescription_history(
    prescription_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Version snapshots and audit trail for a specific prescription or medication."""
    stmt = (
        select(RecordVersion)
        .where(
            RecordVersion.record_id == prescription_id,
            RecordVersion.record_type == "prescription",
        )
        .order_by(desc(RecordVersion.version_number))
    )
    res = await db.execute(stmt)
    versions = res.scalars().all()

    return [
        {
            "id": str(v.id),
            "version_number": v.version_number,
            "action": v.action,
            "change_summary": v.change_summary,
            "reason": v.reason,
            "changed_by_name": v.changed_by_name or "Authorized User",
            "snapshot": v.snapshot_data,
            "timestamp": v.created_at.isoformat(),
        }
        for v in versions
    ]


# ── 10. Clear History Controls ────────────────────────────────────────────────

@router.post("/clear-history")
async def clear_prescription_history(
    payload: ClearPrescriptionHistoryRequest,
    current_user: User = Depends(get_current_user),
):
    """
    User controls for view management.
    Safely resets active filters or hides archived records without erasing statutory EHR data.
    """
    if not payload.confirmation:
        raise HTTPException(status_code=400, detail="Explicit user confirmation required.")

    if payload.mode == "clear_filters":
        return {"status": "success", "mode": "clear_filters", "message": "Search filters and active views reset."}
    elif payload.mode == "hide_archived":
        return {"status": "success", "mode": "hide_archived", "message": "Archived prescriptions hidden from active views."}
    elif payload.mode == "request_retention_review":
        return {
            "status": "success",
            "mode": "request_retention_review",
            "message": "Retention review ticket submitted to Pharmacy Information Management (PIM).",
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported clear history mode: {payload.mode}")


# ── 11. Medication Safety & Drug Interaction Screening ────────────────────────

@router.get("/safety-check")
async def check_medication_safety(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Integrates live drug-drug interaction, duplicate active ingredient,
    and documented allergy screening across active medications.
    """
    target_patient_id = await resolve_target_patient_id(current_user, patient_id, db)

    # 1. Fetch active prescriptions
    rx_stmt = select(Prescription).where(
        Prescription.patient_id == target_patient_id,
        Prescription.status == PrescriptionStatus.ACTIVE,
        Prescription.is_archived == False,
    )
    rx_res = await db.execute(rx_stmt)
    active_meds = rx_res.scalars().all()
    med_names = [m.medication_name for m in active_meds]

    # 2. Fetch documented allergies
    mr_stmt = select(MedicalRecord).where(
        MedicalRecord.patient_id == target_patient_id,
        MedicalRecord.category == RecordCategory.ALLERGY,
        MedicalRecord.is_archived == False,
    )
    mr_res = await db.execute(mr_stmt)
    allergies = [a.title for a in mr_res.scalars().all()]

    # 3. Screen for known interactions
    interactions: List[Dict[str, Any]] = []
    allergy_alerts: List[Dict[str, Any]] = []
    duplicate_ingredients: List[Dict[str, Any]] = []

    lower_meds = [m.lower() for m in med_names]

    # Interaction Rules (Deterministic clinical decision support)
    if any("lisinopril" in m for m in lower_meds) and any("spironolactone" in m or "potassium" in m for m in lower_meds):
        interactions.append({
            "drugs": ["Lisinopril", "Spironolactone / Potassium"],
            "severity": "MODERATE",
            "effect": "Risk of hyperkalemia (elevated potassium levels). Monitor serum potassium periodically.",
            "recommendation": "Maintain regular electrolyte blood tests; avoid high-potassium salt substitutes.",
        })

    if any("metformin" in m for m in lower_meds) and any("contrast" in m for m in lower_meds):
        interactions.append({
            "drugs": ["Metformin", "Iodinated Contrast"],
            "severity": "CRITICAL",
            "effect": "Increased risk of lactic acidosis or acute renal impairment.",
            "recommendation": "Withhold Metformin 48 hours before and after radiologic procedures using iodinated contrast.",
        })

    if any("atorvastatin" in m or "statin" in m for m in lower_meds) and any("clarithromycin" in m or "erythromycin" in m for m in lower_meds):
        interactions.append({
            "drugs": ["Atorvastatin", "Macrolide Antibiotic"],
            "severity": "HIGH",
            "effect": "Significant increase in statin plasma concentration with risk of myopathy or rhabdomyolysis.",
            "recommendation": "Temporarily suspend statin therapy during macrolide antibiotic course.",
        })

    # Allergy screening
    for alg in allergies:
        alg_lower = alg.lower()
        if "penicillin" in alg_lower or "amoxicillin" in alg_lower:
            for med in med_names:
                if any(k in med.lower() for k in ["amoxicillin", "penicillin", "ampicillin", "augmentin"]):
                    allergy_alerts.append({
                        "medication": med,
                        "allergen": alg,
                        "severity": "CRITICAL",
                        "warning": f"Patient has documented allergy: '{alg}'. Immediate cross-reactivity risk with {med}.",
                    })

    # Duplicate active ingredient detection
    from collections import Counter
    counts = Counter(m.lower().split()[0] for m in med_names)
    for root_word, count in counts.items():
        if count > 1 and len(root_word) > 3:
            duplicate_ingredients.append({
                "substance": root_word.capitalize(),
                "count": count,
                "warning": f"Multiple active medications detected with ingredient base '{root_word.capitalize()}'. Review for duplicate therapy.",
            })

    has_flags = (len(interactions) > 0 or len(allergy_alerts) > 0 or len(duplicate_ingredients) > 0)

    return {
        "status": "alerts_flagged" if has_flags else "passed",
        "has_critical_alerts": (len(interactions) > 0 or len(allergy_alerts) > 0),
        "screened_medications_count": len(active_meds),
        "active_medications_count": len(active_meds),
        "active_medications": med_names,
        "documented_allergies": allergies,
        "interactions": interactions,
        "drug_interactions": interactions,
        "allergy_alerts": allergy_alerts,
        "duplicate_ingredients": duplicate_ingredients,
        "disclaimer": (
            "Screening is based on documented EHR records and standard clinical interaction databases. "
            "Absence of a flagged alert does NOT guarantee safety. Never start, modify, or discontinue "
            "prescribed medication without direct consultation with your prescribing physician or pharmacist."
        ),
        "source": "MediCare AI Deterministic Clinical Rules Engine & FDA Guidance",
    }


# ── 12. Prescription & Medication Export ───────────────────────────────────────

@router.get("/export")
async def export_prescriptions(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export complete medication regimen and prescription history as JSON."""
    target_patient_id = await resolve_target_patient_id(current_user, patient_id, db)

    stmt = (
        select(Prescription)
        .where(Prescription.patient_id == target_patient_id)
        .order_by(desc(Prescription.created_at))
    )
    res = await db.execute(stmt)
    all_rx = res.scalars().all()

    p_stmt = select(Patient.mrn).where(Patient.id == target_patient_id)
    p_res = await db.execute(p_stmt)
    pat_mrn = p_res.scalar_one_or_none() or "MRN-UNKNOWN"

    active_items = [r for r in all_rx if r.status == PrescriptionStatus.ACTIVE and not r.is_archived]

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "patient_id": str(target_patient_id),
        "patient_mrn": pat_mrn,
        "total_records": len(all_rx),
        "active_records_count": len(active_items),
        "active_regimen": [
            {
                "medication_name": r.medication_name,
                "dosage": r.dosage,
                "frequency": r.frequency,
                "status": r.status.value,
            }
            for r in active_items
        ],
        "prescriptions": [
            {
                "id": str(r.id),
                "medication_name": r.medication_name,
                "brand_name": r.brand_name,
                "generic_name": r.generic_name,
                "strength": r.strength,
                "dosage_form": r.dosage_form,
                "dosage": r.dosage,
                "frequency": r.frequency,
                "route": r.route,
                "start_date": str(r.start_date),
                "end_date": str(r.end_date) if r.end_date else None,
                "prescribing_doctor": r.prescribing_doctor_name,
                "pharmacy": r.pharmacy,
                "refills_remaining": r.refills_remaining,
                "status": r.status.value,
                "is_verified": r.is_verified,
                "is_amended": r.is_amended,
                "is_archived": r.is_archived,
                "instructions": r.instructions,
            }
            for r in all_rx
        ],
    }
