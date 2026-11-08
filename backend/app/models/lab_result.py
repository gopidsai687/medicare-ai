"""
Lab Result and Lab Result Audit Log models.
Supports comprehensive diagnostic test tracking, amendment workflows, and soft archival.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class LabCategory(str, enum.Enum):
    CBC = "CBC"
    CMP = "CMP"
    LIPID_PANEL = "Lipid Panel"
    HBA1C = "HbA1c"
    THYROID = "Thyroid Function Tests"
    KIDNEY = "Kidney Function Tests"
    LIVER = "Liver Function Tests"
    URINALYSIS = "Urinalysis"
    OTHER = "Other"


class LabResultStatus(str, enum.Enum):
    NORMAL = "Normal"
    ELEVATED = "Elevated"
    LOW = "Low"
    ABNORMAL = "Abnormal"
    CRITICAL = "Critical"


class LabSource(str, enum.Enum):
    LAB_IMPORTED = "lab_imported"
    PATIENT_ENTERED = "patient_entered"
    CLINICAL_STAFF = "clinical_staff"


class LabResult(UUIDMixin, TimestampMixin, Base):
    """
    Standardized laboratory analyte result.
    Can belong to a panel (e.g., CMP, Lipid Panel) or standalone (e.g., HbA1c).
    """
    __tablename__ = "lab_results"

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

    test_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    panel_name: Mapped[str] = mapped_column(String(255), nullable=False, default="Diagnostic Panel")
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="Other", index=True)

    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    range_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    range_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_range: Mapped[str | None] = mapped_column(String(100), nullable=True)

    test_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Normal")
    trend: Mapped[str] = mapped_column(String(20), nullable=False, default="stable")

    ordering_physician: Mapped[str | None] = mapped_column(String(255), nullable=True)
    laboratory_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    clinical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    source: Mapped[str] = mapped_column(String(50), nullable=False, default="lab_imported", index=True)

    # Segregation & Provenance: lab_result | home_monitoring | patient_reported
    result_type: Mapped[str] = mapped_column(String(50), nullable=False, default="lab_result", index=True)
    measurement_time: Mapped[str | None] = mapped_column(String(30), nullable=True)
    measurement_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fasting_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Verification / Repeat Check Tracking
    repeat_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    repeat_time: Mapped[str | None] = mapped_column(String(30), nullable=True)
    repeat_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_repeat_measurement: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    duplicate_reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    educational_notice: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Amendment tracking
    is_amended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    amendment_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_value: Mapped[float | None] = mapped_column(Float, nullable=True)
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

    __table_args__ = (
        Index("ix_lab_results_ptnt_test_date", "patient_id", "test_name", "test_date"),
    )

    def __repr__(self) -> str:
        return f"<LabResult id={self.id} test={self.test_name} value={self.value} {self.unit}>"


class LabResultAuditLog(UUIDMixin, TimestampMixin, Base):
    """
    HIPAA-compliant change and activity log for lab results.
    """
    __tablename__ = "lab_result_audit_logs"

    lab_result_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("lab_results.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # created, updated, amended, archived, restored
    performed_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    performed_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<LabResultAuditLog action={self.action} result={self.lab_result_id}>"
