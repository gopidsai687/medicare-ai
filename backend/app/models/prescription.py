"""
Prescription & Medication Models.
Comprehensive medication management, dosage, refills, schedule, provenance,
audit logging, version snapshots, and intelligent cross-module integration.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class PrescriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    DISCONTINUED = "discontinued"
    PENDING_REFILL = "pending_refill"
    ON_HOLD = "on_hold"
    PENDING_VERIFICATION = "pending_verification"


class PrescriptionSource(str, enum.Enum):
    PATIENT_MANUAL = "patient_manual"
    OCR_UPLOAD = "ocr_upload"
    CLINICIAN_ISSUED = "clinician_issued"
    EHR_IMPORTED = "ehr_imported"


class Prescription(UUIDMixin, TimestampMixin, Base):
    """
    Central shared prescription and medication record.
    Connected across Prescription Analyzer, Medications, Medical Documents, and AI Analyses.
    """
    __tablename__ = "prescriptions"

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
        index=True,
    )
    prescribing_doctor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    medication_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    brand_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    generic_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    strength: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "500 mg", "10 mg"
    dosage_form: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "Oral Tablet", "Capsule", "Inhaler"
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "1 tablet", "500mg"
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Twice daily with meals"
    route: Mapped[str | None] = mapped_column(String(50), default="Oral")  # e.g., Oral, Topical, Subcutaneous

    start_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    prescription_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    pharmacy: Mapped[str | None] = mapped_column(String(255), nullable=True)
    refills_remaining: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    refills_total: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[PrescriptionStatus] = mapped_column(
        Enum(PrescriptionStatus, name="prescription_status"),
        nullable=False,
        default=PrescriptionStatus.ACTIVE,
        index=True,
    )

    # Provenance, Verification & Patient Intake Governance
    source: Mapped[str] = mapped_column(String(50), default="patient_manual", nullable=False)
    is_patient_reported: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Discontinuation tracking
    discontinued_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    discontinued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    discontinued_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)

    # Document & Cross-Module Analysis Linkage
    upload_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True, index=True)
    document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    document_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    analysis_report_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True, index=True)

    # Amendment tracking (HIPAA § 164.526)
    is_amended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    amendment_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    amended_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    amended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Soft Archival
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)

    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("Doctor", foreign_keys=[doctor_id], lazy="selectin")
    audit_logs = relationship(
        "PrescriptionAuditLog",
        back_populates="prescription",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="desc(PrescriptionAuditLog.created_at)",
    )

    def __repr__(self) -> str:
        return f"<Prescription id={self.id} medication={self.medication_name} status={self.status}>"


class PrescriptionAuditLog(UUIDMixin, TimestampMixin, Base):
    """
    Immutable HIPAA audit log for prescription and medication lifecycle actions.
    """
    __tablename__ = "prescription_audit_logs"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    action: Mapped[str] = mapped_column(String(50), nullable=False)  # created, updated, amended, discontinued, archived, restored, refill_requested, verified
    performed_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    performed_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    prescription = relationship("Prescription", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<PrescriptionAuditLog rx={self.prescription_id} action={self.action}>"
