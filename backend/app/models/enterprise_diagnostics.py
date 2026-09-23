"""
Enterprise Laboratory, Diagnostics & Document/RAG Domain Models.
Tables 39–41, 43–45: lab_ordr, lab_rslt, dgnstc_rprt, doc, doc_chunk, doc_embddng
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDType


class LaboratoryOrder(Base):
    """Table 39: lab_ordr — Laboratory Test Orders"""
    __tablename__ = "lab_ordr"

    lab_ordr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    encntr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="SET NULL"), nullable=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False)

    test_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    test_cd: Mapped[str] = mapped_column(String(50), nullable=False)  # LOINC code
    ordr_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ordr_sts_cd: Mapped[str] = mapped_column(String(30), default="REQUESTED", nullable=False)
    priority_cd: Mapped[str] = mapped_column(String(20), default="ROUTINE", nullable=False)
    instrctn_txt: Mapped[str | None] = mapped_column(Text, nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    results = relationship("LaboratoryResult", back_populates="order", cascade="all, delete-orphan")


class LaboratoryResult(Base):
    """Table 40: lab_rslt — Laboratory Analyte Results"""
    __tablename__ = "lab_rslt"

    lab_rslt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    lab_ordr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("lab_ordr.lab_ordr_id", ondelete="CASCADE"), nullable=False, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    encntr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="SET NULL"), nullable=True)

    test_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    test_cd: Mapped[str] = mapped_column(String(50), nullable=False)
    rslt_val: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rslt_num_val: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    unit_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    ref_rng_txt: Mapped[str | None] = mapped_column(String(100), nullable=True)
    abnrml_fl: Mapped[bool] = mapped_column(Boolean, default=False)
    rslt_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    vrfd_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    lab_rslt_sts_cd: Mapped[str] = mapped_column(String(30), default="FINAL", nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("LaboratoryOrder", back_populates="results")


class DiagnosticReport(Base):
    """Table 41: dgnstc_rprt — Narrative Radiology & Pathology Reports"""
    __tablename__ = "dgnstc_rprt"

    dgnstc_rprt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    encntr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="SET NULL"), nullable=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="RESTRICT"), nullable=False)

    rprt_typ_cd: Mapped[str] = mapped_column(String(50), nullable=False)  # RADIOLOGY, PATHOLOGY, ECG, ECHO
    rprt_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    rprt_txt: Mapped[str] = mapped_column(Text, nullable=False)
    rprt_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    rprt_sts_cd: Mapped[str] = mapped_column(String(30), default="FINAL", nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ClinicalDocument(Base):
    """Table 43: doc — File & Clinical Attachment Vault"""
    __tablename__ = "doc"

    doc_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    encntr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="SET NULL"), nullable=True)

    doc_typ_cd: Mapped[str] = mapped_column(String(50), nullable=False)
    file_nm: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_typ: Mapped[str] = mapped_column(String(100), default="application/pdf", nullable=False)
    file_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    file_sz_num: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    upld_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    upld_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    doc_sts_cd: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """Table 44: doc_chunk — Document Semantic Chunks for AI Retrieval"""
    __tablename__ = "doc_chunk"

    doc_chunk_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    doc_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("doc.doc_id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_seq_num: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_txt: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    document = relationship("ClinicalDocument", back_populates="chunks")
    embedding = relationship("DocumentEmbedding", back_populates="chunk", uselist=False, cascade="all, delete-orphan")


class DocumentEmbedding(Base):
    """Table 45: doc_embddng — Document Chunk Embeddings"""
    __tablename__ = "doc_embddng"

    doc_embddng_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    doc_chunk_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("doc_chunk.doc_chunk_id", ondelete="CASCADE"), unique=True, nullable=False)
    model_nm: Mapped[str] = mapped_column(String(100), default="text-embedding-004", nullable=False)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chunk = relationship("DocumentChunk", back_populates="embedding")
