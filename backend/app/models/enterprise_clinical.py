"""
Enterprise Clinical, Encounters, Scheduling & Inpatient Domain Models.
Tables 24–34, 37–38, 42: appt, appt_evnt, encntr, dctr_nt, dx, trtmnt_pln, trtmnt_itm, med, rx, srgry, srgry_stff, admssn, dschrg, fllw_up
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDType


class AppointmentMaster(Base):
    """Table 24: appt — Master Appointment Scheduling"""
    __tablename__ = "appt"

    appt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False, index=True)
    dept_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("dept.dept_id", ondelete="SET NULL"), nullable=True)

    appt_typ_cd: Mapped[str] = mapped_column(String(30), default="IN_PERSON", nullable=False)
    schd_strt_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    schd_end_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    appt_sts_cd: Mapped[str] = mapped_column(String(30), default="SCHEDULED", nullable=False, index=True)
    appt_rsn_txt: Mapped[str] = mapped_column(String(1000), nullable=False)

    crte_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updt_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)

    events = relationship("AppointmentEvent", back_populates="appointment", cascade="all, delete-orphan")


class AppointmentEvent(Base):
    """Table 25: appt_evnt — Appointment History Lifecycle Events"""
    __tablename__ = "appt_evnt"

    appt_evnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    appt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("appt.appt_id", ondelete="CASCADE"), nullable=False, index=True)
    evnt_typ_cd: Mapped[str] = mapped_column(String(30), nullable=False)
    old_sts_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    new_sts_cd: Mapped[str] = mapped_column(String(30), nullable=False)
    evnt_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    evnt_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    evnt_rsn_txt: Mapped[str | None] = mapped_column(String(500), nullable=True)

    appointment = relationship("AppointmentMaster", back_populates="events")


class ClinicalEncounter(Base):
    """Table 26: encntr — Encounter Master Hub"""
    __tablename__ = "encntr"

    encntr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False, index=True)
    appt_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("appt.appt_id", ondelete="SET NULL"), nullable=True)

    encntr_typ_cd: Mapped[str] = mapped_column(String(30), default="OUTPATIENT", nullable=False)
    encntr_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    chf_cmpnt_txt: Mapped[str] = mapped_column(String(2000), nullable=False)
    encntr_sts_cd: Mapped[str] = mapped_column(String(20), default="SIGNED", nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    notes = relationship("DoctorNote", back_populates="encounter", cascade="all, delete-orphan")
    diagnoses = relationship("ClinicalDiagnosis", back_populates="encounter")


class DoctorNote(Base):
    """Table 27: dctr_nt — Versioned Physician SOAP Notes"""
    __tablename__ = "dctr_nt"

    dctr_nt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    encntr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="CASCADE"), nullable=False, index=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False, index=True)
    nt_typ_cd: Mapped[str] = mapped_column(String(30), default="SOAP", nullable=False)
    nt_txt: Mapped[str] = mapped_column(Text, nullable=False)
    nt_sts_cd: Mapped[str] = mapped_column(String(20), default="SIGNED", nullable=False)
    vrsn_num: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    crte_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updt_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)

    encounter = relationship("ClinicalEncounter", back_populates="notes")


class ClinicalDiagnosis(Base):
    """Table 28: dx — Coded Diagnoses (ICD-10)"""
    __tablename__ = "dx"

    dx_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    encntr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="SET NULL"), nullable=True)
    dctr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="SET NULL"), nullable=True)

    dx_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    dx_cd: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    dx_dscrptn: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    dx_sts_cd: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)
    onst_dt: Mapped[date | None] = mapped_column(Date, default=date.today)
    rsld_dt: Mapped[date | None] = mapped_column(Date, nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    encounter = relationship("ClinicalEncounter", back_populates="diagnoses")


class TreatmentPlan(Base):
    """Table 29: trtmnt_pln — Longitudinal Care Plans"""
    __tablename__ = "trtmnt_pln"

    trtmnt_pln_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    encntr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="SET NULL"), nullable=True)
    dx_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("dx.dx_id", ondelete="SET NULL"), nullable=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False)

    trtmnt_pln_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    trtmnt_pln_dscrptn: Mapped[str | None] = mapped_column(Text, nullable=True)
    strt_dt: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    end_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    dur_typ_cd: Mapped[str | None] = mapped_column(String(30), default="WEEKS")
    trtmnt_pln_sts_cd: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)
    fllw_up_dt: Mapped[date | None] = mapped_column(Date, nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    items = relationship("TreatmentItem", back_populates="plan", cascade="all, delete-orphan")


class TreatmentItem(Base):
    """Table 30: trtmnt_itm — Protocol Action Items"""
    __tablename__ = "trtmnt_itm"

    trtmnt_itm_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    trtmnt_pln_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("trtmnt_pln.trtmnt_pln_id", ondelete="CASCADE"), nullable=False, index=True)
    trtmnt_typ_cd: Mapped[str] = mapped_column(String(30), nullable=False)  # MEDICATION, SURGERY, THERAPY
    trtmnt_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    trtmnt_dscrptn: Mapped[str | None] = mapped_column(Text, nullable=True)
    strt_dt: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    end_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    trtmnt_instrctn_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    trtmnt_itm_sts_cd: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    plan = relationship("TreatmentPlan", back_populates="items")


class MedicationCatalog(Base):
    """Table 31: med — Medication Catalog & Formulas"""
    __tablename__ = "med"

    med_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    med_nm: Mapped[str] = mapped_column(String(250), nullable=False, index=True)
    gnrc_nm: Mapped[str] = mapped_column(String(250), nullable=False, index=True)
    brnd_nm: Mapped[str | None] = mapped_column(String(250), nullable=True)
    frm_cd: Mapped[str] = mapped_column(String(30), default="TABLET", nullable=False)
    strngth_txt: Mapped[str] = mapped_column(String(100), nullable=False)
    rte_cd: Mapped[str] = mapped_column(String(30), default="ORAL", nullable=False)
    med_dscrptn: Mapped[str | None] = mapped_column(Text, nullable=True)
    actv_fl: Mapped[bool] = mapped_column(Boolean, default=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PrescriptionMaster(Base):
    """Table 32: rx — Patient Prescriptions"""
    __tablename__ = "rx"

    rx_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False, index=True)
    trtmnt_itm_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("trtmnt_itm.trtmnt_itm_id", ondelete="SET NULL"), nullable=True)
    med_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("med.med_id", ondelete="RESTRICT"), nullable=False)

    dose_val: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    dose_unit_cd: Mapped[str] = mapped_column(String(30), default="mg", nullable=False)
    freq_cd: Mapped[str] = mapped_column(String(50), nullable=False)
    rte_cd: Mapped[str] = mapped_column(String(30), default="ORAL", nullable=False)
    dur_val: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    dur_unit_cd: Mapped[str] = mapped_column(String(20), default="DAYS", nullable=False)
    strt_dt: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    end_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    rx_instrctn_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    rfl_num: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rx_sts_cd: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False, index=True)
    prscrbd_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    medication = relationship("MedicationCatalog", lazy="selectin")


class SurgicalProcedure(Base):
    """Table 33: srgry — Surgical Procedures"""
    __tablename__ = "srgry"

    srgry_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    encntr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="SET NULL"), nullable=True)
    trtmnt_pln_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("trtmnt_pln.trtmnt_pln_id", ondelete="SET NULL"), nullable=True)

    prcdr_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    preop_dx_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    postop_dx_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    srgry_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    prmry_srgn_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="RESTRICT"), nullable=False)
    anesthsiolgst_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="SET NULL"), nullable=True)
    prcdr_nt_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    postop_nt_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    cmplctn_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    srgry_sts_cd: Mapped[str] = mapped_column(String(30), default="SCHEDULED", nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    staff = relationship("SurgeryStaffAssignment", back_populates="surgery", cascade="all, delete-orphan")


class SurgeryStaffAssignment(Base):
    """Table 34: srgry_stff — Operating Staff Members"""
    __tablename__ = "srgry_stff"

    srgry_stff_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    srgry_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("srgry.srgry_id", ondelete="CASCADE"), nullable=False, index=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False)
    stff_role_cd: Mapped[str] = mapped_column(String(50), nullable=False)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    surgery = relationship("SurgicalProcedure", back_populates="staff")


class InpatientAdmission(Base):
    """Table 37: admssn — Inpatient Admissions"""
    __tablename__ = "admssn"

    admssn_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    attndng_dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="RESTRICT"), nullable=False)
    dept_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dept.dept_id", ondelete="RESTRICT"), nullable=False)
    rm_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("rm.rm_id", ondelete="SET NULL"), nullable=True)
    bed_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("bed.bed_id", ondelete="SET NULL"), nullable=True)

    admssn_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    admssn_rsn_txt: Mapped[str] = mapped_column(Text, nullable=False)
    admssn_sts_cd: Mapped[str] = mapped_column(String(30), default="ADMITTED", nullable=False, index=True)
    nt_txt: Mapped[str | None] = mapped_column(Text, nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    discharge = relationship("PatientDischarge", back_populates="admission", uselist=False)


class PatientDischarge(Base):
    """Table 38: dschrg — Patient Discharge Summary"""
    __tablename__ = "dschrg"

    dschrg_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    admssn_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("admssn.admssn_id", ondelete="CASCADE"), unique=True, nullable=False)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="RESTRICT"), nullable=False)

    dschrg_dttm: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    dschrg_dx_txt: Mapped[str] = mapped_column(Text, nullable=False)
    dschrg_cond_cd: Mapped[str] = mapped_column(String(30), default="STABLE", nullable=False)
    dschrg_instrctn_txt: Mapped[str] = mapped_column(Text, nullable=False)
    fllw_up_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    dschrg_nt_txt: Mapped[str | None] = mapped_column(Text, nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    admission = relationship("InpatientAdmission", back_populates="discharge")


class ClinicalFollowUp(Base):
    """Table 42: fllw_up — Scheduled Clinical Follow-Ups"""
    __tablename__ = "fllw_up"

    fllw_up_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    encntr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("encntr.encntr_id", ondelete="SET NULL"), nullable=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False)

    fllw_up_dt: Mapped[date] = mapped_column(Date, nullable=False)
    fllw_up_typ_cd: Mapped[str] = mapped_column(String(30), default="POST_DISCHARGE", nullable=False)
    fllw_up_instrctn_txt: Mapped[str | None] = mapped_column(Text, nullable=True)
    fllw_up_sts_cd: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
