"""
Doctor model — clinical staff profile.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from app.models.base import UUIDType
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Doctor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "doctors"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Professional details
    license_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    specialty: Mapped[str] = mapped_column(String(150), nullable=False)
    sub_specialty: Mapped[str | None] = mapped_column(String(150), nullable=True)
    department: Mapped[str | None] = mapped_column(String(150), nullable=True)
    npi_number: Mapped[str | None] = mapped_column(String(20), nullable=True)  # National Provider ID

    # Contact
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    office_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Extended Profile Credentials & Directory Info
    qualifications: Mapped[str | None] = mapped_column(String(255), nullable=True, default="MD")
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True, default=10)
    consultation_fee: Mapped[float | None] = mapped_column(Float, nullable=True, default=120.0)
    languages: Mapped[str | None] = mapped_column(String(255), nullable=True, default="English")
    hospital_affiliation: Mapped[str | None] = mapped_column(String(255), nullable=True, default="MediCare Central Medical Center")
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True, default=4.9)
    review_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=24)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)

    # Status & Credential Verification
    is_accepting_patients: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    license_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    reviews = relationship("DoctorReview", back_populates="doctor", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Doctor id={self.id} specialty={self.specialty} fee={self.consultation_fee}>"
