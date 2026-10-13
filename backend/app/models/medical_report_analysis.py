"""
Medical Report Analysis Models — Laboratory, Diagnostic, Pathology & Imaging Reports.
Includes:
  - MedicalReportUpload: uploaded document metadata, OCR/extracted text, file storage
  - MedicalReportAnalysisResult: comprehensive structured AI analysis, findings, terminology, next steps
  - MedicalReportChatMessage: document-grounded follow-up Q&A messages
"""
from __future__ import annotations

import uuid
from datetime import datetime
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
from app.models.prescription_analysis import ReviewStatus, UploadStatus


class MedicalReportUpload(UUIDMixin, TimestampMixin, Base):
    """Uploaded clinical report document (PDF, PNG, JPG)."""
    __tablename__ = "medical_report_uploads"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf, jpeg, png
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[UploadStatus] = mapped_column(
        SQLEnum(UploadStatus, name="medical_report_upload_status"),
        nullable=False,
        default=UploadStatus.UPLOADED,
        index=True,
    )
    is_manual_entry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    analyses = relationship(
        "MedicalReportAnalysisResult",
        back_populates="upload",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<MedicalReportUpload id={self.id} file={self.file_name} status={self.status}>"


class MedicalReportAnalysisResult(UUIDMixin, TimestampMixin, Base):
    """Structured AI analysis of an uploaded medical or diagnostic report."""
    __tablename__ = "medical_report_analysis_results"

    upload_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("medical_report_uploads.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Classification & Extracted Metadata
    document_type: Mapped[str] = mapped_column(String(150), default="General Medical Report", nullable=False)
    patient_info: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    facility_info: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    report_date: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Clinical Analysis Sections
    extracted_findings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    terminology_explanations: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    abnormal_findings_explained: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    key_findings_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    what_report_establishes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    what_report_does_not_establish: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    missing_information: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    questions_for_doctor: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    next_steps: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Uncertainty & Quality
    confidence_score: Mapped[float] = mapped_column(Float, default=0.9, nullable=False)
    is_uncertain: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    uncertainty_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Governance & Review
    review_status: Mapped[ReviewStatus] = mapped_column(
        SQLEnum(ReviewStatus, name="medical_report_review_status"),
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

    ai_provider: Mapped[str] = mapped_column(String(100), default="medicare-clinical-report-engine", nullable=False)

    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    upload = relationship("MedicalReportUpload", back_populates="analyses")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id], lazy="selectin")
    chat_messages = relationship(
        "MedicalReportChatMessage",
        back_populates="report_analysis",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="MedicalReportChatMessage.created_at",
    )

    def __repr__(self) -> str:
        return f"<MedicalReportAnalysisResult id={self.id} type={self.document_type} status={self.review_status}>"


class MedicalReportChatMessage(UUIDMixin, TimestampMixin, Base):
    """Document-grounded conversational follow-up messages for a medical report."""
    __tablename__ = "medical_report_chat_messages"

    report_analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("medical_report_analysis_results.id", ondelete="CASCADE"),
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

    report_analysis = relationship("MedicalReportAnalysisResult", back_populates="chat_messages")
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<MedicalReportChatMessage id={self.id} role={self.role}>"
