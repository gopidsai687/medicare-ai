"""
Doctor Schedule and Availability models for MediCare AI.
Tracks doctor weekly clinic hours, slot durations, time off, and booking rules.
"""
import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class DayOfWeek(str, enum.Enum):
    MONDAY = "MON"
    TUESDAY = "TUE"
    WEDNESDAY = "WED"
    THURSDAY = "THU"
    FRIDAY = "FRI"
    SATURDAY = "SAT"
    SUNDAY = "SUN"


class DoctorSchedule(UUIDMixin, TimestampMixin, Base):
    """Weekly recurring working shift and slot configuration for a physician."""
    __tablename__ = "doctor_schedules"

    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    day_of_week: Mapped[DayOfWeek] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    is_telehealth_capable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_in_person_capable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    clinic_timezone: Mapped[str] = mapped_column(String(50), default="America/New_York", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    doctor = relationship("Doctor", foreign_keys=[doctor_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<DoctorSchedule doctor={self.doctor_id} day={self.day_of_week} {self.start_time}-{self.end_time}>"


class DoctorTimeOff(UUIDMixin, TimestampMixin, Base):
    """Doctor vacation, leave, or clinic holiday exceptions."""
    __tablename__ = "doctor_time_off"

    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(255), default="Professional Conference / Approved Leave", nullable=False)

    doctor = relationship("Doctor", foreign_keys=[doctor_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<DoctorTimeOff doctor={self.doctor_id} {self.start_date} to {self.end_date}>"
