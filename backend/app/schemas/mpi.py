import uuid
from typing import List
from pydantic import BaseModel


class DuplicateCandidate(BaseModel):
    primary_patient_id: uuid.UUID
    duplicate_patient_id: uuid.UUID
    primary_name: str
    duplicate_name: str
    primary_mrn: str
    duplicate_mrn: str
    match_score: float
    confidence_level: str  # "HIGH", "MEDIUM", "LOW"
    match_reasons: List[str]


class MergeRequest(BaseModel):
    survivor_patient_id: uuid.UUID
    merged_patient_id: uuid.UUID
    reason: str


class MergeResponse(BaseModel):
    success: bool
    survivor_mrn: str
    merged_mrn: str
    transferred_appointments: int
    transferred_records: int
    transferred_prescriptions: int
    message: str
