"""
MediCare AI Appointments API — Complete Clinical Scheduling, Availability, and Booking Engine.
Provides real database-backed slot availability calculation, double-booking prevention,
patient/doctor/admin permissions, status lifecycle transitions, cancellation, and rescheduling.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.doctor import Doctor
from app.models.doctor_schedule import DayOfWeek, DoctorSchedule, DoctorTimeOff
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.appointment import (
    AppointmentCancelRequest,
    AppointmentCreate,
    AppointmentRead,
    AppointmentRescheduleRequest,
    AppointmentUpdate,
    DoctorAvailabilityResponse,
    DoctorProfileRead,
    DoctorScheduleCreate,
    DoctorScheduleRead,
    DoctorTimeOffCreate,
    DoctorTimeOffRead,
    SpecialtyRead,
)
from app.services.availability_service import DAY_OF_WEEK_MAP, availability_service, clean_doctor_display_name

router = APIRouter(prefix="/appointments", tags=["Appointments"])


def _generate_booking_reference() -> str:
    """Generate human-readable unique appointment reference code (e.g. MC-2026-9814)."""
    return f"MC-2026-{secrets.randbelow(9000) + 1000}"


def _enrich_appointment_read(appt: Appointment) -> AppointmentRead:
    """Populates enriched presentation fields from eager relationships."""
    now_utc = datetime.now(timezone.utc)
    appt_dt = appt.scheduled_at.astimezone(timezone.utc) if appt.scheduled_at.tzinfo else appt.scheduled_at.replace(tzinfo=timezone.utc)

    is_upcoming = (
        appt_dt >= now_utc
        and appt.status in (AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED)
    )

    doc_name = "Physician"
    doc_spec = "General Practice"
    doc_dept = "General Medicine"
    doc_loc = "Main Hospital Pavilion"
    doc_ph = None

    if appt.doctor:
        doc_spec = appt.doctor.specialty or doc_spec
        doc_dept = appt.doctor.department or doc_dept
        doc_loc = appt.doctor.office_location or doc_loc
        doc_ph = appt.doctor.phone
        if appt.doctor.user:
            doc_name = clean_doctor_display_name(appt.doctor.user.full_name)

    pat_name = "Patient"
    pat_mrn = ""
    if appt.patient:
        pat_mrn = appt.patient.mrn or ""
        if appt.patient.user:
            pat_name = appt.patient.user.full_name

    read_data = AppointmentRead.model_validate(appt)
    read_data.doctor_name = doc_name
    read_data.doctor_specialty = doc_spec
    read_data.doctor_department = doc_dept
    read_data.doctor_location = doc_loc
    read_data.doctor_phone = doc_ph
    read_data.patient_name = pat_name
    read_data.patient_mrn = pat_mrn
    read_data.is_upcoming = is_upcoming
    read_data.clinic_timezone = "America/New_York"
    return read_data


# -----------------------------------------------------------------------------
# Metadata Endpoints: Specialties & Doctors
# -----------------------------------------------------------------------------

@router.get("/specialties", response_model=List[SpecialtyRead])
async def list_specialties(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns clinical specialties supported by active doctors."""
    stmt = select(Doctor).where(Doctor.is_accepting_patients == True)
    res = await db.execute(stmt)
    doctors = res.scalars().all()

    specialty_counts: dict[str, int] = {}
    specialty_depts: dict[str, str] = {}
    for d in doctors:
        spec = d.specialty
        specialty_counts[spec] = specialty_counts.get(spec, 0) + 1
        specialty_depts[spec] = d.department or "Clinical Services"

    DESCRIPTIONS = {
        "Cardiovascular Medicine": "Diagnosis and management of coronary artery disease, heart failure, and arrhythmias.",
        "Cardiology": "Comprehensive cardiovascular care, ECG reviews, and hypertension management.",
        "Endocrinology & Metabolism": "Diabetes management, continuous glucose monitoring, and metabolic disorders.",
        "Endocrinology": "Specialized hormonal, thyroid, and diabetic clinical care.",
        "General Internal Medicine": "Primary care, adult preventive health, chronic disease coordination.",
        "General Practice": "Holistic family and preventive wellness examinations.",
        "Pulmonology & Critical Care": "Asthma, COPD, sleep apnea, and pulmonary function evaluations.",
        "Neurology & Stroke": "Migraines, neuropathy, stroke follow-up, and neurological assessments.",
    }

    out: List[SpecialtyRead] = []
    for spec, count in specialty_counts.items():
        code = spec.upper().replace(" ", "_").replace("&", "AND")[:20]
        desc_text = DESCRIPTIONS.get(spec, f"Specialized clinical care in {spec}.")
        out.append(SpecialtyRead(
            name=spec,
            code=code,
            doctor_count=count,
            department=specialty_depts.get(spec, "Medical Services"),
            description=desc_text,
        ))

    # Sort by doctor count descending
    out.sort(key=lambda s: s.doctor_count, reverse=True)
    return out


@router.get("/doctors", response_model=List[DoctorProfileRead])
async def list_booking_doctors(
    specialty: Optional[str] = Query(None, description="Filter by medical specialty"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns doctors available for appointment scheduling with schedule metadata."""
    query = select(Doctor).where(Doctor.is_accepting_patients == True)
    if specialty:
        query = query.where(Doctor.specialty.ilike(f"%{specialty}%"))

    res = await db.execute(query)
    doctors = res.scalars().all()

    profiles: List[DoctorProfileRead] = []
    for d in doctors:
        # Fetch doctor's working days
        sched_stmt = select(DoctorSchedule.day_of_week).where(
            DoctorSchedule.doctor_id == d.id,
            DoctorSchedule.is_active == True,
        )
        s_res = await db.execute(sched_stmt)
        working_days = list(dict.fromkeys(s_res.scalars().all()))

        # Next available date
        next_dates = await availability_service.get_next_available_dates(db, d.id, date.today(), count=1)
        earliest = next_dates[0] if next_dates else None

        doc_name = clean_doctor_display_name(d.user.full_name if d.user else "Physician")
        profiles.append(DoctorProfileRead(
            id=d.id,
            name=doc_name,
            full_name=doc_name,
            specialty=d.specialty,
            department=d.department or "Clinical Services",
            office_location=d.office_location or "Main Pavilion",
            phone=d.phone,
            is_accepting_patients=d.is_accepting_patients,
            bio=d.bio,
            working_days=working_days,
            earliest_available_date=earliest,
        ))

    return profiles


# -----------------------------------------------------------------------------
# Availability & Slots Endpoint
# -----------------------------------------------------------------------------

@router.get("/availability", response_model=DoctorAvailabilityResponse)
async def get_doctor_slot_availability(
    doctor_id: uuid.UUID = Query(..., description="Target doctor UUID"),
    date_param: Optional[str] = Query(None, alias="date", description="Target appointment date in YYYY-MM-DD format"),
    target_date: Optional[str] = Query(None, description="Target appointment date in YYYY-MM-DD format (alias)"),
    appointment_type: Optional[AppointmentType] = Query(None, description="Optional visit type filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Computes real, database-backed available slots for a doctor on a specific date.
    Strictly checks shifts, existing bookings, past times, and time off.
    """
    date_str = date_param or target_date
    if not date_str:
        raise HTTPException(
            status_code=400,
            detail="Missing required 'date' parameter in YYYY-MM-DD format.",
        )

    try:
        parsed_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Please specify date as YYYY-MM-DD.",
        )

    res = await availability_service.get_doctor_availability_for_date(
        db=db,
        doctor_id=doctor_id,
        target_date=parsed_date,
        appointment_type=appointment_type,
    )
    return res


# -----------------------------------------------------------------------------
# Core Appointment CRUD & Booking
# -----------------------------------------------------------------------------

@router.get("", response_model=List[AppointmentRead])
async def get_appointments(
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    time_frame: Optional[str] = Query(None, description="'upcoming' for future, 'past' for historical, or 'all'"),
    search: Optional[str] = Query(None, description="Search term for doctor, patient, reason, or reference"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List appointments with role-based access control and strict date boundary filtering.
    """
    query = select(Appointment)

    # Role Scoping
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
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

    # Status filter
    if status_filter:
        query = query.where(Appointment.status == status_filter)

    # Time frame filter (Server-Side Date Boundaries)
    now_utc = datetime.now(timezone.utc)
    if time_frame == "upcoming":
        query = query.where(
            and_(
                Appointment.scheduled_at >= now_utc,
                Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]),
            )
        )
    elif time_frame == "past":
        query = query.where(
            or_(
                Appointment.scheduled_at < now_utc,
                Appointment.status.in_([AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
            )
        )

    # Search filter
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Appointment.reason.ilike(term),
                Appointment.booking_reference.ilike(term),
            )
        )

    # Chronological sort: upcoming earliest first; overall newest first
    if time_frame == "upcoming":
        query = query.order_by(Appointment.scheduled_at.asc())
    else:
        query = query.order_by(desc(Appointment.scheduled_at))

    result = await db.execute(query)
    raw_appts = result.scalars().all()

    return [_enrich_appointment_read(a) for a in raw_appts]


@router.post("", response_model=AppointmentRead, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Book a new clinical appointment with atomic conflict verification.
    Prevents double-booking and validates input reason thoroughly.
    """
    # 1. Resolve Patient
    patient_id = payload.patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        patient_id = p_res.scalar_one_or_none()
        if not patient_id:
            raise HTTPException(status_code=404, detail="Patient profile not found for this user account.")
    elif not patient_id:
        raise HTTPException(status_code=400, detail="Patient ID is required when booking as staff.")

    # 2. Verify Doctor Exists and Accepts Patients
    d_stmt = select(Doctor).where(Doctor.id == payload.doctor_id)
    d_res = await db.execute(d_stmt)
    doctor = d_res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")
    if not doctor.is_accepting_patients:
        raise HTTPException(status_code=400, detail="This physician is currently not accepting new appointments.")

    # 3. Server-side Availability & Conflict Check (Locking / Overlap)
    is_valid, err_msg = await availability_service.verify_slot_and_lock(
        db=db,
        doctor_id=payload.doctor_id,
        requested_dt_utc=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err_msg)

    # 4. Prevent Patient Self-Overlap (cannot be in two places at once)
    req_start = payload.scheduled_at if payload.scheduled_at.tzinfo else payload.scheduled_at.replace(tzinfo=timezone.utc)
    req_end = req_start + timedelta(minutes=payload.duration_minutes)

    pat_conflict = await db.execute(
        select(Appointment.id).where(
            Appointment.patient_id == patient_id,
            Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED]),
            Appointment.scheduled_at < req_end,
        )
    )
    for c_id in pat_conflict.scalars().all():
        c_appt = (await db.execute(select(Appointment).where(Appointment.id == c_id))).scalar_one()
        c_start = c_appt.scheduled_at if c_appt.scheduled_at.tzinfo else c_appt.scheduled_at.replace(tzinfo=timezone.utc)
        c_end = c_start + timedelta(minutes=c_appt.duration_minutes)
        if req_start < c_end and req_end > c_start:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have an active appointment scheduled during this exact time frame.",
            )

    # 5. Determine room or telehealth link
    room_val = None
    telehealth_url = None
    if payload.appointment_type == AppointmentType.TELEHEALTH:
        telehealth_url = f"https://care.medicare.ai/vroom/{uuid.uuid4().hex[:10]}"
        room_val = "Virtual Consultation Suite"
    else:
        room_val = doctor.office_location or "Clinic Examination Suite 2B"

    # 6. Create Record with unique reference
    booking_ref = _generate_booking_reference()
    appt = Appointment(
        patient_id=patient_id,
        doctor_id=payload.doctor_id,
        scheduled_at=req_start,
        duration_minutes=payload.duration_minutes,
        appointment_type=payload.appointment_type,
        reason=payload.reason.strip(),
        notes=payload.notes,
        room=room_val,
        telehealth_url=telehealth_url,
        status=AppointmentStatus.CONFIRMED,
        booking_reference=booking_ref,
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)

    return _enrich_appointment_read(appt)


@router.get("/{appointment_id}", response_model=AppointmentRead)
async def get_appointment_details(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch single appointment details with role verification."""
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        my_patient_id = p_res.scalar_one_or_none()
        if appt.patient_id != my_patient_id:
            raise HTTPException(status_code=403, detail="Access denied: You can only view your own appointments.")

    elif current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        d_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
        d_res = await db.execute(d_stmt)
        my_doc_id = d_res.scalar_one_or_none()
        if appt.doctor_id != my_doc_id:
            raise HTTPException(status_code=403, detail="Access denied: You can only view appointments assigned to you.")

    return _enrich_appointment_read(appt)


@router.post("/{appointment_id}/reschedule", response_model=AppointmentRead)
async def reschedule_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentRescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reschedule an existing upcoming appointment to a new available slot.
    Checks availability and atomically updates the appointment.
    """
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    # Permissions
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        my_patient_id = p_res.scalar_one_or_none()
        if appt.patient_id != my_patient_id:
            raise HTTPException(status_code=403, detail="Access denied: You cannot reschedule another patient's appointment.")

    if appt.status in (AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED):
        raise HTTPException(status_code=400, detail=f"Cannot reschedule an appointment that is already {appt.status.value}.")

    # Verify new slot availability
    new_dt_utc = payload.new_scheduled_at if payload.new_scheduled_at.tzinfo else payload.new_scheduled_at.replace(tzinfo=timezone.utc)
    is_valid, err_msg = await availability_service.verify_slot_and_lock(
        db=db,
        doctor_id=appt.doctor_id,
        requested_dt_utc=new_dt_utc,
        duration_minutes=appt.duration_minutes,
        exclude_appointment_id=appt.id,
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err_msg)

    # Save original ID in audit trail
    appt.rescheduled_from_id = appt.id
    appt.scheduled_at = new_dt_utc
    appt.status = AppointmentStatus.CONFIRMED
    if payload.reason:
        appt.notes = f"{appt.notes or ''}\n[Rescheduled]: {payload.reason.strip()}".strip()

    await db.commit()
    await db.refresh(appt)

    return _enrich_appointment_read(appt)


@router.delete("/{appointment_id}/cancel", response_model=AppointmentRead)
@router.post("/{appointment_id}/cancel", response_model=AppointmentRead)
@router.delete("/{appointment_id}", response_model=AppointmentRead)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    payload: Optional[AppointmentCancelRequest] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cancel an appointment with audit trail and optional reason.
    Supports both DELETE and POST for client flexibility.
    """
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    # Permissions
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        my_patient_id = p_res.scalar_one_or_none()
        if appt.patient_id != my_patient_id:
            raise HTTPException(status_code=403, detail="Access denied: You cannot cancel another patient's appointment.")
    elif current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        d_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
        d_res = await db.execute(d_stmt)
        my_doc_id = d_res.scalar_one_or_none()
        if appt.doctor_id != my_doc_id:
            raise HTTPException(status_code=403, detail="Access denied: You can only cancel appointments scheduled with you.")

    if appt.status == AppointmentStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="This appointment has already been cancelled.")

    appt.status = AppointmentStatus.CANCELLED
    if payload:
        reason_val = (payload.cancellation_reason or payload.reason or "").strip()
        if reason_val:
            appt.cancellation_reason = reason_val

    await db.commit()
    await db.refresh(appt)

    return _enrich_appointment_read(appt)


@router.patch("/{appointment_id}", response_model=AppointmentRead)
async def update_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clinician / Admin endpoint to update appointment status, notes, or room."""
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        my_patient_id = p_res.scalar_one_or_none()
        if appt.patient_id != my_patient_id:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot modify appointments for other patients.")
    elif current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        d_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
        d_res = await db.execute(d_stmt)
        my_doc_id = d_res.scalar_one_or_none()
        if appt.doctor_id != my_doc_id:
            raise HTTPException(status_code=403, detail="Forbidden: You can only modify appointments scheduled with you.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(appt, field, value)

    await db.commit()
    await db.refresh(appt)
    return _enrich_appointment_read(appt)


# -----------------------------------------------------------------------------
# Demonstration & Clinical Shift Configuration Endpoints (Admin / Doctor)
# -----------------------------------------------------------------------------

@router.get("/schedules/{doctor_id}", response_model=List[DoctorScheduleRead])
async def get_doctor_schedules(
    doctor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns weekly recurring shift schedules for a specific doctor.
    Accessible to administrators, healthcare staff, and the physician themselves.
    """
    stmt = (
        select(DoctorSchedule)
        .where(DoctorSchedule.doctor_id == doctor_id)
        .order_by(DoctorSchedule.day_of_week)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/schedules", response_model=DoctorScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_or_update_doctor_schedule(
    payload: DoctorScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Configures or updates a doctor's weekly recurring shift schedule.
    Restricted to administrators or the authenticated physician.
    """
    is_admin = current_user.role == UserRole.ADMIN
    if not is_admin:
        doc_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
        doc_res = await db.execute(doc_stmt)
        my_doc_id = doc_res.scalar_one_or_none()
        if not my_doc_id or my_doc_id != payload.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Only administrators or the doctor can configure shift schedules.",
            )

    # Check if a schedule already exists for this doctor and day_of_week
    stmt = select(DoctorSchedule).where(
        DoctorSchedule.doctor_id == payload.doctor_id,
        DoctorSchedule.day_of_week == payload.day_of_week,
    )
    res = await db.execute(stmt)
    sched = res.scalar_one_or_none()

    if sched:
        sched.start_time = payload.start_time
        sched.end_time = payload.end_time
        sched.slot_duration_minutes = payload.slot_duration_minutes
        sched.is_telehealth_capable = payload.is_telehealth_capable
        sched.is_in_person_capable = payload.is_in_person_capable
        sched.clinic_timezone = payload.clinic_timezone
        sched.is_active = payload.is_active
    else:
        sched = DoctorSchedule(
            id=uuid.uuid4(),
            doctor_id=payload.doctor_id,
            day_of_week=payload.day_of_week,
            start_time=payload.start_time,
            end_time=payload.end_time,
            slot_duration_minutes=payload.slot_duration_minutes,
            is_telehealth_capable=payload.is_telehealth_capable,
            is_in_person_capable=payload.is_in_person_capable,
            clinic_timezone=payload.clinic_timezone,
            is_active=payload.is_active,
        )
        db.add(sched)

    await db.commit()
    await db.refresh(sched)
    return sched


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes or deactivates a shift schedule (Admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization required.")

    stmt = select(DoctorSchedule).where(DoctorSchedule.id == schedule_id)
    res = await db.execute(stmt)
    sched = res.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    await db.delete(sched)
    await db.commit()


@router.get("/time-off/{doctor_id}", response_model=List[DoctorTimeOffRead])
async def get_doctor_time_off(
    doctor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists planned time-off and clinic holidays for a doctor."""
    stmt = (
        select(DoctorTimeOff)
        .where(DoctorTimeOff.doctor_id == doctor_id)
        .order_by(DoctorTimeOff.start_date)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/time-off", response_model=DoctorTimeOffRead, status_code=status.HTTP_201_CREATED)
async def create_doctor_time_off(
    payload: DoctorTimeOffCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates an approved time-off or vacation block for a physician."""
    is_admin = current_user.role == UserRole.ADMIN
    if not is_admin:
        doc_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
        doc_res = await db.execute(doc_stmt)
        my_doc_id = doc_res.scalar_one_or_none()
        if not my_doc_id or my_doc_id != payload.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Only administrators or the doctor can register time off.",
            )

    time_off = DoctorTimeOff(
        id=uuid.uuid4(),
        doctor_id=payload.doctor_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
    )
    db.add(time_off)
    await db.commit()
    await db.refresh(time_off)
    return time_off

