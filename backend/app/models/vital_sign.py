"""
Vital signs model — telemetry, measurements, source attribution, and trend metrics.
Includes VitalSense enhanced fields, Reminders, Consent, and Biometrics models.
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from app.models.base import UUIDType
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class MeasurementSource(str, enum.Enum):
    MANUAL_ENTRY = "manual_entry"
    APPLE_HEALTH = "apple_health"
    GOOGLE_HEALTH_CONNECT = "google_health_connect"
    OMRON_CONNECT = "omron_connect"
    DEXCOM_CGM = "dexcom_cgm"
    FREESTYLE_LIBRE = "freestyle_libre"
    SIMULATED_BLE = "simulated_ble"
    SAMPLE_DATA = "sample_data"


class GlucoseContext(str, enum.Enum):
    FASTING = "fasting"
    BEFORE_MEAL = "before_meal"
    AFTER_MEAL = "after_meal"
    BEDTIME = "bedtime"
    RANDOM = "random"


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
    
    # Blood Pressure & Hemodynamics
    systolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)  # mmHg
    diastolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)  # mmHg
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # bpm
    
    # Metabolic & Glucose
    blood_glucose: Mapped[float | None] = mapped_column(Float, nullable=True)  # in glucose_unit (default mg/dL)
    blood_glucose_mmol: Mapped[float | None] = mapped_column(Float, nullable=True)  # mmol/L standardized
    glucose_unit: Mapped[str] = mapped_column(String(10), default="mg/dL", nullable=False)
    glucose_context: Mapped[str | None] = mapped_column(String(50), nullable=True)  # fasting, before_meal, etc.

    # Biometrics & Respiration
    weight: Mapped[float | None] = mapped_column(Float, nullable=True)  # kg
    height: Mapped[float | None] = mapped_column(Float, nullable=True)  # cm
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)  # Celsius
    oxygen_saturation: Mapped[float | None] = mapped_column(Float, nullable=True)  # %
    respiratory_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # breaths/min

    # VitalSense Metadata & Audit
    measurement_source: Mapped[str] = mapped_column(String(50), default="manual_entry", nullable=False, index=True)
    device_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "Omron BP7000", "Dexcom G7"
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    clinical_notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)  # Doctor-entered review note
    is_patient_entered: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<VitalSign patient_id={self.patient_id} recorded_at={self.recorded_at} sbp={self.systolic_bp} dbp={self.diastolic_bp} gluc={self.blood_glucose}>"


class VitalReminder(UUIDMixin, TimestampMixin, Base):
    """Configurable reminder schedule for patients to record measurements."""
    __tablename__ = "vital_reminders"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reminder_type: Mapped[str] = mapped_column(String(50), nullable=False)  # bp, glucose, weight, heart_rate, general
    label: Mapped[str] = mapped_column(String(150), nullable=False)  # e.g., "Morning Blood Pressure Check"
    time_of_day: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g., "08:00 AM"
    frequency: Mapped[str] = mapped_column(String(30), default="daily", nullable=False)  # daily, weekdays, weekly
    days_of_week: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "Mon,Tue,Wed,Thu,Fri"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")


class VitalSharingConsent(UUIDMixin, TimestampMixin, Base):
    """Explicit patient-level consent allowing an authorized doctor to view VitalSense logs."""
    __tablename__ = "vital_sharing_consents"

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
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)


class WebAuthnCredential(UUIDMixin, TimestampMixin, Base):
    """Secure device-bound public key credentials for WebAuthn passkey authentication."""
    __tablename__ = "webauthn_credentials"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    credential_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    public_key: Mapped[str] = mapped_column(Text, nullable=False)  # Base64URL-encoded COSE public key bytes
    sign_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(150), default="Biometric Passkey", nullable=True)  # e.g. "Touch ID", "Windows Hello"
    aaguid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    transports: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WebauthnChallenge(Base):
    """
    Stores server-generated cryptographic challenges for WebAuthn.
    Short-lived (5 minutes TTL).
    """
    __tablename__ = "webauthn_challenges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True, index=True)
    challenge: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)  # "registration" or "authentication"
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class AlertSeverity(str, enum.Enum):
    INFO = "info"
    ATTENTION = "attention"
    URGENT = "urgent"


class AlertStatus(str, enum.Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class VitalAlert(UUIDMixin, TimestampMixin, Base):
    """
    Clinically evaluated alerts triggered by abnormal vitals or stale monitoring.
    Never acts as an automated diagnosis; clearly provides evidence-based guidance.
    """
    __tablename__ = "vital_alerts"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vital_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("vital_signs.id", ondelete="SET NULL"),
        nullable=True,
    )
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), default="attention", nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    clinical_guidance: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)

    # Doctor Follow-up & Audit
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    clinical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    vital = relationship("VitalSign", foreign_keys=[vital_id], lazy="selectin")


class NotificationPreference(UUIDMixin, TimestampMixin, Base):
    """User preferences for push notifications, quiet hours, and alert channels."""
    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    quiet_hours_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    quiet_hours_start: Mapped[str] = mapped_column(String(10), default="22:00", nullable=False)
    quiet_hours_end: Mapped[str] = mapped_column(String(10), default="07:00", nullable=False)
    urgent_override_quiet_hours: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    bp_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    glucose_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reminder_alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    device_token: Mapped[str | None] = mapped_column(Text, nullable=True)

