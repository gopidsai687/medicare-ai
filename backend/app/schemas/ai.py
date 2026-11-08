import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    patient_id: Optional[uuid.UUID] = None


class SourceCitation(BaseModel):
    id: str
    category: str
    title: str
    date: Optional[str] = None
    source_date: Optional[str] = None
    details: str
    excerpt: Optional[str] = None
    url_path: Optional[str] = None
    record_url: Optional[str] = None


class DoctorRecommendation(BaseModel):
    id: Optional[str] = None
    doctor_id: str
    name: Optional[str] = None
    doctor_name: str
    specialty: str
    department: str
    qualifications: str
    location: Optional[str] = None
    office_location: str
    consultation_fee: float
    is_accepting_patients: bool
    bio: str
    avatar_url: Optional[str] = None
    next_available_slot: str
    rating: Optional[float] = 4.9
    review_count: Optional[int] = 24
    experience_years: Optional[int] = 10
    hospital_affiliation: Optional[str] = "MediCare Central Medical Center"
    languages: Optional[str] = "English"
    clinic_timezone: Optional[str] = "America/New_York (EST)"
    license_number: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    model: str
    has_medical_disclaimer: bool = True
    rag_sources_used: int = 0
    sources: Optional[List[SourceCitation]] = None
    doctor_recommendations: Optional[List[DoctorRecommendation]] = None
    lab_cards: Optional[List[Dict[str, Any]]] = None
    medication_cards: Optional[List[Dict[str, Any]]] = None
    is_emergency: bool = False
    suggested_followups: Optional[List[str]] = None
    discrepancy_detected: Optional[bool] = False
    discrepancy_details: Optional[Dict[str, Any]] = None
    extracted_symptoms: Optional[List[str]] = None
    bp_classification: Optional[Dict[str, Any]] = None
    clinical_intent: Optional[str] = None
    reconciliation_alerts: Optional[List[Dict[str, Any]]] = None
    quality_gate: Optional[Dict[str, Any]] = None


# ── Drug Interaction Screening Schemas ────────────────────────────────────────

class InteractionCheckRequest(BaseModel):
    medications: List[str]
    patient_id: Optional[uuid.UUID] = None


class InteractionItem(BaseModel):
    drugs: List[str]
    severity: str
    effect: str
    recommendation: str


class InteractionCheckResponse(BaseModel):
    screened_medications: List[str]
    interaction_count: int
    interactions: List[InteractionItem]
    has_critical: bool
    allergy_warnings: List[str] = []
    duplicate_ingredients: List[str] = []
    source_info: str = "Clinical Pharmacology & FDA Drug Safety Guidance, November 2026"
    disclaimer: str = (
        "Automated interaction screening is an educational tool. Never stop or modify "
        "prescribed medication dosages without consulting your prescribing physician or pharmacist."
    )


# ── EHR Profile Response Schema ───────────────────────────────────────────────

class EHRProfileResponse(BaseModel):
    patient_id: str
    name: str
    mrn: str
    blood_type: str
    date_of_birth: Optional[str] = None
    gender: str
    primary_doctor: str
    last_encounter_date: str
    active_medications_count: int
    active_medications: List[Dict[str, Any]]
    inactive_medications: List[Dict[str, Any]]
    reconciliation_alerts: Optional[List[Dict[str, Any]]] = None
    historical_medications: Optional[List[Dict[str, Any]]] = None
    discontinued_medications: Optional[List[Dict[str, Any]]] = None
    allergies: List[Dict[str, Any]]
    confirmed_diagnoses: List[Dict[str, Any]]
    clinical_notes: List[Dict[str, Any]]
    latest_vitals: Dict[str, Any]
    recent_labs: List[Dict[str, Any]]
    upcoming_appointments: List[Dict[str, Any]]
    suggested_prompts: List[Dict[str, str]]


# ── RAG Schemas ───────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    record_id: uuid.UUID


class EmbedResponse(BaseModel):
    record_id: uuid.UUID
    embedding_dim: int
    stored: bool
    text_indexed: str


class SemanticSearchRequest(BaseModel):
    query: str
    patient_id: Optional[uuid.UUID] = None
    top_k: Optional[int] = 5


class SemanticSearchResponse(BaseModel):
    query: str
    results: List[str]
    count: int
