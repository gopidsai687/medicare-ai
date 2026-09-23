import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.prescription import Prescription, PrescriptionStatus
from app.schemas.prescription import PrescriptionCreate, PrescriptionRead, PrescriptionUpdate

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])


@router.get("", response_model=List[PrescriptionRead])
async def get_prescriptions(
    patient_id: Optional[uuid.UUID] = None,
    status_filter: Optional[PrescriptionStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Prescription)

    target_patient_id = patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        target_patient_id = p_res.scalar_one_or_none()
        if not target_patient_id:
            return []

    if target_patient_id:
        query = query.where(Prescription.patient_id == target_patient_id)

    if status_filter:
        query = query.where(Prescription.status == status_filter)

    query = query.order_by(desc(Prescription.created_at))
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=PrescriptionRead, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    payload: PrescriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rx = Prescription(
        patient_id=payload.patient_id,
        doctor_id=payload.doctor_id,
        medication_name=payload.medication_name,
        dosage=payload.dosage,
        frequency=payload.frequency,
        route=payload.route,
        start_date=payload.start_date,
        end_date=payload.end_date,
        refills_remaining=payload.refills_remaining,
        instructions=payload.instructions,
        status=PrescriptionStatus.ACTIVE,
    )
    db.add(rx)
    await db.commit()
    await db.refresh(rx)
    return rx


@router.post("/{prescription_id}/refill", response_model=PrescriptionRead)
async def request_refill(
    prescription_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Prescription).where(Prescription.id == prescription_id)
    result = await db.execute(stmt)
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    rx.status = PrescriptionStatus.PENDING_REFILL
    await db.commit()
    await db.refresh(rx)
    return rx
