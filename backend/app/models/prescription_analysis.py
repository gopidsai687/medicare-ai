"""
Prescription Analysis and Patient Health Guidance Models.
Includes:
  - PrescriptionUpload: uploaded files, OCR text, and extraction state
  - PrescriptionExtractedItem: structured extracted medications with confidence and patient verification
  - PrescriptionAnalysisReport: structured AI analysis, guidance, next-steps checklist, safety review
  - MedicationReminder: patient medication schedule reminders
  - PrescriptionChatMessage: conversational follow-ups with emergency detection
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class UploadStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    EXTRACTED = "extracted"
    CONFIRMED = "confirmed"
    ANALYZED = "analyzed"
    FAILED = "failed"


class ReviewStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    REVIEWED_BY_CLINICIAN = "reviewed_by_clinician"
    FLAGGED_FOR_PHARMACIST = "flagged_for_pharmacist"


class PrescriptionUpload(UUIDMixin, TimestampMixin, Base):
    """Uploaded prescription document (PDF or image)."""
    __tablename__ = "prescription_uploads"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf, image/jpeg, image/png
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[UploadStatus] = mapped_column(
        SQLEnum(UploadStatus, name="prescription_upload_status"),
        nullable=False,
        default=UploadStatus.UPLOADED,
        index=True,
    )
    is_manual_entry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    items = relationship(
        "PrescriptionExtractedItem",
        back_populates="upload",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="PrescriptionExtractedItem.created_at",
    )
    reports = relationship(
        "PrescriptionAnalysisReport",
        back_populates="upload",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<PrescriptionUpload id={self.id} status={self.status} file={self.file_name}>"


class PrescriptionExtractedItem(UUIDMixin, TimestampMixin, Base):
    """Structured prescription item extracted from document or entered manually."""
    __tablename__ = "prescription_extracted_items"

    upload_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("prescription_uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    medication_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    strength: Mapped[str | None] = mapped_column(String(100), nullable=True)      # e.g., "10mg", "500mg"
    dosage: Mapped[str | None] = mapped_column(String(100), nullable=True)        # e.g., "1 tablet", "5ml"
    route: Mapped[str | None] = mapped_column(String(50), default="Oral")         # Oral, Topical, Inhalation
    frequency: Mapped[str | None] = mapped_column(String(100), nullable=True)    # "Once daily in the morning"
    duration: Mapped[str | None] = mapped_column(String(100), nullable=True)     # "30 days" or None
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)        # "Take with food"

    confidence_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    is_uncertain: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    uncertainty_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    patient_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    patient_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    upload = relationship("PrescriptionUpload", back_populates="items")

    def __repr__(self) -> str:
        return f"<PrescriptionExtractedItem id={self.id} med={self.medication_name} verified={self.patient_verified}>"


class PrescriptionAnalysisReport(UUIDMixin, TimestampMixin, Base):
    """Comprehensive AI analysis report and patient guidance."""
    __tablename__ = "prescription_analysis_reports"

    upload_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("prescription_uploads.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Core structured sections
    summary_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    medication_guidance: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    next_steps: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    safety_review: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    review_status: Mapped[ReviewStatus] = mapped_column(
        SQLEnum(ReviewStatus, name="prescription_review_status"),
        nullable=False,
        default=ReviewStatus.PENDING_REVIEW,
        index=True,
    )
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    ai_provider: Mapped[str] = mapped_column(String(100), default="medicare-clinical-ai", nullable=False)

    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    upload = relationship("PrescriptionUpload", back_populates="reports")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id], lazy="selectin")
    reminders = relationship(
        "MedicationReminder",
        back_populates="report",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    chat_messages = relationship(
        "PrescriptionChatMessage",
        back_populates="report",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="PrescriptionChatMessage.created_at",
    )

    def __repr__(self) -> str:
        return f"<PrescriptionAnalysisReport id={self.id} status={self.review_status}>"


class MedicationReminder(UUIDMixin, TimestampMixin, Base):
    """Patient medication reminders created from analyzed prescriptions."""
    __tablename__ = "medication_reminders"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("prescription_analysis_reports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    medication_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    time_of_day: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "08:00 AM"
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)   # e.g., "Daily"
    instructions: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    report = relationship("PrescriptionAnalysisReport", back_populates="reminders")

    def __repr__(self) -> str:
        return f"<MedicationReminder id={self.id} med={self.medication_name} active={self.is_active}>"


class PrescriptionChatMessage(UUIDMixin, TimestampMixin, Base):
    """Multi-turn question-and-answer interactions for an analyzed prescription."""
    __tablename__ = "prescription_chat_messages"

    report_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("prescription_analysis_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "patient" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_emergency: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    report = relationship("PrescriptionAnalysisReport", back_populates="chat_messages")
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<PrescriptionChatMessage id={self.id} role={self.role}>"
