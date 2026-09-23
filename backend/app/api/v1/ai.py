"""
AI Clinical Assistant API — Gemini chat with RAG retrieval, document embedding, and drug interaction screening.
"""
import uuid
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord
from app.models.prescription import Prescription
from app.services.ai_service import ai_service
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    InteractionCheckRequest,
    InteractionCheckResponse,
    EmbedRequest,
    EmbedResponse,
    SemanticSearchRequest,
    SemanticSearchResponse,
)

router = APIRouter(prefix="/ai", tags=["AI Clinical Assistant"])


# ── Helper ────────────────────────────────────────────────────────────────────

async def _resolve_patient_context(
    db: AsyncSession,
    current_user: User,
    patient_id: Optional[uuid.UUID] = None,
) -> tuple[Optional[uuid.UUID], Dict[str, Any]]:
    """Resolve patient context for the calling user."""
    target_patient_id = patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        target_patient_id = p_res.scalar_one_or_none()

    if not target_patient_id:
        return None, {}

    p_stmt = select(Patient).where(Patient.id == target_patient_id)
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()
    if not patient:
        return target_patient_id, {}

    # Fetch diagnoses (recent 5)
    rec_stmt = (
        select(MedicalRecord.title)
        .where(MedicalRecord.patient_id == target_patient_id)
        .limit(5)
    )
    rec_res = await db.execute(rec_stmt)
    diagnoses = [r[0] for r in rec_res.all()]

    # Fetch active medications (recent 5)
    rx_stmt = (
        select(Prescription.medication_name)
        .where(Prescription.patient_id == target_patient_id)
        .limit(5)
    )
    rx_res = await db.execute(rx_stmt)
    medications = [r[0] for r in rx_res.all()]

    context = {
        "name": current_user.full_name,
        "mrn": patient.mrn,
        "blood_type": patient.blood_type,
        "diagnoses": diagnoses,
        "medications": medications,
        "allergies": [],
    }
    return target_patient_id, context


async def _retrieve_rag_chunks(
    db: AsyncSession,
    patient_id: uuid.UUID,
    query: str,
    top_k: int = 4,
) -> List[str]:
    """
    Retrieve semantically relevant medical record chunks for a patient query.
    Uses pgvector cosine similarity on the medical_records embedding column.
    Falls back gracefully if pgvector extension or embedding column is unavailable.
    """
    if not settings.ENABLE_RAG:
        return []

    try:
        # Generate query embedding
        query_embedding = await ai_service.embed_query(query)
        embedding_str = f"[{','.join(str(v) for v in query_embedding)}]"

        # pgvector cosine similarity query — requires embedding column on medical_records
        rag_query = text("""
            SELECT title || ': ' || COALESCE(description, '') AS chunk
            FROM medical_records
            WHERE patient_id = :patient_id
              AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
        """)
        result = await db.execute(
            rag_query,
            {"patient_id": str(patient_id), "embedding": embedding_str, "top_k": top_k},
        )
        chunks = [row[0] for row in result.all() if row[0]]
        return chunks

    except Exception:
        # If pgvector or embedding column not yet set up, return empty list gracefully
        # The AI will still answer using the structured patient_context
        return []


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Multi-turn clinical AI chat with RAG-augmented patient context.
    Retrieves semantically relevant medical records to ground the AI response.
    """
    target_patient_id, patient_context = await _resolve_patient_context(
        db, current_user, payload.patient_id
    )

    # RAG retrieval over patient's medical records
    rag_chunks: List[str] = []
    if target_patient_id and payload.messages:
        user_query = payload.messages[-1].content
        rag_chunks = await _retrieve_rag_chunks(db, target_patient_id, user_query)

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    reply = await ai_service.chat(
        messages=messages,
        role=current_user.role.value,
        patient_context=patient_context or None,
        rag_chunks=rag_chunks or None,
    )

    return ChatResponse(
        reply=reply,
        model=settings.GEMINI_MODEL,
        has_medical_disclaimer=True,
        rag_sources_used=len(rag_chunks),
    )


@router.post("/embed", response_model=EmbedResponse)
async def embed_record(
    payload: EmbedRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate and store a text embedding for a medical record (for RAG indexing).
    Only accessible by doctor/admin roles.
    """
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Only clinicians and admins may index records.")

    # Fetch the medical record
    stmt = select(MedicalRecord).where(MedicalRecord.id == payload.record_id)
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found.")

    # Build text to embed
    text_to_embed = f"{record.title}. {record.description or ''} ICD-10: {record.icd10_code or 'N/A'}."
    embedding = await ai_service.embed_text(text_to_embed)

    # Store embedding if pgvector column exists
    try:
        embedding_str = f"[{','.join(str(v) for v in embedding)}]"
        await db.execute(
            text("UPDATE medical_records SET embedding = CAST(:emb AS vector) WHERE id = :id"),
            {"emb": embedding_str, "id": str(record.id)},
        )
        await db.commit()
        stored = True
    except Exception:
        stored = False

    return EmbedResponse(
        record_id=record.id,
        embedding_dim=len(embedding),
        stored=stored,
        text_indexed=text_to_embed[:200],
    )


@router.post("/search", response_model=SemanticSearchResponse)
async def semantic_search(
    payload: SemanticSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Perform semantic search over a patient's medical records using pgvector.
    Returns the top-k most relevant records for a given natural language query.
    """
    # Resolve patient ID
    target_patient_id = payload.patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        target_patient_id = p_res.scalar_one_or_none()

    if not target_patient_id:
        raise HTTPException(status_code=400, detail="Could not resolve patient.")

    chunks = await _retrieve_rag_chunks(db, target_patient_id, payload.query, top_k=payload.top_k or 5)

    return SemanticSearchResponse(
        query=payload.query,
        results=chunks,
        count=len(chunks),
    )


@router.post("/interactions", response_model=InteractionCheckResponse)
async def check_interactions(
    payload: InteractionCheckRequest,
    current_user: User = Depends(get_current_user),
):
    """Screen a list of medications for clinically significant drug interactions."""
    result = ai_service.check_drug_interactions(payload.medications)
    return result

