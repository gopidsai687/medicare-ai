import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord, RecordCategory
from app.schemas.medical_record import MedicalRecordCreate, MedicalRecordRead, MedicalRecordUpdate

router = APIRouter(prefix="/records", tags=["Medical Records"])


@router.get("", response_model=List[MedicalRecordRead])
async def get_medical_records(
    patient_id: Optional[uuid.UUID] = None,
    category: Optional[RecordCategory] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(MedicalRecord)

    target_patient_id = patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        target_patient_id = p_res.scalar_one_or_none()
        if not target_patient_id:
            return []

    if target_patient_id:
        query = query.where(MedicalRecord.patient_id == target_patient_id)

    if category:
        query = query.where(MedicalRecord.category == category)

    query = query.order_by(desc(MedicalRecord.record_date))
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=MedicalRecordRead, status_code=status.HTTP_201_CREATED)
async def create_medical_record(
    payload: MedicalRecordCreate,
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

    record = MedicalRecord(
        patient_id=target_patient_id,
        doctor_id=payload.doctor_id,
        category=payload.category,
        title=payload.title,
        description=payload.description,
        icd10_code=payload.icd10_code,
        record_date=payload.record_date,
        status=payload.status,
        severity=payload.severity,
        metadata_json=payload.metadata_json,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{record_id}", response_model=MedicalRecordRead)
async def update_medical_record(
    record_id: uuid.UUID,
    payload: MedicalRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(MedicalRecord).where(MedicalRecord.id == record_id)
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    await db.commit()
    await db.refresh(record)
    return record
