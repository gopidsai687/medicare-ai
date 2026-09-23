"""
Clinical Encounter model — SOAP notes (Subjective, Objective, Assessment, Plan).
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from app.models.base import UUIDType
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class EncounterType(str, enum.Enum):
    OUTPATIENT = "outpatient"
    INPATIENT = "inpatient"
    EMERGENCY = "emergency"
    TELEHEALTH = "telehealth"
    FOLLOW_UP = "follow_up"


class EncounterStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SIGNED = "signed"
    ADDENDED = "addended"


class Encounter(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "encounters"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
    )

    encounter_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    encounter_type: Mapped[EncounterType] = mapped_column(
        Enum(EncounterType, name="encounter_type"),
        nullable=False,
        default=EncounterType.OUTPATIENT,
    )
    status: Mapped[EncounterStatus] = mapped_column(
        Enum(EncounterStatus, name="encounter_status"),
        nullable=False,
        default=EncounterStatus.IN_PROGRESS,
        index=True,
    )

    chief_complaint: Mapped[str] = mapped_column(String(500), nullable=False)
    
    # SOAP Note Documentation
    subjective: Mapped[str | None] = mapped_column(Text, nullable=True)  # HPI, review of systems, patient statements
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)   # Vitals, physical exam, lab observations
    assessment: Mapped[str | None] = mapped_column(Text, nullable=True)  # Diagnoses, clinical impression, differential
    plan: Mapped[str | None] = mapped_column(Text, nullable=True)        # Orders, prescriptions, follow-up timeline

    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    doctor = relationship("Doctor", foreign_keys=[doctor_id], lazy="selectin")
    appointment = relationship("Appointment", foreign_keys=[appointment_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<Encounter id={self.id} patient_id={self.patient_id} status={self.status}>"
