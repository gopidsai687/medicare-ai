import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.prescription import PrescriptionStatus


class PrescriptionBase(BaseModel):
    medication_name: str = Field(..., min_length=2, description="Prescribed medication name")
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = "Oral Tablet"
    dosage: str = Field(..., description="Dosage amount e.g. 1 tablet, 500mg, 10ml")
    frequency: str = Field(..., description="e.g. Twice daily with meals")
    route: Optional[str] = "Oral"
    start_date: date = Field(default_factory=date.today)
    end_date: Optional[date] = None
    prescription_date: Optional[date] = None
    prescribing_doctor_name: Optional[str] = None
    pharmacy: Optional[str] = None
    refills_remaining: int = 0
    refills_total: Optional[int] = 0
    instructions: Optional[str] = None
    notes: Optional[str] = None
    status: PrescriptionStatus = PrescriptionStatus.ACTIVE
    upload_id: Optional[uuid.UUID] = None
    document_url: Optional[str] = None
    document_name: Optional[str] = None


class PrescriptionCreate(PrescriptionBase):
    patient_id: Optional[uuid.UUID] = None
    doctor_id: Optional[uuid.UUID] = None


class PrescriptionUpdate(BaseModel):
    medication_name: Optional[str] = None
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    prescription_date: Optional[date] = None
    prescribing_doctor_name: Optional[str] = None
    pharmacy: Optional[str] = None
    refills_remaining: Optional[int] = None
    refills_total: Optional[int] = None
    instructions: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[PrescriptionStatus] = None


class PrescriptionAmend(BaseModel):
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[PrescriptionStatus] = None
    reason: str = Field(..., min_length=5, description="Documented clinical justification reason")


class PrescriptionDiscontinue(BaseModel):
    reason: str = Field(..., min_length=3, description="Clinical or patient justification for discontinuation")


class PrescriptionArchive(BaseModel):
    reason: str = Field(..., min_length=3, description="Justification for soft archival")


class ClearPrescriptionHistoryRequest(BaseModel):
    mode: str = Field(..., description="'clear_filters', 'hide_archived', or 'request_retention_review'")
    confirmation: bool = Field(..., description="Explicit user acknowledgment")


class PrescriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: Optional[uuid.UUID] = None
    prescribing_doctor_name: Optional[str] = None
    medication_name: str
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    dosage_form: Optional[str] = None
    dosage: str
    frequency: str
    route: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    prescription_date: Optional[date] = None
    pharmacy: Optional[str] = None
    refills_remaining: int
    refills_total: Optional[int] = 0
    instructions: Optional[str] = None
    notes: Optional[str] = None
    status: PrescriptionStatus
    source: Optional[str] = "patient_manual"
    is_patient_reported: Optional[bool] = True
    is_verified: Optional[bool] = False
    verified_at: Optional[datetime] = None
    discontinued_reason: Optional[str] = None
    discontinued_at: Optional[datetime] = None
    upload_id: Optional[uuid.UUID] = None
    document_url: Optional[str] = None
    document_name: Optional[str] = None
    analysis_report_id: Optional[uuid.UUID] = None
    is_amended: Optional[bool] = False
    amendment_reason: Optional[str] = None
    original_value: Optional[str] = None
    is_archived: Optional[bool] = False
    archived_at: Optional[datetime] = None
    archived_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PrescriptionDashboardMetrics(BaseModel):
    total_prescriptions: int
    active_prescriptions: int
    pending_verification: int
    archived_prescriptions: int
    recent_analyses: int
