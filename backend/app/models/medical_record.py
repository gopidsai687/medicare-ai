"""
Medical record model — clinical history, diagnoses, allergies, surgeries, and labs.
"""
import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from app.models.base import UUIDType
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class RecordCategory(str, enum.Enum):
    DIAGNOSIS = "diagnosis"
    ALLERGY = "allergy"
    SURGERY = "surgery"
    IMMUNIZATION = "immunization"
    LAB_RESULT = "lab_result"
    DOCUMENT = "document"
    NOTE = "note"


class RecordStatus(str, enum.Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"
    INACTIVE = "inactive"
    CHRONIC = "chronic"


class MedicalRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "medical_records"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("doctors.id", ondelete="SET NULL"),
        nullable=True,
    )

    category: Mapped[RecordCategory] = mapped_column(
        Enum(RecordCategory, name="record_category"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icd10_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    status: Mapped[RecordStatus] = mapped_column(
        Enum(RecordStatus, name="record_status"),
        nullable=False,
        default=RecordStatus.ACTIVE,
    )
    severity: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g., Mild, Moderate, Severe
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("Doctor", foreign_keys=[doctor_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<MedicalRecord id={self.id} category={self.category} title={self.title}>"
