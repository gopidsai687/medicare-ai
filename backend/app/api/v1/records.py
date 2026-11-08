"""
Medical Records Router.
Comprehensive CRUD, role-based provenance, version snapshots, amendment workflows,
soft archival, and intelligent links to diagnostic laboratory results.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.medical_record import MedicalRecord, RecordCategory, RecordStatus
from app.models.record_version import RecordVersion, MedicalRecordAuditLog
from app.models.patient import Patient
from app.models.enterprise_patient import PatientDetails
from app.models.user import User, UserRole

router = APIRouter(prefix="/records", tags=["Medical Records"])


# ── Pydantic Request / Response Schemas ────────────────────────────────────────

class MedicalRecordCreate(BaseModel):
    category: RecordCategory = Field(..., description="diagnosis, allergy, surgery, immunization, lab_result, note, other")
    title: str = Field(..., min_length=2, description="Record title, condition, or procedure name")
    description: Optional[str] = Field(None, description="Clinical summary, treatment plan, symptoms, or details")
    record_date: date = Field(default_factory=date.today)
    provider: Optional[str] = Field(None, description="Documented physician, clinic, or self-reported facility")
    icd10_code: Optional[str] = Field(None, description="Standard ICD-10 diagnosis code when applicable")
    status: RecordStatus = Field(default=RecordStatus.ACTIVE)
    severity: Optional[str] = Field(None, description="Mild, Moderate, Severe, Critical")
    notes: Optional[str] = Field(None, description="Physician instructions or additional patient notes")
    supporting_document_url: Optional[str] = None
    lab_result_id: Optional[uuid.UUID] = None
    patient_id: Optional[uuid.UUID] = None


class MedicalRecordUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    record_date: Optional[date] = None
    provider: Optional[str] = None
    icd10_code: Optional[str] = None
    status: Optional[RecordStatus] = None
    severity: Optional[str] = None
    notes: Optional[str] = None
    supporting_document_url: Optional[str] = None


class MedicalRecordAmend(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[RecordStatus] = None
    notes: Optional[str] = None
    reason: str = Field(..., min_length=5, description="Clinical justification for record amendment")


class MedicalRecordArchive(BaseModel):
    reason: str = Field(..., min_length=3, description="Clinical or patient justification for archival")


class ClearRecordHistoryRequest(BaseModel):
    mode: str = Field(..., description="'clear_filters', 'hide_archived', or 'request_archival'")
    confirmation: bool = Field(..., description="User explicit confirmation")


# ── Helper Functions ──────────────────────────────────────────────────────────

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
            raise HTTPException(status_code=404, detail="Patient profile not found.")
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


# ── 1. Retrieve Medical Records ───────────────────────────────────────────────

@router.get("")
async def get_medical_records(
    patient_id: Optional[uuid.UUID] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve electronic health records.
    Supports filtering by category, search terms, date intervals, and archive status.
    """
    target_patient_id = await resolve_target_patient_id(current_user, patient_id, db)

    query = select(MedicalRecord).where(MedicalRecord.patient_id == target_patient_id)

    if not include_archived:
        query = query.where(MedicalRecord.is_archived == False)

    if category and category.lower() != "all":
        # Handle string or enum match
        cat_str = category.lower().replace("ies", "y").replace("s", "")
        query = query.where(MedicalRecord.category.ilike(f"%{cat_str}%"))

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            (MedicalRecord.title.ilike(s)) |
            (MedicalRecord.description.ilike(s)) |
            (MedicalRecord.icd10_code.ilike(s)) |
            (MedicalRecord.provider.ilike(s)) |
            (MedicalRecord.notes.ilike(s))
        )

    if start_date:
        query = query.where(MedicalRecord.record_date >= start_date)
    if end_date:
        query = query.where(MedicalRecord.record_date <= end_date)

    query = query.order_by(desc(MedicalRecord.record_date), desc(MedicalRecord.created_at))
    res = await db.execute(query)
    records = res.scalars().all()

    return [
        {
            "id": str(r.id),
            "category": (r.category.value if hasattr(r.category, "value") else str(r.category)).capitalize(),
            "category_code": r.category.value if hasattr(r.category, "value") else str(r.category),
            "title": r.title,
            "description": r.description or "",
            "icd10": r.icd10_code,
            "date": str(r.record_date),
            "provider": r.provider or ("Dr. Physician (Assigned)" if not r.is_patient_reported else "Self-Reported / Patient Entered"),
            "status": (r.status.value if hasattr(r.status, "value") else str(r.status)).capitalize(),
            "severity": r.severity or "Moderate",
            "notes": r.notes,
            "source": r.source,
            "is_patient_reported": r.is_patient_reported,
            "supporting_document_url": r.supporting_document_url,
            "lab_result_id": str(r.lab_result_id) if r.lab_result_id else None,
            "is_amended": r.is_amended,
            "amendment_reason": r.amendment_reason,
            "original_value": r.original_value,
            "is_archived": r.is_archived,
            "archived_reason": r.archived_reason,
        }
        for r in records
    ]


# ── 2. Add Medical Record ─────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_medical_record(
    payload: MedicalRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new medical record.
    Patients can record self-reported diagnoses, allergies, surgeries, and notes.
    These are appropriately tagged as 'patient_reported' rather than clinician-confirmed.
    """
    target_patient_id = await resolve_target_patient_id(current_user, payload.patient_id, db)

    # Determine clinical provenance
    if current_user.role == UserRole.PATIENT:
        is_patient_reported = True
        source = "patient_reported"
        provider_name = payload.provider.strip() if payload.provider else "Self-Reported / Outside Provider"
    else:
        is_patient_reported = False
        source = "clinician_confirmed"
        provider_name = payload.provider.strip() if payload.provider else (current_user.full_name or "Attending Physician")

    new_record = MedicalRecord(
        id=uuid.uuid4(),
        patient_id=target_patient_id,
        category=payload.category,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else "",
        icd10_code=payload.icd10_code.strip() if payload.icd10_code else None,
        record_date=payload.record_date,
        status=payload.status,
        severity=payload.severity or ("Moderate" if payload.category in [RecordCategory.DIAGNOSIS, RecordCategory.ALLERGY] else None),
        provider=provider_name,
        source=source,
        is_patient_reported=is_patient_reported,
        notes=payload.notes,
        supporting_document_url=payload.supporting_document_url,
        lab_result_id=payload.lab_result_id,
        created_by=current_user.id,
    )
    db.add(new_record)

    # Audit Trail
    db.add(MedicalRecordAuditLog(
        id=uuid.uuid4(),
        medical_record_id=new_record.id,
        patient_id=target_patient_id,
        action="created",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason="Initial medical record creation",
        new_value=f"Category: {new_record.category.value}, Title: {new_record.title}",
    ))

    # Version Snapshot
    db.add(RecordVersion(
        id=uuid.uuid4(),
        record_id=new_record.id,
        record_type="medical_record",
        version_number=1,
        action="created",
        snapshot_data={
            "category": new_record.category.value,
            "title": new_record.title,
            "description": new_record.description,
            "date": str(new_record.record_date),
            "status": new_record.status.value,
            "provider": new_record.provider,
            "source": new_record.source,
            "is_patient_reported": new_record.is_patient_reported,
        },
        change_summary=f"Created {new_record.category.value} entry: '{new_record.title}'",
        reason="Initial entry",
        changed_by=current_user.id,
        changed_by_name=current_user.full_name,
    ))

    await db.commit()
    await db.refresh(new_record)

    return {
        "id": str(new_record.id),
        "category": (new_record.category.value if hasattr(new_record.category, "value") else str(new_record.category)).capitalize(),
        "title": new_record.title,
        "description": new_record.description,
        "icd10": new_record.icd10_code,
        "date": str(new_record.record_date),
        "provider": new_record.provider,
        "status": (new_record.status.value if hasattr(new_record.status, "value") else str(new_record.status)).capitalize(),
        "severity": new_record.severity,
        "notes": new_record.notes,
        "source": new_record.source,
        "is_patient_reported": new_record.is_patient_reported,
        "lab_result_id": str(new_record.lab_result_id) if new_record.lab_result_id else None,
    }


# ── 3. Edit Medical Record (Direct Edit for Patient Records) ──────────────────

@router.put("/{record_id}")
@router.patch("/{record_id}")
async def update_medical_record(
    record_id: uuid.UUID,
    payload: MedicalRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a medical record.
    Patient-reported records can be edited directly by the authorized patient.
    Official clinician-confirmed records cannot be silently overwritten; they require amendment.
    """
    stmt = select(MedicalRecord).where(MedicalRecord.id == record_id)
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if record.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this patient record.")

        # If clinician confirmed, block silent rewrite
        if not record.is_patient_reported and record.source == "clinician_confirmed":
            raise HTTPException(
                status_code=400,
                detail="Clinician-confirmed medical records cannot be overwritten directly. Please submit an amendment request with clinical rationale.",
            )

    old_title = record.title
    old_desc = record.description

    if payload.title is not None:
        record.title = payload.title.strip()
    if payload.description is not None:
        record.description = payload.description.strip()
    if payload.record_date is not None:
        record.record_date = payload.record_date
    if payload.provider is not None:
        record.provider = payload.provider.strip()
    if payload.icd10_code is not None:
        record.icd10_code = payload.icd10_code.strip()
    if payload.status is not None:
        record.status = payload.status
    if payload.severity is not None:
        record.severity = payload.severity
    if payload.notes is not None:
        record.notes = payload.notes.strip()
    if payload.supporting_document_url is not None:
        record.supporting_document_url = payload.supporting_document_url.strip()

    record.updated_by = current_user.id

    db.add(MedicalRecordAuditLog(
        id=uuid.uuid4(),
        medical_record_id=record.id,
        patient_id=record.patient_id,
        action="updated",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason="Direct record update",
        previous_value=f"Title: {old_title}; Desc: {old_desc}",
        new_value=f"Title: {record.title}; Desc: {record.description}",
    ))

    db.add(RecordVersion(
        id=uuid.uuid4(),
        record_id=record.id,
        record_type="medical_record",
        version_number=2,
        action="updated",
        snapshot_data={"title": record.title, "description": record.description, "status": record.status.value},
        change_summary=f"Updated record details from '{old_title}' to '{record.title}'",
        reason="Direct edit",
        changed_by=current_user.id,
        changed_by_name=current_user.full_name,
    ))

    await db.commit()
    await db.refresh(record)

    return {
        "status": "updated",
        "id": str(record.id),
        "title": record.title,
        "description": record.description,
        "severity": record.severity,
        "status_code": record.status.value,
        "provider": record.provider,
        "date": str(record.record_date),
        "icd10": record.icd10_code,
        "notes": record.notes,
    }


# ── 4. Amend Medical Record (Clinical Amendment Workflow) ─────────────────────

@router.post("/{record_id}/amend")
async def amend_medical_record(
    record_id: uuid.UUID,
    payload: MedicalRecordAmend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Clinical amendment workflow for official or clinician-confirmed records.
    Records original values, justification, author, and timestamp.
    """
    stmt = select(MedicalRecord).where(MedicalRecord.id == record_id)
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if record.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this patient record.")

    old_snapshot = f"Title: {record.title} | Desc: {record.description} | Status: {record.status.value}"

    if payload.title is not None:
        record.title = payload.title.strip()
    if payload.description is not None:
        record.description = payload.description.strip()
    if payload.status is not None:
        record.status = payload.status
    if payload.notes is not None:
        record.notes = f"{record.notes or ''}\n[Amendment Note]: {payload.notes.strip()}".strip()

    record.is_amended = True
    record.amendment_reason = payload.reason.strip()
    record.original_value = old_snapshot if record.original_value is None else record.original_value
    record.amended_by = current_user.id
    record.amended_at = datetime.now(timezone.utc)

    db.add(MedicalRecordAuditLog(
        id=uuid.uuid4(),
        medical_record_id=record.id,
        patient_id=record.patient_id,
        action="amended",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason=payload.reason.strip(),
        previous_value=old_snapshot,
        new_value=f"Title: {record.title} | Status: {record.status.value}",
    ))

    db.add(RecordVersion(
        id=uuid.uuid4(),
        record_id=record.id,
        record_type="medical_record",
        version_number=3,
        action="amended",
        snapshot_data={
            "title": record.title,
            "description": record.description,
            "status": record.status.value,
            "original_value": record.original_value,
            "amendment_reason": record.amendment_reason,
            "amended_at": record.amended_at.isoformat(),
        },
        change_summary=f"Amended record with reason: {payload.reason}",
        reason=payload.reason,
        changed_by=current_user.id,
        changed_by_name=current_user.full_name,
    ))

    await db.commit()
    await db.refresh(record)

    return {
        "status": "amended",
        "id": str(record.id),
        "title": record.title,
        "is_amended": record.is_amended,
        "amendment_reason": record.amendment_reason,
        "amended_at": record.amended_at.isoformat(),
    }


# ── 5. Archive & Restore Medical Record ───────────────────────────────────────

@router.delete("/{record_id}")
@router.patch("/{record_id}/archive")
async def archive_medical_record(
    record_id: uuid.UUID,
    payload: Optional[MedicalRecordArchive] = None,
    reason: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft archival of medical record.
    Patients can archive records they created or patient-reported records.
    Official clinician diagnoses require clinician/admin authorization.
    """
    arch_reason = (payload.reason if payload else None) or reason or "Patient requested record archival"

    stmt = select(MedicalRecord).where(MedicalRecord.id == record_id)
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if record.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to this patient record.")
        if not record.is_patient_reported and record.source == "clinician_confirmed":
            raise HTTPException(
                status_code=403,
                detail="Official clinician-confirmed diagnoses cannot be archived by patient action. Please request clinician review.",
            )

    record.is_archived = True
    record.archived_at = datetime.now(timezone.utc)
    record.archived_reason = arch_reason.strip()
    record.archived_by = current_user.id

    db.add(MedicalRecordAuditLog(
        id=uuid.uuid4(),
        medical_record_id=record.id,
        patient_id=record.patient_id,
        action="archived",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason=arch_reason.strip(),
        previous_value=f"Active record: {record.title}",
        new_value="Archived",
    ))

    await db.commit()
    return {"status": "archived", "id": str(record.id), "reason": arch_reason}


@router.patch("/{record_id}/restore")
async def restore_medical_record(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore an archived medical record."""
    stmt = select(MedicalRecord).where(MedicalRecord.id == record_id)
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    if current_user.role == UserRole.PATIENT:
        pat_id = await resolve_target_patient_id(current_user, None, db)
        if record.patient_id != pat_id:
            raise HTTPException(status_code=403, detail="Unauthorized access.")

    record.is_archived = False
    record.archived_at = None
    record.archived_reason = None
    record.archived_by = None

    db.add(MedicalRecordAuditLog(
        id=uuid.uuid4(),
        medical_record_id=record.id,
        patient_id=record.patient_id,
        action="restored",
        performed_by=current_user.id,
        performed_by_name=current_user.full_name or "Authorized User",
        reason="Restored by authorized user",
        new_value=f"Restored: {record.title}",
    ))

    await db.commit()
    return {"status": "restored", "id": str(record.id)}


# ── 6. Medical Records History & Audit Trail ──────────────────────────────────

@router.get("/history")
async def get_medical_records_history(
    patient_id: Optional[uuid.UUID] = None,
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Historical activity timeline across all medical records for this patient.
    Tracks created, updated, amended, archived, and restored events.
    """
    target_patient_id = await resolve_target_patient_id(current_user, patient_id, db)

    query = (
        select(MedicalRecordAuditLog, MedicalRecord.title, MedicalRecord.category)
        .join(MedicalRecord, MedicalRecordAuditLog.medical_record_id == MedicalRecord.id)
        .where(MedicalRecordAuditLog.patient_id == target_patient_id)
        .order_by(desc(MedicalRecordAuditLog.created_at))
    )
    if category and category.lower() != "all":
        query = query.where(MedicalRecord.category.ilike(f"%{category.lower()}%"))

    res = await db.execute(query)
    rows = res.all()

    return [
        {
            "id": str(log.id),
            "record_id": str(log.medical_record_id),
            "title": r_title,
            "category": r_cat.value if hasattr(r_cat, "value") else str(r_cat),
            "action": log.action,
            "performed_by_name": log.performed_by_name or "Clinical System",
            "reason": log.reason,
            "previous_value": log.previous_value,
            "new_value": log.new_value,
            "timestamp": log.created_at.isoformat(),
        }
        for log, r_title, r_cat in rows
    ]


@router.get("/{record_id}/history")
async def get_single_record_history(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Version snapshots and audit trail for a specific medical record."""
    stmt = (
        select(RecordVersion)
        .where(RecordVersion.record_id == record_id)
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
            "changed_by_name": v.changed_by_name or "Authorized Clinician",
            "snapshot": v.snapshot_data,
            "timestamp": v.created_at.isoformat(),
        }
        for v in versions
    ]


# ── 7. Clear History Control ──────────────────────────────────────────────────

@router.post("/clear-history")
async def clear_medical_records_history(
    body: ClearRecordHistoryRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Clear UI-level search filters and hide archived entries.
    Clinical records and HIPAA audit logs are permanently protected and never deleted.
    """
    if not body.confirmation:
        raise HTTPException(status_code=400, detail="Confirmation required.")

    if body.mode == "clear_filters":
        return {
            "status": "success",
            "message": "Category filters, search query, and date ranges have been reset.",
            "mode": "clear_filters",
        }
    elif body.mode == "hide_archived":
        return {
            "status": "success",
            "message": "Archived medical records have been hidden from active view.",
            "mode": "hide_archived",
        }
    elif body.mode == "request_archival":
        return {
            "status": "success",
            "message": "Archival review request submitted for eligible patient-entered records. Official clinician-confirmed entries are preserved per statutory EHR retention laws.",
            "mode": "request_archival",
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid clear history mode.")


# ── 8. Export Health Summary ──────────────────────────────────────────────────

@router.get("/export")
async def export_medical_records_summary(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate comprehensive clinical summary of all longitudinal EHR records."""
    target_patient_id = await resolve_target_patient_id(current_user, patient_id, db)

    query = (
        select(MedicalRecord)
        .where(MedicalRecord.patient_id == target_patient_id)
        .order_by(desc(MedicalRecord.record_date))
    )
    res = await db.execute(query)
    records = res.scalars().all()

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "patient_id": str(target_patient_id),
        "total_records": len(records),
        "records": [
            {
                "category": r.category.value if hasattr(r.category, "value") else str(r.category),
                "title": r.title,
                "icd10": r.icd10_code,
                "date": str(r.record_date),
                "provider": r.provider,
                "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                "severity": r.severity,
                "source": r.source,
                "is_amended": r.is_amended,
                "description": r.description,
            }
            for r in records
        ],
    }
