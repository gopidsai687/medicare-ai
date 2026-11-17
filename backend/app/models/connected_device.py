"""
Connected Devices & Wearable Health Integration Models for MediCare AI.
Supports Apple Health (Apple Watch), Android Health Connect (Samsung Galaxy Watch & Wear OS),
MediCare Mobile Companion, and BLE medical peripherals.
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class ConnectedDeviceType(str, enum.Enum):
    APPLE_HEALTH = "apple_health"
    APPLE_WATCH = "apple_watch"
    ANDROID_HEALTH_CONNECT = "android_health_connect"
    SAMSUNG_GALAXY_WATCH = "samsung_galaxy_watch"
    WEAR_OS = "wear_os"
    MEDICARE_MOBILE_APP = "medicare_mobile_app"
    BLE_PERIPHERAL = "ble_peripheral"
    SIMULATED_DEMO = "simulated_demo"


class ConnectedDeviceStatus(str, enum.Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    PENDING_AUTH = "PENDING_AUTH"
    SYNCING = "SYNCING"
    SYNC_ERROR = "SYNC_ERROR"
    REVOKED = "REVOKED"


class MeasurementCategory(str, enum.Enum):
    HEART_RATE = "heart_rate"
    RESTING_HEART_RATE = "resting_heart_rate"
    BLOOD_PRESSURE = "blood_pressure"
    BLOOD_GLUCOSE = "blood_glucose"
    SPO2 = "spo2"
    STEPS = "steps"
    SLEEP_DURATION = "sleep_duration"
    RESPIRATORY_RATE = "respiratory_rate"
    BODY_TEMPERATURE = "body_temperature"


class ConnectedDevice(UUIDMixin, TimestampMixin, Base):
    """
    Represents an authorized health platform integration or smart wearable device
    linked to a patient's MediCare AI account.
    """
    __tablename__ = "connected_devices"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    device_name: Mapped[str] = mapped_column(String(120), nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(100), default="Apple / Google / Samsung", nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    os_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    status: Mapped[str] = mapped_column(String(30), default=ConnectedDeviceStatus.DISCONNECTED.value, nullable=False)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_frequency_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    
    # Token or device pairing identifier (hashed)
    pairing_identifier: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    client_platform: Mapped[str | None] = mapped_column(String(30), nullable=True) # "iOS", "Android", "Web"
    is_demo_integration: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    measurements = relationship("HealthMeasurement", back_populates="connected_device", cascade="all, delete-orphan", lazy="select")
    sync_logs = relationship("DeviceSyncHistory", back_populates="connected_device", cascade="all, delete-orphan", lazy="select")
    permissions = relationship("HealthPermission", back_populates="connected_device", cascade="all, delete-orphan", lazy="select")

    def __repr__(self) -> str:
        return f"<ConnectedDevice {self.device_name} ({self.device_type}) status={self.status}>"


class HealthMeasurement(UUIDMixin, TimestampMixin, Base):
    """
    Universal time-series physiological measurement repository.
    Enforces idempotent deduplication via SHA-256 reading_hash,
    provenance tracking, and device attribution.
    """
    __tablename__ = "health_measurements"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connected_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("connected_devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    measurement_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    value_numeric: Mapped[float] = mapped_column(Float, nullable=False)
    secondary_value: Mapped[float | None] = mapped_column(Float, nullable=True) # e.g. diastolic for blood pressure
    unit: Mapped[str] = mapped_column(String(20), nullable=False) # "bpm", "mmHg", "mg/dL", "%", "steps", "hours", "°C"

    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    
    # Provenance & Device Attribution
    source_device_type: Mapped[str] = mapped_column(String(60), nullable=False) # e.g. "apple_watch", "galaxy_watch", "apple_health"
    source_device_name: Mapped[str] = mapped_column(String(120), nullable=False) # e.g. "Apple Watch Series 9"
    provenance: Mapped[str] = mapped_column(String(40), default="IMPORT_EXTERNAL", nullable=False) # MEASURED_DEVICE, IMPORT_EXTERNAL, SIMULATED_DEMO
    
    # Idempotent deduplication hash = sha256(patient_id + measurement_type + measured_at.isoformat() + value)
    reading_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True) # e.g. sleep stages breakdown, workout context, SpO2 elevation
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    connected_device = relationship("ConnectedDevice", back_populates="measurements", foreign_keys=[connected_device_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<HealthMeasurement {self.measurement_type}={self.value_numeric} {self.unit} from {self.source_device_name} at {self.measured_at}>"


class DeviceSyncHistory(UUIDMixin, TimestampMixin, Base):
    """
    Audit log of synchronization events between client devices (Apple Health / Health Connect / Mobile)
    and the MediCare AI backend.
    """
    __tablename__ = "device_sync_history"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connected_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("connected_devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    sync_source: Mapped[str] = mapped_column(String(60), nullable=False, index=True) # "apple_health", "android_health_connect", "medicare_mobile_app", "demo_simulator"
    sync_status: Mapped[str] = mapped_column(String(30), default="SUCCESS", nullable=False) # "SUCCESS", "FAILED", "PARTIAL"
    
    records_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_synced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_skipped_duplicate: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sync_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    sync_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    client_info: Mapped[str | None] = mapped_column(String(150), nullable=True) # e.g. "MediCare Mobile 1.0 (iOS 18.2 / iPhone 15 Pro)"

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    connected_device = relationship("ConnectedDevice", back_populates="sync_logs", foreign_keys=[connected_device_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<DeviceSyncHistory source={self.sync_source} status={self.sync_status} synced={self.records_synced}>"


class HealthPermission(UUIDMixin, TimestampMixin, Base):
    """
    Granular patient consent tracking per health metric category.
    Allows patients to selectively grant or revoke synchronization of specific vitals
    (e.g. allow heart rate & steps, but disallow sleep or blood pressure).
    """
    __tablename__ = "health_permissions"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    connected_device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType(),
        ForeignKey("connected_devices.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    integration_type: Mapped[str] = mapped_column(String(60), nullable=False) # "apple_health", "android_health_connect"
    permission_category: Mapped[str] = mapped_column(String(50), nullable=False) # "heart_rate", "resting_heart_rate", "blood_pressure", etc.
    
    is_granted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    connected_device = relationship("ConnectedDevice", back_populates="permissions", foreign_keys=[connected_device_id], lazy="selectin")

    __table_args__ = (
        UniqueConstraint('patient_id', 'integration_type', 'permission_category', name='uq_patient_integration_permission'),
    )

    def __repr__(self) -> str:
        return f"<HealthPermission {self.integration_type} - {self.permission_category} granted={self.is_granted}>"


class HealthNotification(UUIDMixin, TimestampMixin, Base):
    """
    Notifications dispatched to the patient or mobile app regarding
    device connections, synchronization anomalies, or critical wearable metrics.
    """
    __tablename__ = "health_notifications"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), default="SYNC_COMPLETED", nullable=False) # "DEVICE_CONNECTED", "DEVICE_DISCONNECTED", "SYNC_COMPLETED", "SYNC_ERROR", "UNUSUAL_VITAL"
    severity: Mapped[str] = mapped_column(String(20), default="INFO", nullable=False) # "INFO", "WARNING", "URGENT"
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<HealthNotification {self.title} read={self.is_read}>"
