"""
Pydantic v2 schemas for Medical Report Analysis & Clinical Guidance.
Includes:
  - Findings & measurements with uncertainty flags
  - Medical terminology explanations in plain language
  - Abnormal result interpretations based on reference ranges
  - What report establishes / does not establish
  - Missing clinical information callouts
  - Your Next Steps checklist and guidance
  - Document-grounded follow-up chat
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MedicalReportFindingSchema(BaseModel):
    name: str
    result_value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    flag: str = "NORMAL"  # NORMAL, HIGH, LOW, ABNORMAL, CRITICAL, UNKNOWN
    clinical_significance: Optional[str] = None
    is_uncertain: bool = False
    uncertainty_reason: Optional[str] = None


class MedicalReportTerminologySchema(BaseModel):
    term: str
    simple_explanation: str
    context: Optional[str] = None


class MedicalReportAbnormalSchema(BaseModel):
    test_name: str
    result_value: str
    reference_range: Optional[str] = None
    simple_explanation: str
    clinical_significance: Optional[str] = None
    severity: str = "MODERATE"  # LOW, MODERATE, HIGH, CRITICAL


class MedicalReportNextStepsSchema(BaseModel):
    summary: str
    practical_actions: List[str] = Field(default_factory=list)
    doctor_questions: List[str] = Field(default_factory=list)
    clarification_needed: Optional[str] = None
    seek_prompt_care_reasons: List[str] = Field(default_factory=list)
    urgency_level: str = "ROUTINE"  # ROUTINE, PROMPT_EVALUATION, EMERGENCY
    disclaimer: str = (
        "This analysis is for educational and informational purposes only and does not replace "
        "evaluation by a licensed healthcare professional. Never stop or modify medical treatments "
        "without consulting your physician."
    )


class MedicalReportUploadResponse(BaseModel):
    upload_id: uuid.UUID
    file_name: str
    file_size_bytes: int
    status: str
    document_type: str
    raw_ocr_preview: Optional[str] = None
    message: str


class MedicalReportAnalysisRead(BaseModel):
    id: uuid.UUID
    upload_id: Optional[uuid.UUID] = None
    patient_id: uuid.UUID
    document_type: str
    patient_info: Dict[str, Any] = Field(default_factory=dict)
    facility_info: Dict[str, Any] = Field(default_factory=dict)
    report_date: Optional[str] = None
    extracted_findings: List[Dict[str, Any]] = Field(default_factory=list)
    terminology_explanations: List[Dict[str, Any]] = Field(default_factory=list)
    abnormal_findings_explained: List[Dict[str, Any]] = Field(default_factory=list)
    key_findings_summary: str = ""
    what_report_establishes: List[str] = Field(default_factory=list)
    what_report_does_not_establish: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    questions_for_doctor: List[str] = Field(default_factory=list)
    next_steps: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float = 0.95
    is_uncertain: bool = False
    uncertainty_reason: Optional[str] = None
    review_status: str = "pending_review"
    reviewed_by_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    ai_provider: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MedicalReportChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1500)


class MedicalReportChatResponse(BaseModel):
    reply: str
    is_emergency: bool = False
    grounded_in_document: bool = True
    disclaimer: str = (
        "Educational explanation only — does not replace professional medical advice. "
        "If you are having a medical emergency, call 911 immediately."
    )


class MedicalReportChatMessageRead(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    is_emergency: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MedicalReportReviewUpdateRequest(BaseModel):
    review_status: str  # reviewed_by_clinician, flagged_for_pharmacist, pending_review
    review_notes: Optional[str] = None
