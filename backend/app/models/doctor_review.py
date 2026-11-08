"""
Doctor Review and Patient Feedback Model for MediCare AI.
Tracks patient star ratings, qualitative clinical feedback, verification badges,
and administrative moderation controls.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class DoctorReview(UUIDMixin, TimestampMixin, Base):
    """Patient review, star rating, and feedback for physicians."""
    __tablename__ = "doctor_reviews"

    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 to 5 stars
    review_text: Mapped[str] = mapped_column(Text, nullable=False)
    patient_display_name: Mapped[str] = mapped_column(String(100), default="Verified Patient", nullable=False)
    is_verified_appointment: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # Admin moderation flag

    # Relationships
    doctor = relationship("Doctor", foreign_keys=[doctor_id], lazy="selectin")
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    appointment = relationship("Appointment", foreign_keys=[appointment_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<DoctorReview doc={self.doctor_id} rating={self.rating} approved={self.is_approved}>"
