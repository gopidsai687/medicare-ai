import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.encounter import Encounter, EncounterStatus
from app.schemas.encounter import EncounterCreate, EncounterRead, EncounterUpdate

router = APIRouter(prefix="/encounters", tags=["Encounters"])


@router.get("", response_model=List[EncounterRead])
async def get_encounters(
    patient_id: Optional[uuid.UUID] = None,
    status_filter: Optional[EncounterStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Encounter)

    if current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        d_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
        d_res = await db.execute(d_stmt)
        doctor_id = d_res.scalar_one_or_none()
        if doctor_id:
            # If a specific patient_id was requested by the doctor, filter by it; otherwise show doctor's encounters
            if patient_id:
                query = query.where(Encounter.patient_id == patient_id)
            else:
                query = query.where(Encounter.doctor_id == doctor_id)
    elif current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        pat_id = p_res.scalar_one_or_none()
        if not pat_id:
            return []
        query = query.where(Encounter.patient_id == pat_id)

    if status_filter:
        query = query.where(Encounter.status == status_filter)

    query = query.order_by(desc(Encounter.encounter_date))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{encounter_id}", response_model=EncounterRead)
async def get_encounter_by_id(
    encounter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Encounter).where(Encounter.id == encounter_id)
    result = await db.execute(stmt)
    encounter = result.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter


@router.post("", response_model=EncounterRead, status_code=status.HTTP_201_CREATED)
async def create_encounter(
    payload: EncounterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DOCTOR, UserRole.NURSE])),
):
    doctor_id = payload.doctor_id
    if not doctor_id:
        d_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
        d_res = await db.execute(d_stmt)
        doctor_id = d_res.scalar_one_or_none()

    if not doctor_id:
        raise HTTPException(status_code=400, detail="Doctor ID could not be identified")

    encounter = Encounter(
        patient_id=payload.patient_id,
        doctor_id=doctor_id,
        appointment_id=payload.appointment_id,
        encounter_date=payload.encounter_date,
        encounter_type=payload.encounter_type,
        chief_complaint=payload.chief_complaint,
        subjective=payload.subjective,
        objective=payload.objective,
        assessment=payload.assessment,
        plan=payload.plan,
        status=EncounterStatus.IN_PROGRESS,
    )
    db.add(encounter)
    await db.commit()
    await db.refresh(encounter)
    return encounter


@router.patch("/{encounter_id}", response_model=EncounterRead)
async def update_encounter(
    encounter_id: uuid.UUID,
    payload: EncounterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DOCTOR, UserRole.NURSE])),
):
    stmt = select(Encounter).where(Encounter.id == encounter_id)
    result = await db.execute(stmt)
    encounter = result.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")

    if encounter.status == EncounterStatus.SIGNED and payload.status != EncounterStatus.ADDENDED:
        raise HTTPException(status_code=400, detail="Signed encounters cannot be edited without addendum")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(encounter, field, value)

    await db.commit()
    await db.refresh(encounter)
    return encounter


@router.post("/{encounter_id}/sign", response_model=EncounterRead)
async def sign_encounter(
    encounter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DOCTOR])),
):
    stmt = select(Encounter).where(Encounter.id == encounter_id)
    result = await db.execute(stmt)
    encounter = result.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")

    encounter.status = EncounterStatus.SIGNED
    encounter.signed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(encounter)
    return encounter
