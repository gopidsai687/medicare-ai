import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.appointment import AppointmentCreate, AppointmentRead, AppointmentUpdate

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("", response_model=List[AppointmentRead])
async def get_appointments(
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Appointment)

    if current_user.role == UserRole.PATIENT:
        patient_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(patient_stmt)
        patient_id = p_res.scalar_one_or_none()
        if not patient_id:
            return []
        query = query.where(Appointment.patient_id == patient_id)

    elif current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        doctor_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
        d_res = await db.execute(doctor_stmt)
        doctor_id = d_res.scalar_one_or_none()
        if not doctor_id:
            return []
        query = query.where(Appointment.doctor_id == doctor_id)

    if status_filter:
        query = query.where(Appointment.status == status_filter)

    query = query.order_by(desc(Appointment.scheduled_at))
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient_id = payload.patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        patient_id = p_res.scalar_one_or_none()
        if not patient_id:
            raise HTTPException(status_code=404, detail="Patient profile not found")

    if not patient_id:
        raise HTTPException(status_code=400, detail="Patient ID required")

    appt = Appointment(
        patient_id=patient_id,
        doctor_id=payload.doctor_id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        appointment_type=payload.appointment_type,
        reason=payload.reason,
        notes=payload.notes,
        status=AppointmentStatus.SCHEDULED,
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)
    return appt


@router.patch("/{appointment_id}", response_model=AppointmentRead)
async def update_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(appt, field, value)

    await db.commit()
    await db.refresh(appt)
    return appt


@router.delete("/{appointment_id}/cancel", response_model=AppointmentRead)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.status = AppointmentStatus.CANCELLED
    await db.commit()
    await db.refresh(appt)
    return appt
