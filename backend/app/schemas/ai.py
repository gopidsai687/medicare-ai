import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    patient_id: Optional[uuid.UUID] = None


class ChatResponse(BaseModel):
    reply: str
    model: str
    has_medical_disclaimer: bool = True
    rag_sources_used: int = 0


class InteractionCheckRequest(BaseModel):
    medications: List[str]


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
