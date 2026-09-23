import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.mpi import calculate_mpi_score
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.medical_record import MedicalRecord
from app.models.prescription import Prescription
from app.models.encounter import Encounter
from app.models.vital_sign import VitalSign
from app.models.audit_log import AuditLog, AuditAction, AuditSeverity
from app.schemas.mpi import DuplicateCandidate, MergeRequest, MergeResponse

router = APIRouter(prefix="/mpi", tags=["Master Patient Index"])


@router.get("/duplicates", response_model=List[DuplicateCandidate])
async def detect_duplicates(
    threshold: float = 0.75,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    """
    Runs pairwise MPI duplicate detection over active patients.
    """
    stmt = (
        select(Patient, User)
        .join(User, Patient.user_id == User.id)
        .where(Patient.is_merged == False)  # noqa: E712
    )
    result = await db.execute(stmt)
    rows = result.all()

    candidates: List[DuplicateCandidate] = []
    
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            p1, u1 = rows[i]
            p2, u2 = rows[j]

            d1 = {
                "full_name": u1.full_name,
                "date_of_birth": p1.date_of_birth,
                "phone": p1.phone,
                "zip_code": p1.zip_code,
                "gender": p1.gender,
                "blood_type": p1.blood_type,
            }
            d2 = {
                "full_name": u2.full_name,
                "date_of_birth": p2.date_of_birth,
                "phone": p2.phone,
                "zip_code": p2.zip_code,
                "gender": p2.gender,
                "blood_type": p2.blood_type,
            }

            score = calculate_mpi_score(d1, d2)

            if score >= threshold:
                reasons = []
                if d1["full_name"].lower() == d2["full_name"].lower():
                    reasons.append("Exact name match")
                elif score >= 0.7:
                    reasons.append("High phonetic/spelling similarity")

                if d1["date_of_birth"] == d2["date_of_birth"]:
                    reasons.append("Identical Date of Birth")
                if d1["phone"] and d1["phone"] == d2["phone"]:
                    reasons.append("Matching contact phone")

                confidence = "HIGH" if score >= 0.88 else "MEDIUM"

                candidates.append(
                    DuplicateCandidate(
                        primary_patient_id=p1.id,
                        duplicate_patient_id=p2.id,
                        primary_name=u1.full_name,
                        duplicate_name=u2.full_name,
                        primary_mrn=p1.mrn,
                        duplicate_mrn=p2.mrn,
                        match_score=score,
                        confidence_level=confidence,
                        match_reasons=reasons or ["Demographic similarity"],
                    )
                )

    return sorted(candidates, key=lambda c: c.match_score, reverse=True)


@router.post("/merge", response_model=MergeResponse)
async def execute_patient_merge(
    payload: MergeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    """
    Executes HIPAA compliant patient merge.
    Transfers clinical encounters, vitals, records, prescriptions, and sets is_merged=True on redundant record with Audit Logging.
    """
    if payload.survivor_patient_id == payload.merged_patient_id:
        raise HTTPException(status_code=400, detail="Cannot merge a patient into themselves")

    survivor_stmt = select(Patient).where(Patient.id == payload.survivor_patient_id)
    s_res = await db.execute(survivor_stmt)
    survivor = s_res.scalar_one_or_none()

    merged_stmt = select(Patient).where(Patient.id == payload.merged_patient_id)
    m_res = await db.execute(merged_stmt)
    merged = m_res.scalar_one_or_none()

    if not survivor or not merged:
        raise HTTPException(status_code=404, detail="One or both patients not found")

    if merged.is_merged:
        raise HTTPException(status_code=400, detail="Patient record has already been merged into another profile")

    # Transfer appointments
    apt_stmt = (
        update(Appointment)
        .where(Appointment.patient_id == merged.id)
        .values(patient_id=survivor.id)
    )
    apt_res = await db.execute(apt_stmt)

    # Transfer encounters
    enc_stmt = (
        update(Encounter)
        .where(Encounter.patient_id == merged.id)
        .values(patient_id=survivor.id)
    )
    enc_res = await db.execute(enc_stmt)

    # Transfer vital signs
    vital_stmt = (
        update(VitalSign)
        .where(VitalSign.patient_id == merged.id)
        .values(patient_id=survivor.id)
    )
    vital_res = await db.execute(vital_stmt)

    # Transfer medical records
    rec_stmt = (
        update(MedicalRecord)
        .where(MedicalRecord.patient_id == merged.id)
        .values(patient_id=survivor.id)
    )
    rec_res = await db.execute(rec_stmt)

    # Transfer prescriptions
    rx_stmt = (
        update(Prescription)
        .where(Prescription.patient_id == merged.id)
        .values(patient_id=survivor.id)
    )
    rx_res = await db.execute(rx_stmt)

    # Mark redundant patient as merged
    merged.is_merged = True
    merged.merged_into_id = survivor.id
    merged.notes = f"Merged into {survivor.mrn} by Admin. Reason: {payload.reason}"

    # Log HIPAA compliance audit event
    audit_entry = AuditLog(
        user_id=current_user.id,
        action=AuditAction.PATIENT_MERGE,
        severity=AuditSeverity.WARNING,
        resource_type="Patient",
        resource_id=str(survivor.id),
        details={
            "survivor_mrn": survivor.mrn,
            "survivor_id": str(survivor.id),
            "merged_mrn": merged.mrn,
            "merged_id": str(merged.id),
            "reason": payload.reason,
            "transferred_appointments": apt_res.rowcount or 0,
            "transferred_encounters": enc_res.rowcount or 0,
            "transferred_vitals": vital_res.rowcount or 0,
            "transferred_records": rec_res.rowcount or 0,
            "transferred_prescriptions": rx_res.rowcount or 0,
        },
    )
    db.add(audit_entry)

    await db.commit()

    return MergeResponse(
        success=True,
        survivor_mrn=survivor.mrn,
        merged_mrn=merged.mrn,
        transferred_appointments=apt_res.rowcount or 0,
        transferred_records=rec_res.rowcount or 0,
        transferred_prescriptions=rx_res.rowcount or 0,
        message=f"Successfully merged {merged.mrn} into {survivor.mrn}.",
    )
