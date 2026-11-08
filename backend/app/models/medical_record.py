"""
Medical record model — clinical history, diagnoses, allergies, surgeries, labs, and immunizations.
Supports role-based provenance, version snapshots, amendment workflows, and soft archival.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class RecordCategory(str, enum.Enum):
    DIAGNOSIS = "diagnosis"
    ALLERGY = "allergy"
    SURGERY = "surgery"
    IMMUNIZATION = "immunization"
    LAB_RESULT = "lab_result"
    DOCUMENT = "document"
    NOTE = "note"
    OTHER = "other"


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
    severity: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g., Mild, Moderate, Severe, Critical
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Extended Clinical & Audit Fields
    provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="clinician_confirmed", nullable=False, index=True)  # clinician_confirmed, patient_reported, external_facility
    is_patient_reported: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    supporting_document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    lab_result_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True, index=True)

    # Amendment tracking
    is_amended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    amendment_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    amended_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    amended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Archival / Soft deletion tracking
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)

    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("Doctor", foreign_keys=[doctor_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<MedicalRecord id={self.id} category={self.category} title={self.title} source={self.source}>"
