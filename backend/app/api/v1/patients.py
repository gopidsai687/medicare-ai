"""
Patient Management API endpoints — Admin and Doctor access.
Provides GET (list/detail) and POST (create) for Patient records.
"""
import uuid
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User, UserRole

router = APIRouter(prefix="/patients", tags=["Patients"])


# ── Response schema ────────────────────────────────────────────────────────────

class PatientSummary(BaseModel):
    id: str
    name: str
    mrn: str
    dob: Optional[str] = None
    gender: str = "prefer_not_to_say"
    blood_type: str = "unknown"
    phone: Optional[str] = None
    address: Optional[str] = None
    insurance_provider: Optional[str] = None
    doctor: Optional[str] = None
    dept: Optional[str] = None
    status: str = "Active"
    is_merged: bool = False
    merged_into_mrn: Optional[str] = None
    notes: Optional[str] = None


class PatientCreate(BaseModel):
    full_name: str
    email: str
    date_of_birth: Optional[date] = None
    gender: str = "prefer_not_to_say"
    blood_type: str = "unknown"
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None


# ── Helper ─────────────────────────────────────────────────────────────────────

def _build_address(p: Patient) -> Optional[str]:
    parts = [p.address_line1, p.city, p.state, p.zip_code]
    filled = [x for x in parts if x]
    return ", ".join(filled) if filled else None


async def _to_summary(p: Patient, db: AsyncSession) -> Dict[str, Any]:
    name = p.user.full_name if p.user else "Unknown Patient"

    # Attempt to find their primary doctor via most recent appointment
    doctor_name: Optional[str] = None
    dept_name: Optional[str] = None
    try:
        from app.models.appointment import Appointment
        apt_stmt = (
            select(Appointment)
            .where(Appointment.patient_id == p.id)
            .order_by(Appointment.scheduled_at.desc())
            .limit(1)
        )
        apt_res = await db.execute(apt_stmt)
        apt = apt_res.scalar_one_or_none()
        if apt and apt.doctor_id:
            doc_stmt = select(Doctor).where(Doctor.id == apt.doctor_id)
            doc_res = await db.execute(doc_stmt)
            doc = doc_res.scalar_one_or_none()
            if doc and doc.user:
                doctor_name = doc.user.full_name
                dept_name = doc.department or "General Medicine"
    except Exception:
        pass

    merged_into_mrn: Optional[str] = None
    if p.is_merged and p.merged_into_id:
        try:
            mi_stmt = select(Patient.mrn).where(Patient.id == p.merged_into_id)
            mi_res = await db.execute(mi_stmt)
            merged_into_mrn = mi_res.scalar_one_or_none()
        except Exception:
            pass

    status_val = "Merged" if p.is_merged else "Active"

    return {
        "id": str(p.id),
        "name": name,
        "mrn": p.mrn,
        "dob": p.date_of_birth.isoformat() if p.date_of_birth else None,
        "gender": p.gender.value if hasattr(p.gender, "value") else str(p.gender),
        "blood_type": p.blood_type.value if hasattr(p.blood_type, "value") else str(p.blood_type),
        "phone": p.phone,
        "address": _build_address(p),
        "insurance_provider": p.insurance_provider,
        "doctor": doctor_name,
        "dept": dept_name,
        "status": status_val,
        "is_merged": p.is_merged,
        "merged_into_mrn": merged_into_mrn,
        "notes": p.notes,
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[Dict[str, Any]])
async def list_patients(
    search: Optional[str] = Query(None, description="Search name or MRN"),
    include_merged: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin / Doctor: list all patients with demographic summary.
    Patients cannot list other patients.
    """
    if current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Patients cannot list the patient directory.")

    query = select(Patient)

    if not include_merged:
        query = query.where(Patient.is_merged == False)  # noqa: E712

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    patients = result.scalars().all()

    # Optional search filter (applied after DB fetch to allow full-name join via user relationship)
    if search:
        q = search.lower()
        patients = [
            p for p in patients
            if q in (p.user.full_name if p.user else "").lower()
            or q in p.mrn.lower()
        ]

    summaries = []
    for p in patients:
        summaries.append(await _to_summary(p, db))

    return summaries


@router.get("/count")
async def patient_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick census count for dashboard KPIs."""
    if current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Forbidden")

    total_res = await db.execute(select(func.count()).select_from(Patient))
    total = total_res.scalar_one()

    merged_res = await db.execute(
        select(func.count()).select_from(Patient).where(Patient.is_merged == True)  # noqa: E712
    )
    merged = merged_res.scalar_one()

    return {"total": total, "active": total - merged, "merged": merged}


@router.get("/{patient_id}", response_model=Dict[str, Any])
async def get_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a single patient's full profile."""
    # Patients can only see their own record
    stmt = select(Patient).where(Patient.id == patient_id)
    result = await db.execute(stmt)
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == UserRole.PATIENT and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return await _to_summary(patient, db)
