"""
Pydantic v2 schemas for Prescription Analysis & Patient Health Guidance.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExtractedItemSchema(BaseModel):
    id: Optional[uuid.UUID] = None
    medication_name: str
    strength: Optional[str] = None
    dosage: Optional[str] = None
    route: Optional[str] = "Oral"
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    confidence_score: float = 1.0
    is_uncertain: bool = False
    uncertainty_reason: Optional[str] = None
    patient_verified: bool = False
    patient_notes: Optional[str] = None


class ExtractedItemUpdate(BaseModel):
    medication_name: str
    strength: Optional[str] = None
    dosage: Optional[str] = None
    route: Optional[str] = "Oral"
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    patient_verified: bool = True
    patient_notes: Optional[str] = None


class ManualPrescriptionEntryRequest(BaseModel):
    items: List[ExtractedItemUpdate] = Field(..., min_length=1)


class ConfirmItemsRequest(BaseModel):
    items: List[ExtractedItemUpdate] = Field(..., min_length=1)


class UploadResponse(BaseModel):
    upload_id: uuid.UUID
    file_name: str
    file_size_bytes: int
    status: str
    raw_ocr_preview: Optional[str] = None
    extracted_items: List[ExtractedItemSchema]
    message: str


class AnalysisReportRead(BaseModel):
    id: uuid.UUID
    upload_id: Optional[uuid.UUID] = None
    patient_id: uuid.UUID
    summary_data: Dict[str, Any]
    medication_guidance: List[Dict[str, Any]]
    next_steps: Dict[str, Any]
    safety_review: Dict[str, Any]
    review_status: str
    reviewed_by_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    ai_provider: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MedicationReminderCreate(BaseModel):
    report_id: Optional[uuid.UUID] = None
    medication_name: str
    dosage: str
    time_of_day: str = "08:00 AM"
    frequency: str = "Daily"
    instructions: Optional[str] = None


class MedicationReminderRead(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    report_id: Optional[uuid.UUID] = None
    medication_name: str
    dosage: str
    time_of_day: str
    frequency: str
    instructions: Optional[str] = None
    is_active: bool
    last_taken_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PrescriptionChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class PrescriptionChatResponse(BaseModel):
    reply: str
    is_emergency: bool
    disclaimer: str


class PrescriptionChatMessageRead(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    is_emergency: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewUpdateRequest(BaseModel):
    review_status: str  # reviewed_by_clinician, flagged_for_pharmacist, pending_review
    review_notes: Optional[str] = None


class AdminMetricsResponse(BaseModel):
    total_analyses: int
    pending_clinician_reviews: int
    unresolved_safety_alerts: int
    ai_service_status: str
    medical_api_status: str


class AdminQueueItem(BaseModel):
    id: uuid.UUID
    patient_name: str
    patient_mrn: str
    created_at: datetime
    review_status: str
    medications_count: int
    critical_alerts_count: int
    requires_pharmacist_review: bool
