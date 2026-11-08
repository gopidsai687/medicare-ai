"""
External Appointment Model — Patient-Entered Medical Records & Scheduling.
Allows patients to track external hospital, clinic, and specialist appointments
with clear institutional attribution, preventing confusion with internal bookings.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class ExternalAppointment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "external_appointments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    doctor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hospital_name: Mapped[str] = mapped_column(String(255), nullable=False)
    appointment_reference: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    department: Mapped[str] = mapped_column(String(150), default="General Medicine", nullable=False)

    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    status: Mapped[str] = mapped_column(String(50), default="scheduled", nullable=False)
    verification_status: Mapped[str] = mapped_column(String(50), default="patient_entered", nullable=False)
    is_external: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType(), nullable=True)

    # Relationships
    patient = relationship("Patient", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ExternalAppointment {self.appointment_reference} at {self.hospital_name}>"

