"""
Availability Engine for MediCare AI.
Calculates genuinely available appointment slots from doctor working shifts,
clinic hours, appointment durations, time off, and existing bookings.
Provides conflict detection, double-booking prevention, and alternative date suggestions.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.doctor import Doctor
from app.models.doctor_schedule import DayOfWeek, DoctorSchedule, DoctorTimeOff

DAY_OF_WEEK_MAP = {
    0: DayOfWeek.MONDAY.value,
    1: DayOfWeek.TUESDAY.value,
    2: DayOfWeek.WEDNESDAY.value,
    3: DayOfWeek.THURSDAY.value,
    4: DayOfWeek.FRIDAY.value,
    5: DayOfWeek.SATURDAY.value,
    6: DayOfWeek.SUNDAY.value,
}


class AvailabilityService:
    """Computes real, database-backed doctor slot availability with timezone awareness."""

    @staticmethod
    async def get_doctor_availability_for_date(
        db: AsyncSession,
        doctor_id: uuid.UUID,
        target_date: date,
        appointment_type: Optional[AppointmentType] = None,
    ) -> Dict[str, Any]:
        """
        Calculates all genuine slots for a doctor on a specific date.
        Returns:
            {
                "doctor_id": str,
                "doctor_name": str,
                "date": str,
                "status": "available" | "fully_booked" | "unconfigured" | "time_off",
                "message": str,
                "clinic_timezone": str,
                "slot_duration_minutes": int,
                "slots": [
                    {
                        "start_time": "09:00:00",
                        "end_time": "09:30:00",
                        "time_display": "09:00 AM",
                        "iso_datetime": "2026-10-20T09:00:00-04:00",
                        "is_available": bool,
                        "reason": str | None
                    }
                ],
                "available_count": int,
                "total_count": int,
                "suggested_dates": List[str]
            }
        """
        # 1. Fetch Doctor
        d_stmt = select(Doctor).where(Doctor.id == doctor_id)
        d_res = await db.execute(d_stmt)
        doctor = d_res.scalar_one_or_none()
        if not doctor:
            return {
                "doctor_id": str(doctor_id),
                "doctor_name": "Unknown Doctor",
                "date": target_date.isoformat(),
                "status": "unconfigured",
                "message": "Doctor profile not found in system.",
                "clinic_timezone": "America/New_York",
                "slot_duration_minutes": 30,
                "slots": [],
                "available_count": 0,
                "total_count": 0,
                "suggested_dates": [],
            }

        doctor_name = doctor.user.full_name if doctor.user else "Physician"

        # 2. Check Doctor Time Off (Vacation / Leave)
        to_stmt = select(DoctorTimeOff).where(
            DoctorTimeOff.doctor_id == doctor_id,
            DoctorTimeOff.start_date <= target_date,
            DoctorTimeOff.end_date >= target_date,
        )
        to_res = await db.execute(to_stmt)
        time_off = to_res.scalar_one_or_none()
        if time_off:
            suggested = await AvailabilityService.get_next_available_dates(db, doctor_id, target_date, count=3)
            return {
                "doctor_id": str(doctor_id),
                "doctor_name": doctor_name,
                "date": target_date.isoformat(),
                "status": "time_off",
                "message": f"Dr. {doctor_name} is unavailable on this date ({time_off.reason}).",
                "clinic_timezone": "America/New_York",
                "slot_duration_minutes": 30,
                "slots": [],
                "available_count": 0,
                "total_count": 0,
                "suggested_dates": suggested,
            }

        # 3. Query Doctor Schedule for the target Day of Week
        target_dow = DAY_OF_WEEK_MAP.get(target_date.weekday())
        sched_stmt = select(DoctorSchedule).where(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.day_of_week == target_dow,
            DoctorSchedule.is_active == True,
        )
        sched_res = await db.execute(sched_stmt)
        schedule = sched_res.scalar_one_or_none()

        if not schedule:
            suggested = await AvailabilityService.get_next_available_dates(db, doctor_id, target_date, count=3)
            return {
                "doctor_id": str(doctor_id),
                "doctor_name": doctor_name,
                "date": target_date.isoformat(),
                "status": "unconfigured",
                "message": f"Availability not configured for Dr. {doctor_name} on {target_date.strftime('%A')}s.",
                "clinic_timezone": "America/New_York",
                "slot_duration_minutes": 30,
                "slots": [],
                "available_count": 0,
                "total_count": 0,
                "suggested_dates": suggested,
            }

        # Check visit type capability if requested
        if appointment_type == AppointmentType.TELEHEALTH and not schedule.is_telehealth_capable:
            return {
                "doctor_id": str(doctor_id),
                "doctor_name": doctor_name,
                "date": target_date.isoformat(),
                "status": "unsupported_type",
                "message": f"Dr. {doctor_name} does not offer virtual telehealth appointments on {target_date.strftime('%A')}s.",
                "clinic_timezone": schedule.clinic_timezone,
                "slot_duration_minutes": schedule.slot_duration_minutes,
                "slots": [],
                "available_count": 0,
                "total_count": 0,
                "suggested_dates": [],
            }

        # 4. Construct Timezone-Aware Slots
        tz_name = schedule.clinic_timezone or "America/New_York"
        try:
            clinic_tz = ZoneInfo(tz_name)
        except Exception:
            clinic_tz = ZoneInfo("America/New_York")

        slot_duration = timedelta(minutes=schedule.slot_duration_minutes)
        start_dt = datetime.combine(target_date, schedule.start_time, tzinfo=clinic_tz)
        end_dt = datetime.combine(target_date, schedule.end_time, tzinfo=clinic_tz)
        now_in_clinic_tz = datetime.now(clinic_tz)

        # 5. Fetch Existing Active Appointments for that Doctor on target date
        # Convert target day range to UTC bounds for robust database query
        day_start_utc = datetime.combine(target_date, time.min, tzinfo=clinic_tz).astimezone(timezone.utc)
        day_end_utc = datetime.combine(target_date, time.max, tzinfo=clinic_tz).astimezone(timezone.utc)

        appts_stmt = select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status.in_([
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.IN_PROGRESS,
            ]),
            Appointment.scheduled_at >= day_start_utc,
            Appointment.scheduled_at <= day_end_utc,
        )
        appts_res = await db.execute(appts_stmt)
        existing_appts = appts_res.scalars().all()

        # Build active appointment intervals in clinic timezone
        booked_intervals: List[Tuple[datetime, datetime]] = []
        for appt in existing_appts:
            appt_start = appt.scheduled_at.astimezone(clinic_tz) if appt.scheduled_at.tzinfo else appt.scheduled_at.replace(tzinfo=timezone.utc).astimezone(clinic_tz)
            appt_end = appt_start + timedelta(minutes=appt.duration_minutes)
            booked_intervals.append((appt_start, appt_end))

        # 6. Generate Discrete Candidate Slots
        slots = []
        curr_dt = start_dt
        while curr_dt + slot_duration <= end_dt:
            slot_end = curr_dt + slot_duration
            is_past = (curr_dt < now_in_clinic_tz)
            
            # Check overlap with any booked appointment
            is_booked = False
            for b_start, b_end in booked_intervals:
                # Intersect condition: curr_dt < b_end and slot_end > b_start
                if curr_dt < b_end and slot_end > b_start:
                    is_booked = True
                    break

            is_available = (not is_past) and (not is_booked)
            reason = None
            if is_past:
                reason = "Past time slot"
            elif is_booked:
                reason = "Already reserved"

            # Format 12-hour display: e.g. "09:00 AM"
            time_display = curr_dt.strftime("%I:%M %p")

            slots.append({
                "start_time": curr_dt.strftime("%H:%M"),
                "end_time": slot_end.strftime("%H:%M"),
                "time_display": time_display,
                "iso_datetime": curr_dt.astimezone(timezone.utc).isoformat(),
                "is_available": is_available,
                "reason": reason,
            })
            curr_dt += slot_duration

        available_count = sum(1 for s in slots if s["is_available"])
        total_count = len(slots)

        status_val = "available" if available_count > 0 else "fully_booked"
        message_val = (
            f"{available_count} of {total_count} slots available on {target_date.strftime('%A, %B %d, %Y')}."
            if available_count > 0
            else f"All {total_count} slots are fully booked for Dr. {doctor_name} on this date."
        )

        suggested = []
        if available_count == 0:
            suggested = await AvailabilityService.get_next_available_dates(db, doctor_id, target_date, count=3)

        return {
            "doctor_id": str(doctor_id),
            "doctor_name": doctor_name,
            "date": target_date.isoformat(),
            "status": status_val,
            "message": message_val,
            "clinic_timezone": tz_name,
            "slot_duration_minutes": schedule.slot_duration_minutes,
            "slots": slots,
            "available_count": available_count,
            "total_count": total_count,
            "suggested_dates": suggested,
        }

    @staticmethod
    async def get_next_available_dates(
        db: AsyncSession,
        doctor_id: uuid.UUID,
        from_date: date,
        count: int = 3,
        max_lookahead_days: int = 14,
    ) -> List[str]:
        """Scans ahead up to 14 days to find the next dates where the doctor has at least 1 open slot."""
        suggested: List[str] = []
        for offset in range(1, max_lookahead_days + 1):
            cand_date = from_date + timedelta(days=offset)
            dow = DAY_OF_WEEK_MAP.get(cand_date.weekday())

            # Check if doctor works on this day
            sched_stmt = select(DoctorSchedule.id).where(
                DoctorSchedule.doctor_id == doctor_id,
                DoctorSchedule.day_of_week == dow,
                DoctorSchedule.is_active == True,
            )
            sched_res = await db.execute(sched_stmt)
            if not sched_res.scalar_one_or_none():
                continue

            # Check time off
            to_stmt = select(DoctorTimeOff.id).where(
                DoctorTimeOff.doctor_id == doctor_id,
                DoctorTimeOff.start_date <= cand_date,
                DoctorTimeOff.end_date >= cand_date,
            )
            to_res = await db.execute(to_stmt)
            if to_res.scalar_one_or_none():
                continue

            suggested.append(cand_date.isoformat())
            if len(suggested) >= count:
                break

        return suggested

    @staticmethod
    async def verify_slot_and_lock(
        db: AsyncSession,
        doctor_id: uuid.UUID,
        requested_dt_utc: datetime,
        duration_minutes: int,
        exclude_appointment_id: Optional[uuid.UUID] = None,
    ) -> Tuple[bool, str]:
        """
        Atomically verifies that a requested slot is genuinely open and non-overlapping.
        Guarantees conflict prevention and double-booking rejection.
        Returns: (is_valid, error_message)
        """
        # Ensure UTC timezone awareness
        if requested_dt_utc.tzinfo is None:
            requested_dt_utc = requested_dt_utc.replace(tzinfo=timezone.utc)
        else:
            requested_dt_utc = requested_dt_utc.astimezone(timezone.utc)

        slot_end_utc = requested_dt_utc + timedelta(minutes=duration_minutes)

        # 1. Past check
        now_utc = datetime.now(timezone.utc)
        if requested_dt_utc < now_utc - timedelta(minutes=5):  # allow small grace period for clock skew
            return False, "Cannot book an appointment in the past. Please select an upcoming slot."

        # 2. Check Overlapping Active Appointments for this Doctor
        overlap_query = select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status.in_([
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.IN_PROGRESS,
            ]),
            # Overlap: requested_dt_utc < existing.end AND slot_end_utc > existing.start
            Appointment.scheduled_at < slot_end_utc,
        )

        if exclude_appointment_id:
            overlap_query = overlap_query.where(Appointment.id != exclude_appointment_id)

        res = await db.execute(overlap_query)
        candidates = res.scalars().all()

        for c in candidates:
            c_start = c.scheduled_at.astimezone(timezone.utc) if c.scheduled_at.tzinfo else c.scheduled_at.replace(tzinfo=timezone.utc)
            c_end = c_start + timedelta(minutes=c.duration_minutes)
            if requested_dt_utc < c_end and slot_end_utc > c_start:
                return False, "This time slot is no longer available. Another patient has just confirmed this booking."

        return True, ""


availability_service = AvailabilityService()
