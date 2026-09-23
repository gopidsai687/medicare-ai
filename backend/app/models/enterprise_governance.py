"""
Enterprise Data Quality, MPI, Audit & Governance Domain Models.
Tables 46–51: dplct_case, ptnt_merge, data_cnflct, rcd_vrsn, adt_log, accs_log
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDType


class DuplicateCase(Base):
    """Table 46: dplct_case — Master Patient Index (MPI) Duplicate Matching Cases"""
    __tablename__ = "dplct_case"

    dplct_case_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    entity_typ_cd: Mapped[str] = mapped_column(String(30), default="PATIENT", nullable=False)
    record_a_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), nullable=False)
    record_b_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), nullable=False)

    nm_mtch_scr: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    dob_mtch_scr: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    phn_mtch_scr: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    email_mtch_scr: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    addr_mtch_scr: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    overall_mtch_scr: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, index=True)

    dplct_sts_cd: Mapped[str] = mapped_column(String(30), default="PENDING_REVIEW", nullable=False)
    detctd_by: Mapped[str] = mapped_column(String(30), default="MPI_ALGORITHM", nullable=False)
    rvwd_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    rvwd_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rvw_nt_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PatientMergeHistory(Base):
    """Table 47: ptnt_merge — MPI Survivor Record Merge History"""
    __tablename__ = "ptnt_merge"

    ptnt_merge_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    survvg_ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="RESTRICT"), nullable=False, index=True)
    mrged_ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="RESTRICT"), nullable=False)

    merge_rsn_txt: Mapped[str] = mapped_column(Text, nullable=False)
    merge_sts_cd: Mapped[str] = mapped_column(String(30), default="COMPLETED", nullable=False)
    prfrmd_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    prfrmd_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    rollback_ref_txt: Mapped[str | None] = mapped_column(String(500), nullable=True)


class DataConflict(Base):
    """Table 48: data_cnflct — Field-Level Data Quality Discrepancies"""
    __tablename__ = "data_cnflct"

    data_cnflct_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    entity_typ_cd: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), nullable=False)
    field_nm: Mapped[str] = mapped_column(String(100), nullable=False)
    value_a_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_b_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    cnflct_sts_cd: Mapped[str] = mapped_column(String(30), default="UNRESOLVED", nullable=False)
    rvwd_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    rvwd_dttm: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rslt_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RecordVersionSnapshot(Base):
    """Table 49: rcd_vrsn — Immutable Snapshots for Legal & Compliance Records"""
    __tablename__ = "rcd_vrsn"

    rcd_vrsn_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    entity_typ_cd: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), nullable=False, index=True)
    vrsn_num: Mapped[int] = mapped_column(Integer, nullable=False)
    data_snapshot_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    chngd_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    chngd_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    chng_rsn_txt: Mapped[str | None] = mapped_column(Text, nullable=True)


class SecurityAuditLog(Base):
    """Table 50: adt_log — HIPAA Security & System Operation Telemetry"""
    __tablename__ = "adt_log"

    adt_log_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    usr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True, index=True)
    actn_cd: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_typ_cd: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    req_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip_addr: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent_txt: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rslt_cd: Mapped[str] = mapped_column(String(30), default="SUCCESS", nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    crte_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class PhiAccessLog(Base):
    """Table 51: accs_log — Sensitive Health Information (PHI) Access Audit"""
    __tablename__ = "accs_log"

    accs_log_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    usr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="RESTRICT"), nullable=False, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="RESTRICT"), nullable=False, index=True)
    accs_typ_cd: Mapped[str] = mapped_column(String(30), nullable=False)  # READ, EXPORT, EMERGENCY_BREAK_GLASS
    resource_typ_cd: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), nullable=True)
    accs_rslt_cd: Mapped[str] = mapped_column(String(30), default="GRANTED", nullable=False)
    req_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    accs_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
