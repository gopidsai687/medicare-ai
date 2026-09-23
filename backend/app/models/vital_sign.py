"""
Vital signs model — telemetry, measurements, and trend metrics.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from app.models.base import UUIDType
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class VitalSign(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "vital_signs"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # bpm
    systolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)  # mmHg
    diastolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)  # mmHg
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)  # Celsius
    oxygen_saturation: Mapped[float | None] = mapped_column(Float, nullable=True)  # %
    respiratory_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # breaths/min
    blood_glucose: Mapped[float | None] = mapped_column(Float, nullable=True)  # mg/dL
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)  # kg
    height: Mapped[float | None] = mapped_column(Float, nullable=True)  # cm

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<VitalSign patient_id={self.patient_id} recorded_at={self.recorded_at}>"
