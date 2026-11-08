"""
Record Version and Medical Record Audit Log models.
Provides audit trails, snapshot versioning, and amendment accountability across all medical records.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class RecordVersion(UUIDMixin, TimestampMixin, Base):
    """
    Immutable version snapshots of clinical records and lab results.
    """
    __tablename__ = "record_versions"

    record_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), nullable=False, index=True)
    record_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # medical_record, lab_result
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # created, updated, amended, archived, restored
    snapshot_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    changed_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<RecordVersion record={self.record_id} v={self.version_number} action={self.action}>"


class MedicalRecordAuditLog(UUIDMixin, TimestampMixin, Base):
    """
    Activity and access log for electronic medical records.
    """
    __tablename__ = "medical_record_audit_logs"

    medical_record_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("medical_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # created, updated, amended, archived, restored, viewed, exported
    performed_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    performed_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<MedicalRecordAuditLog action={self.action} record={self.medical_record_id}>"
