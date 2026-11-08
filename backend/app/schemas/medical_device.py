"""
Pydantic schemas for medical device management, telemetry ingestion,
provenance auditing, and scientific feasibility reporting.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class MedicalDeviceBase(BaseModel):
    device_name: str = Field(..., max_length=120, description="Display name of the device")
    device_type: str = Field("fingertip_optical_station", max_length=60)
    manufacturer: str = Field("MediCare BioSens Lab", max_length=100)
    model_number: str = Field("MC-BIO-FS100", max_length=60)
    serial_number: str = Field(..., max_length=80)
    hardware_revision: str = Field("Rev 2.1", max_length=30)
    firmware_version: str = Field("v1.4.2", max_length=30)
    protocol: str = Field("WEBSERIAL", max_length=30)
    supports_heart_rate: bool = True
    supports_spo2: bool = True
    supports_perfusion_index: bool = True
    supports_dermal_temperature: bool = True
    supports_contact_force: bool = True
    supports_blood_pressure: bool = False
    supports_blood_glucose: bool = False
    is_demo_device: bool = False
    notes: Optional[str] = None


class MedicalDeviceCreate(MedicalDeviceBase):
    patient_id: Optional[uuid.UUID] = None
    mac_or_device_id: Optional[str] = None


class MedicalDeviceUpdate(BaseModel):
    device_name: Optional[str] = None
    status: Optional[str] = None
    battery_percentage: Optional[int] = None
    firmware_version: Optional[str] = None
    is_bp_calibrated: Optional[bool] = None
    bp_calibration_expiry: Optional[datetime] = None
    notes: Optional[str] = None


class MedicalDeviceRead(MedicalDeviceBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    status: str
    battery_percentage: Optional[int] = None
    is_bp_calibrated: bool
    bp_calibration_expiry: Optional[datetime] = None
    last_heartbeat_at: Optional[datetime] = None
    last_reading_at: Optional[datetime] = None
    last_connected_at: Optional[datetime] = None
    connection_protocol_details: Optional[str] = None
    mac_or_device_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeviceConnectionStatusUpdate(BaseModel):
    status: str = Field(..., description="CONNECTED, DISCONNECTED, CONNECTING, CONNECTION_FAILED, SIMULATION_MODE")
    protocol_details: Optional[str] = None
    failure_reason: Optional[str] = None


class DeviceConnectionEventRead(BaseModel):
    id: uuid.UUID
    device_id: uuid.UUID
    event_type: str
    details: Optional[str] = None
    source_ip: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TelemetryIngestRequest(BaseModel):
    """
    Direct ingestion payload from physical device or adapter.
    Enforces rigorous validation bounds, cryptographic HMAC authentication, and rejects unverified claims.
    """
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sequence_number: Optional[int] = Field(None, ge=1, description="Strictly monotonically increasing packet sequence number")
    heart_rate: Optional[int] = Field(None, ge=30, le=250, description="Direct pulse rate in bpm")
    oxygen_saturation: Optional[float] = Field(None, ge=70.0, le=100.0, description="Oxygen saturation SpO2 %")
    perfusion_index: Optional[float] = Field(None, ge=0.01, le=25.0, description="Perfusion index AC/DC %")
    dermal_temperature_c: Optional[float] = Field(None, ge=20.0, le=44.0, description="Dermal temperature °C")
    contact_force_n: Optional[float] = Field(None, ge=0.0, le=10.0, description="Fingertip contact force Newtons")
    
    systolic_bp: Optional[int] = Field(None, ge=50, le=300, description="Systolic blood pressure mmHg (Requires calibration)")
    diastolic_bp: Optional[int] = Field(None, ge=30, le=200, description="Diastolic blood pressure mmHg (Requires calibration)")
    blood_glucose: Optional[float] = Field(None, ge=20.0, le=600.0, description="Blood glucose mg/dL (NOT feasible on bare optical)")
    
    signal_quality: str = Field("OPTIMAL", description="Signal quality indicator")
    snr_db: Optional[float] = Field(None, description="Signal-to-noise ratio in dB")
    sensor_status: Optional[str] = Field("SENSOR_OK", description="Hardware sensor status: SENSOR_OK, LEADS_OFF, FAULT")
    source_type: str = Field("HARDWARE", description="Measurement source: HARDWARE or SIMULATION")
    provenance: str = Field("MEASURED_DEVICE", description="Source attribution provenance")
    packet_hash: Optional[str] = Field(None, description="SHA-256 packet payload integrity checksum")
    auth_signature: Optional[str] = Field(None, max_length=128, description="HMAC-SHA256 message authentication code (MAC)")
    is_sample: bool = Field(False, description="Whether this is synthetic demo data")

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_drift(cls, v: datetime) -> datetime:
        now = datetime.now(timezone.utc)
        # Convert naive datetime if necessary
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        # Reject future timestamps beyond 5 minutes (clock drift margin)
        if (v - now).total_seconds() > 300:
            raise ValueError("Telemetry packet timestamp cannot be in the future (exceeds clock drift margin of 300s)")
        # Reject stale timestamps beyond 24 hours
        if (now - v).total_seconds() > 86400:
            raise ValueError("Telemetry packet timestamp is stale (> 24 hours old). Must be buffered and synced through archive pipeline.")
        return v

    @field_validator("diastolic_bp")
    @classmethod
    def validate_bp_relationship(cls, v: Optional[int], info) -> Optional[int]:
        if v is not None:
            sys_val = info.data.get("systolic_bp")
            if sys_val is not None and v >= sys_val:
                raise ValueError("Diastolic blood pressure must be strictly lower than systolic blood pressure")
        return v


class DeviceTelemetryPacketRead(BaseModel):
    id: uuid.UUID
    device_id: uuid.UUID
    patient_id: uuid.UUID
    packet_timestamp: datetime
    sequence_number: Optional[int] = None
    heart_rate: Optional[int] = None
    oxygen_saturation: Optional[float] = None
    perfusion_index: Optional[float] = None
    dermal_temperature_c: Optional[float] = None
    contact_force_n: Optional[float] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    blood_glucose: Optional[float] = None
    signal_quality: str
    snr_db: Optional[float] = None
    sensor_status: Optional[str] = "SENSOR_OK"
    source_type: str = "HARDWARE"
    provenance: str
    packet_hash: str
    auth_signature: Optional[str] = None
    auth_verified: bool = False
    is_sample: bool
    validation_status: str
    validation_notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceSimulatorRequest(BaseModel):
    """Configuration for physical hardware simulator (DEMO ONLY)."""
    scenario: str = Field("optimal_pulse", description="optimal_pulse, high_pressure, motion_noise, low_perfusion, sensor_failure, packet_loss, corrupted_signature, calibration_expired")
    device_id: Optional[uuid.UUID] = None
    pulse_bpm: Optional[int] = Field(72, ge=40, le=180)
    spo2_pct: Optional[float] = Field(98.5, ge=80.0, le=100.0)
    contact_force_n: Optional[float] = Field(1.2, ge=0.1, le=5.0)
    temperature_c: Optional[float] = Field(34.2, ge=20.0, le=44.0)
    perfusion_index_pct: Optional[float] = Field(2.4, ge=0.01, le=25.0)
    sensor_leads_connected: Optional[bool] = Field(True, description="Toggle whether physical biosensor leads are attached")
    inject_bad_signature: Optional[bool] = Field(False, description="Simulate cryptographic tamper or corrupted HMAC signature")
    inject_packet_loss: Optional[bool] = Field(False, description="Simulate skipped sequence numbers (packet loss)")
    force_calibration_expired: Optional[bool] = Field(False, description="Simulate expired BP calibration status")


class DeviceCalibrationRequest(BaseModel):
    """Pneumatic cuff reference calibration for cuffless BP estimation."""
    reference_systolic: int = Field(..., ge=70, le=220)
    reference_diastolic: int = Field(..., ge=40, le=130)
    cuff_device_name: str = Field(..., max_length=100, description="e.g. Omron Series 10 Upper Arm BP Monitor")
    pulse_transit_time_ms: Optional[float] = Field(None, description="Calibration baseline PTT")


class SensorFeasibilityItem(BaseModel):
    vital_name: str
    physical_parameter_measured: str
    primary_sensor_technology: str
    direct_clinical_validity: bool
    status: str  # VALIDATED, EXPERIMENTAL_REQUIRES_CALIBRATION, NOT_FEASIBLE
    required_breakthrough: Optional[str] = None
    governing_standards: List[str]
    fda_regulatory_status: str
    clinical_limitations: str


class ScientificFeasibilityReport(BaseModel):
    title: str
    executive_summary: str
    can_measure_both_at_fingertip_without_cuff_or_blood: bool
    sensors: List[SensorFeasibilityItem]
    fda_safety_communications: List[Dict[str, Any]]
    regulatory_pathway: Dict[str, Any]
    clinical_validation_protocol: Dict[str, Any]


class BLEReadingIngestRequest(BaseModel):
    device_name: str = Field(..., max_length=120, description="Display name of Bluetooth medical device")
    device_type: str = Field(..., max_length=60, description="cuff_blood_pressure_monitor, fingerstick_glucometer, continuous_glucose_monitor, etc.")
    serial_number: str = Field(..., max_length=80)
    manufacturer: Optional[str] = Field("Bluetooth SIG Peripheral", max_length=100)
    model_number: Optional[str] = Field("BLE-GATT", max_length=60)
    protocol: Optional[str] = Field("BLE", max_length=30)
    systolic_bp: Optional[int] = Field(None, ge=50, le=300)
    diastolic_bp: Optional[int] = Field(None, ge=30, le=200)
    heart_rate: Optional[int] = Field(None, ge=30, le=250)
    blood_glucose: Optional[float] = Field(None, ge=20.0, le=600.0)
    glucose_unit: Optional[str] = Field("mg/dL", max_length=10)
    glucose_context: Optional[str] = Field("fasting", max_length=50)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

