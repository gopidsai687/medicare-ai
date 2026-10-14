"""
Medical device and telemetry models for MediCare AI.
Provides hardware abstraction, protocol adapters, provenance auditing,
and strict validation against unverified non-invasive vital claims.
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class MeasurementProvenance(str, enum.Enum):
    MEASURED_DEVICE = "MEASURED_DEVICE"       # Verified direct reading from physical medical sensor
    IMPORT_EXTERNAL = "IMPORT_EXTERNAL"       # Authorized EHR/Apple Health/Dexcom/Omron cloud sync
    MANUAL_ENTRY = "MANUAL_ENTRY"             # Self-reported patient entry
    SIMULATED_DEMO = "SIMULATED_DEMO"         # Test fixture, clinical simulator, or synthetic demo
    UNAVAILABLE = "UNAVAILABLE"               # Measurement not clinically or physically feasible on hardware


class DeviceProtocol(str, enum.Enum):
    BLE = "BLE"                               # Bluetooth Low Energy (GATT Health Thermometer / Pulse Oximeter)
    WEBSERIAL = "WEBSERIAL"                   # Direct USB-UART / CDC ACM serial stream
    WEBSOCKET = "WEBSOCKET"                   # Full-duplex streaming telemetry socket
    REST = "REST"                             # HTTP/HTTPS push adapter
    WEBHID = "WEBHID"                         # Human Interface Device medical peripheral
    SIMULATED = "SIMULATED"                   # Virtual testbench hardware loop


class DeviceStatus(str, enum.Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    STREAMING = "STREAMING"
    SIGNAL_POOR = "SIGNAL_POOR"
    CALIBRATING = "CALIBRATING"
    ERROR = "ERROR"


class SignalQuality(str, enum.Enum):
    OPTIMAL = "OPTIMAL"                       # High AC amplitude, clear dicrotic notch, good SNR (>25 dB)
    ACCEPTABLE = "ACCEPTABLE"                 # Usable pulse detection, moderate baseline drift
    POOR_PERFUSION = "POOR_PERFUSION"         # Low pulsatile signal (AC/DC < 0.2%), cold extremities
    MOTION_ARTIFACT = "MOTION_ARTIFACT"       # High-frequency motion disruption detected by accelerometer
    EXCESSIVE_PRESSURE = "EXCESSIVE_PRESSURE" # Contact force > 2.5 N occluding capillary beds
    INSUFFICIENT_CONTACT = "INSUFFICIENT_CONTACT" # Contact force < 0.3 N, ambient light leakage


class MedicalDevice(UUIDMixin, TimestampMixin, Base):
    """
    Physical or certified medical peripheral registered to a patient account.
    Tracks hardware capabilities, calibration state, protocol, and connection status.
    """
    __tablename__ = "medical_devices"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_name: Mapped[str] = mapped_column(String(120), nullable=False)
    device_type: Mapped[str] = mapped_column(String(60), nullable=False, default="fingertip_optical_station")
    manufacturer: Mapped[str] = mapped_column(String(100), default="MediCare BioSens Lab")
    model_number: Mapped[str] = mapped_column(String(60), default="MC-BIO-FS100")
    serial_number: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    hardware_revision: Mapped[str] = mapped_column(String(30), default="Rev 2.1")
    firmware_version: Mapped[str] = mapped_column(String(30), default="v1.4.2")
    protocol: Mapped[str] = mapped_column(String(30), default=DeviceProtocol.WEBSERIAL.value, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=DeviceStatus.DISCONNECTED.value, nullable=False)
    
    battery_percentage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_demo_device: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Specific Capability Flags — Honestly represents what sensors physically capture
    supports_heart_rate: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supports_spo2: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supports_perfusion_index: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supports_dermal_temperature: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    supports_contact_force: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Blood Pressure requires pneumatic cuff calibration under IEEE 1708
    supports_blood_pressure: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_bp_calibrated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    bp_calibration_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Glucose is explicitly marked NOT FEASIBLE for non-invasive optical fingertip sensors
    supports_blood_glucose: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_reading_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mac_or_device_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
    telemetry_packets = relationship("DeviceTelemetryPacket", back_populates="device", cascade="all, delete-orphan", lazy="select")


class DeviceTelemetryPacket(UUIDMixin, TimestampMixin, Base):
    """
    Ingested telemetry payload from a registered medical device or test simulator.
    Preserves raw measurement provenance, cryptographic verification, and signal diagnostics.
    """
    __tablename__ = "device_telemetry_packets"

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("medical_devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    packet_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    
    # Direct Physiological Measurements
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)               # bpm (direct peak-to-peak)
    oxygen_saturation: Mapped[float | None] = mapped_column(Float, nullable=True)        # % SpO2 (Beer-Lambert R-ratio)
    perfusion_index: Mapped[float | None] = mapped_column(Float, nullable=True)          # % AC/DC ratio
    dermal_temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)     # °C (IR thermopile)
    contact_force_n: Mapped[float | None] = mapped_column(Float, nullable=True)          # Newtons (piezo/strain load cell)

    # Regulated Surrogate / Reference Measurements
    systolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)              # mmHg (only populated if calibrated)
    diastolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)             # mmHg
    blood_glucose: Mapped[float | None] = mapped_column(Float, nullable=True)            # mg/dL (blocked for pure optical)

    # Signal Diagnostics & Quality Control
    signal_quality: Mapped[str] = mapped_column(String(40), default=SignalQuality.OPTIMAL.value, nullable=False)
    snr_db: Mapped[float | None] = mapped_column(Float, nullable=True)                   # Signal-to-Noise Ratio (dB)
    provenance: Mapped[str] = mapped_column(String(40), default=MeasurementProvenance.MEASURED_DEVICE.value, nullable=False)
    packet_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    validation_status: Mapped[str] = mapped_column(String(30), default="VALID", nullable=False)
    validation_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    device = relationship("MedicalDevice", foreign_keys=[device_id], back_populates="telemetry_packets")
    patient = relationship("Patient", foreign_keys=[patient_id], lazy="selectin")
