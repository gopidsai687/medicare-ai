"""
Pydantic schemas for VitalSense health monitoring, trends, device import, reminders, and consent.
Includes deterministic AHA/ACC 2017 BP classification and ADA 2024 Glucose guidelines.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ---------------------------------------------------------
# AHA/ACC 2017 BP Category Helper
# ---------------------------------------------------------
def classify_blood_pressure(systolic: Optional[int], diastolic: Optional[int]) -> Optional[str]:
    if systolic is None or diastolic is None:
        return None
    if systolic > 180 or diastolic > 120:
        return "Hypertensive Crisis"
    if systolic >= 140 or diastolic >= 90:
        return "Hypertension Stage 2"
    if (130 <= systolic <= 139) or (80 <= diastolic <= 89):
        return "Hypertension Stage 1"
    if (120 <= systolic <= 129) and diastolic < 80:
        return "Elevated"
    if systolic < 120 and diastolic < 80:
        return "Normal"
    return "Stage 1"


# ---------------------------------------------------------
# ADA 2024 Glucose Category Helper
# ---------------------------------------------------------
def classify_blood_glucose(glucose_mgdl: Optional[float], context: Optional[str] = "fasting") -> Optional[str]:
    if glucose_mgdl is None:
        return None
    if glucose_mgdl < 70:
        return "Hypoglycemia (Low)"
    
    ctx = (context or "fasting").lower()
    if ctx == "fasting":
        if glucose_mgdl < 100:
            return "Normal Fasting"
        if 100 <= glucose_mgdl <= 125:
            return "Impaired Fasting (Pre-diabetes)"
        return "Elevated (Diabetes Range)"
    elif ctx in ("after_meal", "postprandial"):
        if glucose_mgdl < 140:
            return "Normal Post-meal"
        if 140 <= glucose_mgdl <= 199:
            return "Elevated Post-meal"
        return "Very High Post-meal"
    else:
        if glucose_mgdl < 140:
            return "Normal"
        if 140 <= glucose_mgdl <= 199:
            return "Elevated"
        return "Very High"


# ---------------------------------------------------------
# Base & Read Schemas
# ---------------------------------------------------------
class VitalSignBase(BaseModel):
    recorded_at: datetime
    systolic_bp: Optional[int] = Field(None, ge=40, le=300, description="Systolic blood pressure in mmHg")
    diastolic_bp: Optional[int] = Field(None, ge=30, le=200, description="Diastolic blood pressure in mmHg")
    heart_rate: Optional[int] = Field(None, ge=30, le=250, description="Pulse / heart rate in beats per minute")
    
    blood_glucose: Optional[float] = Field(None, ge=10, le=1200, description="Glucose in designated unit")
    blood_glucose_mmol: Optional[float] = Field(None, ge=0.5, le=66.0, description="Standardized glucose in mmol/L")
    glucose_unit: str = Field("mg/dL", description="mg/dL or mmol/L")
    glucose_context: Optional[str] = Field("fasting", description="fasting, before_meal, after_meal, bedtime, random")
    
    weight: Optional[float] = Field(None, ge=1.0, le=500.0, description="Body weight in kg")
    height: Optional[float] = Field(None, ge=20.0, le=300.0, description="Height in cm")
    temperature: Optional[float] = Field(None, ge=30.0, le=45.0, description="Body temperature in Celsius")
    oxygen_saturation: Optional[float] = Field(None, ge=50.0, le=100.0, description="SpO2 percentage")
    respiratory_rate: Optional[int] = Field(None, ge=5, le=80, description="Breaths per minute")
    
    measurement_source: str = Field("manual_entry", description="manual_entry, apple_health, google_health_connect, omron_connect, dexcom_cgm, freestyle_libre, sample_data")
    device_name: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)
    clinical_notes: Optional[str] = Field(None, max_length=1000)
    is_patient_entered: bool = True
    is_sample: bool = False


class VitalSignCreate(VitalSignBase):
    patient_id: Optional[uuid.UUID] = None


class VitalSignUpdate(BaseModel):
    recorded_at: Optional[datetime] = None
    systolic_bp: Optional[int] = Field(None, ge=40, le=300)
    diastolic_bp: Optional[int] = Field(None, ge=30, le=200)
    heart_rate: Optional[int] = Field(None, ge=30, le=250)
    blood_glucose: Optional[float] = Field(None, ge=10, le=1200)
    glucose_unit: Optional[str] = "mg/dL"
    glucose_context: Optional[str] = None
    weight: Optional[float] = Field(None, ge=1.0, le=500.0)
    notes: Optional[str] = Field(None, max_length=500)
    clinical_notes: Optional[str] = Field(None, max_length=1000)


class VitalSignRead(VitalSignBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    recorded_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    
    # Deterministic Clinical Guideline Additions
    bp_category: Optional[str] = None
    glucose_category: Optional[str] = None
    mean_arterial_pressure: Optional[float] = None


# ---------------------------------------------------------
# Patient Logging Request Schemas
# ---------------------------------------------------------
class BloodPressureLogRequest(BaseModel):
    systolic_bp: int = Field(..., ge=50, le=280, description="Systolic pressure (mmHg)")
    diastolic_bp: int = Field(..., ge=30, le=180, description="Diastolic pressure (mmHg)")
    heart_rate: Optional[int] = Field(None, ge=30, le=240, description="Optional pulse rate (bpm)")
    recorded_at: Optional[datetime] = None
    measurement_source: str = Field("manual_entry", description="Source of reading")
    device_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("diastolic_bp")
    @classmethod
    def validate_bp_relationship(cls, v: int, info) -> int:
        systolic = info.data.get("systolic_bp")
        if systolic is not None and v >= systolic:
            raise ValueError("Diastolic pressure must be strictly lower than systolic pressure")
        return v


class BloodGlucoseLogRequest(BaseModel):
    blood_glucose: float = Field(..., description="Glucose value in specified unit")
    glucose_unit: str = Field("mg/dL", description="'mg/dL' or 'mmol/L'")
    glucose_context: str = Field("fasting", description="fasting, before_meal, after_meal, bedtime, random")
    recorded_at: Optional[datetime] = None
    measurement_source: str = Field("manual_entry", description="Source of reading")
    device_name: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def validate_glucose_range(self) -> "BloodGlucoseLogRequest":
        v = self.blood_glucose
        unit = self.glucose_unit or "mg/dL"
        if unit == "mmol/L":
            if not (0.5 <= v <= 55.0):
                raise ValueError("Blood glucose in mmol/L must be between 0.5 and 55.0")
        else:
            if not (10.0 <= v <= 1000.0):
                raise ValueError("Blood glucose in mg/dL must be between 10.0 and 1000.0")
        return self


class HeartRateLogRequest(BaseModel):
    heart_rate: int = Field(..., ge=30, le=240, description="Pulse rate (bpm)")
    recorded_at: Optional[datetime] = None
    measurement_source: str = Field("manual_entry")
    device_name: Optional[str] = None
    notes: Optional[str] = None


class WeightLogRequest(BaseModel):
    weight: float = Field(..., ge=1.0, le=450.0, description="Weight in kg")
    recorded_at: Optional[datetime] = None
    measurement_source: str = Field("manual_entry")
    device_name: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------
# Batch Device Import
# ---------------------------------------------------------
class DeviceImportRecord(BaseModel):
    recorded_at: datetime
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    blood_glucose: Optional[float] = None
    glucose_unit: Optional[str] = "mg/dL"
    glucose_context: Optional[str] = None
    weight: Optional[float] = None
    notes: Optional[str] = None


class DeviceBatchImportRequest(BaseModel):
    source: str = Field(..., description="apple_health, google_health_connect, omron_connect, dexcom_cgm, freestyle_libre")
    device_name: Optional[str] = None
    readings: List[DeviceImportRecord] = Field(..., min_length=1, max_length=500)


class DeviceBatchImportResponse(BaseModel):
    source: str
    imported_count: int
    skipped_count: int
    details: List[str] = []


# ---------------------------------------------------------
# AI Trend Analysis & Deterministic Stats
# ---------------------------------------------------------
class VitalTrendAnalysisRequest(BaseModel):
    days: int = Field(30, ge=1, le=365)
    measurement_type: str = Field("all", description="all, bp, glucose, weight, heart_rate")


class VitalTrendStats(BaseModel):
    total_readings: int
    date_range_days: int
    # BP Stats
    bp_reading_count: int = 0
    average_systolic: Optional[float] = None
    average_diastolic: Optional[float] = None
    mean_arterial_pressure: Optional[float] = None
    min_bp: Optional[str] = None
    max_bp: Optional[str] = None
    hypertensive_crisis_count: int = 0
    stage2_hypertension_count: int = 0
    normal_bp_percentage: float = 0.0
    # Glucose Stats
    glucose_reading_count: int = 0
    average_glucose_mgdl: Optional[float] = None
    average_glucose_mmol: Optional[float] = None
    time_in_range_percentage: float = 0.0  # 70 - 180 mg/dL
    hypoglycemia_count: int = 0
    hyperglycemia_count: int = 0
    # Pulse & Weight
    average_heart_rate: Optional[float] = None
    latest_weight_kg: Optional[float] = None
    weight_delta_kg: Optional[float] = None
    # Data Quality
    sources_detected: List[str] = []
    missing_data_days: int = 0


class VitalTrendAnalysisResponse(BaseModel):
    period_days: int
    total_measurements: int
    stats: VitalTrendStats
    observations: List[str]
    trend_explanation: str
    data_limitations: List[str]
    suggested_doctor_questions: List[str]
    clinical_safety_notice: str
    generated_at: datetime


# ---------------------------------------------------------
# Reminders
# ---------------------------------------------------------
class VitalReminderBase(BaseModel):
    reminder_type: str = Field(..., description="bp, glucose, weight, heart_rate, general")
    label: str = Field(..., max_length=150)
    time_of_day: str = Field("08:00 AM", max_length=20)
    frequency: str = Field("daily", max_length=30)
    days_of_week: Optional[str] = None
    is_active: bool = True


class VitalReminderCreate(VitalReminderBase):
    pass


class VitalReminderUpdate(BaseModel):
    label: Optional[str] = None
    time_of_day: Optional[str] = None
    frequency: Optional[str] = None
    days_of_week: Optional[str] = None
    is_active: Optional[bool] = None


class VitalReminderRead(VitalReminderBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    patient_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------
# Doctor Sharing Consent
# ---------------------------------------------------------
class VitalSharingConsentCreate(BaseModel):
    doctor_id: uuid.UUID
    notes: Optional[str] = None


class VitalSharingConsentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    is_active: bool
    consented_at: datetime
    revoked_at: Optional[datetime] = None
    notes: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None


class DoctorClinicalNoteRequest(BaseModel):
    clinical_notes: str = Field(..., min_length=2, max_length=1000)


# ---------------------------------------------------------
# Biometric / WebAuthn Schemas
# ---------------------------------------------------------
class WebAuthnRegistrationOptions(BaseModel):
    challenge: str
    rp: dict
    user: dict
    pubKeyCredParams: List[dict]
    timeout: int = 60000
    attestation: str = "none"


class WebAuthnRegisterVerifyRequest(BaseModel):
    credential_id: str
    public_key: str
    device_name: Optional[str] = "Biometric Passkey"


class WebAuthnAuthenticationOptions(BaseModel):
    challenge: str
    allowCredentials: List[dict]
    timeout: int = 60000


class WebAuthnAuthVerifyRequest(BaseModel):
    credential_id: str
    signature: str
    client_data_json: str
