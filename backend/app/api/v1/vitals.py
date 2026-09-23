import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.vital_sign import VitalSign
from app.schemas.vital_sign import VitalSignCreate, VitalSignRead

router = APIRouter(prefix="/vitals", tags=["Vital Signs"])


@router.get("", response_model=List[VitalSignRead])
async def get_vital_signs(
    patient_id: Optional[uuid.UUID] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(VitalSign)

    target_patient_id = patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        target_patient_id = p_res.scalar_one_or_none()
        if not target_patient_id:
            return []

    if target_patient_id:
        query = query.where(VitalSign.patient_id == target_patient_id)

    query = query.order_by(desc(VitalSign.recorded_at)).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=VitalSignRead, status_code=status.HTTP_201_CREATED)
async def record_vital_signs(
    payload: VitalSignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_patient_id = payload.patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        target_patient_id = p_res.scalar_one_or_none()

    if not target_patient_id:
        raise HTTPException(status_code=400, detail="Patient ID required")

    vitals = VitalSign(
        patient_id=target_patient_id,
        recorded_by_id=current_user.id,
        recorded_at=payload.recorded_at,
        heart_rate=payload.heart_rate,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        temperature=payload.temperature,
        oxygen_saturation=payload.oxygen_saturation,
        respiratory_rate=payload.respiratory_rate,
        blood_glucose=payload.blood_glucose,
        weight=payload.weight,
        height=payload.height,
    )
    db.add(vitals)
    await db.commit()
    await db.refresh(vitals)
    return vitals
