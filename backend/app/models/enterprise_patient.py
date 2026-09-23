"""
Enterprise Patient Demographic & Master Index Domain Models.
Tables 1–8: ptnt_dtls, ptnt_cntct, ptnt_addr, ptnt_idntfr, ptnt_emrgncy_cntct, ptnt_insrnc, ptnt_emp, ptnt_prfrnc
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDType


class PatientDetails(Base):
    """Table 1: ptnt_dtls — Master Patient Demographic Identity"""
    __tablename__ = "ptnt_dtls"

    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    mrn: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    usr_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), unique=True, nullable=True)

    ptnt_nm: Mapped[str] = mapped_column(String(200), nullable=False)
    pt_fl_nm: Mapped[str] = mapped_column(String(200), nullable=False)
    pt_frst_nm: Mapped[str] = mapped_column(String(100), nullable=False)
    pt_mdl_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pt_lst_nm: Mapped[str] = mapped_column(String(100), nullable=False)
    pt_prfrd_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pt_prv_nm: Mapped[str | None] = mapped_column(String(200), nullable=True)

    pt_dob: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    pt_sex_cd: Mapped[str] = mapped_column(String(20), nullable=False)
    pt_gndr_idnt_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pt_mrtl_sts_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pt_race_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pt_ethncty_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pt_prfrd_lang_cd: Mapped[str] = mapped_column(String(10), default="EN")
    pt_prmry_lang_cd: Mapped[str] = mapped_column(String(10), default="EN")
    pt_intrprtr_reqd_fl: Mapped[bool] = mapped_column(Boolean, default=False)
    pt_intrprtr_lang_cd: Mapped[str | None] = mapped_column(String(10), nullable=True)

    pt_ctznshp_cd: Mapped[str] = mapped_column(String(30), default="US")
    pt_brth_cntry_cd: Mapped[str] = mapped_column(String(3), default="USA")
    pt_brth_st_cd: Mapped[str | None] = mapped_column(String(10), nullable=True)
    pt_brth_city_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pt_rlgn_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pt_occpn_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pt_emp_sts_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pt_edu_lvl_cd: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pt_bld_typ_cd: Mapped[str | None] = mapped_column(String(5), nullable=True)

    ptnt_sts_cd: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False, index=True)
    pt_dcsd_fl: Mapped[bool] = mapped_column(Boolean, default=False)
    pt_dth_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    pt_prfrd_cntct_mthd_cd: Mapped[str] = mapped_column(String(20), default="PHONE")

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    crte_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updt_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)

    # Relationships
    contacts = relationship("PatientContact", back_populates="patient", cascade="all, delete-orphan", lazy="selectin")
    addresses = relationship("PatientAddress", back_populates="patient", cascade="all, delete-orphan", lazy="selectin")
    identifiers = relationship("PatientIdentifier", back_populates="patient", cascade="all, delete-orphan", lazy="selectin")
    emergency_contacts = relationship("PatientEmergencyContact", back_populates="patient", cascade="all, delete-orphan", lazy="selectin")
    insurances = relationship("PatientInsurance", back_populates="patient", cascade="all, delete-orphan", lazy="selectin")
    employments = relationship("PatientEmployment", back_populates="patient", cascade="all, delete-orphan", lazy="selectin")
    preferences = relationship("PatientPreference", back_populates="patient", cascade="all, delete-orphan", lazy="selectin")

    # Compatibility aliases
    @property
    def id(self) -> uuid.UUID:
        return self.ptnt_id

    @property
    def name(self) -> str:
        return self.ptnt_nm

    @property
    def date_of_birth(self) -> date:
        return self.pt_dob


class PatientContact(Base):
    """Table 2: ptnt_cntct — Contact details (Phone, Email)"""
    __tablename__ = "ptnt_cntct"

    ptnt_cntct_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    cntct_typ_cd: Mapped[str] = mapped_column(String(20), nullable=False)  # PHONE, EMAIL
    cntct_val: Mapped[str] = mapped_column(String(255), nullable=False)
    cntry_cd: Mapped[str] = mapped_column(String(5), default="+1")
    prmry_fl: Mapped[bool] = mapped_column(Boolean, default=False)
    vrfd_fl: Mapped[bool] = mapped_column(Boolean, default=False)
    vrfd_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actv_fl: Mapped[bool] = mapped_column(Boolean, default=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    crte_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updt_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)

    patient = relationship("PatientDetails", back_populates="contacts")


class PatientAddress(Base):
    """Table 3: ptnt_addr — Patient Residential & Mailing Address"""
    __tablename__ = "ptnt_addr"

    ptnt_addr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    addr_typ_cd: Mapped[str] = mapped_column(String(20), default="HOME")
    addr_ln_1: Mapped[str] = mapped_column(String(200), nullable=False)
    addr_ln_2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    addr_ln_3: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city_nm: Mapped[str] = mapped_column(String(100), nullable=False)
    cnty_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    st_cd: Mapped[str] = mapped_column(String(10), nullable=False)
    pstl_cd: Mapped[str] = mapped_column(String(20), nullable=False)
    cntry_cd: Mapped[str] = mapped_column(String(3), default="USA")
    prmry_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    crnt_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    vld_frm_dt: Mapped[date | None] = mapped_column(Date, default=date.today)
    vld_to_dt: Mapped[date | None] = mapped_column(Date, nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    patient = relationship("PatientDetails", back_populates="addresses")


class PatientIdentifier(Base):
    """Table 4: ptnt_idntfr — Multiple Patient Identifiers (MRN, SSN, Passport, Insurance ID)"""
    __tablename__ = "ptnt_idntfr"

    ptnt_idntfr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    idntfr_typ_cd: Mapped[str] = mapped_column(String(30), nullable=False)  # MRN, SSN, PASSPORT, INSURANCE_ID
    idntfr_val: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    issng_org_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    efctv_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    expr_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    idntfr_sts_cd: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    prmry_fl: Mapped[bool] = mapped_column(Boolean, default=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    crte_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updt_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)

    patient = relationship("PatientDetails", back_populates="identifiers")


class PatientEmergencyContact(Base):
    """Table 5: ptnt_emrgncy_cntct — Emergency Contacts & Authorized Representatives"""
    __tablename__ = "ptnt_emrgncy_cntct"

    emrgncy_cntct_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    emrgncy_cntct_nm: Mapped[str] = mapped_column(String(255), nullable=False)
    emrgncy_frst_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    emrgncy_lst_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rltnshp_cd: Mapped[str] = mapped_column(String(50), nullable=False)  # SPOUSE, PARENT, CHILD, GUARDIAN
    phn_num: Mapped[str] = mapped_column(String(30), nullable=False)
    email_addr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    addr_txt: Mapped[str | None] = mapped_column(String(500), nullable=True)
    prmry_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    med_info_auth_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    actv_fl: Mapped[bool] = mapped_column(Boolean, default=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    patient = relationship("PatientDetails", back_populates="emergency_contacts")


class PatientInsurance(Base):
    """Table 6: ptnt_insrnc — Health Insurance Policies & Payers"""
    __tablename__ = "ptnt_insrnc"

    ptnt_insrnc_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    insrnc_pyr_id: Mapped[str] = mapped_column(String(100), nullable=False)
    insrnc_plan_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mbr_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    grp_num: Mapped[str | None] = mapped_column(String(100), nullable=True)
    plcy_num: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sbscbr_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sbscbr_nm: Mapped[str | None] = mapped_column(String(250), nullable=True)
    sbscbr_rltnshp_cd: Mapped[str] = mapped_column(String(30), default="SELF")
    cvg_typ_cd: Mapped[str] = mapped_column(String(30), default="MEDICAL")
    efctv_dt: Mapped[date] = mapped_column(Date, nullable=False)
    trmntn_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    prmry_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    vrfd_fl: Mapped[bool] = mapped_column(Boolean, default=False)
    vrfctn_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    insrnc_sts_cd: Mapped[str] = mapped_column(String(20), default="ACTIVE")

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    patient = relationship("PatientDetails", back_populates="insurances")


class PatientEmployment(Base):
    """Table 7: ptnt_emp — Patient Employer & Occupation History"""
    __tablename__ = "ptnt_emp"

    ptnt_emp_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    emplyr_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    occpn_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    emp_sts_cd: Mapped[str] = mapped_column(String(30), default="EMPLOYED")
    strt_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_dt: Mapped[date | None] = mapped_column(Date, nullable=True)
    emplyr_phn_num: Mapped[str | None] = mapped_column(String(30), nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    patient = relationship("PatientDetails", back_populates="employments")


class PatientPreference(Base):
    """Table 8: ptnt_prfrnc — Clinical & Portal Notification Preferences"""
    __tablename__ = "ptnt_prfrnc"

    ptnt_prfrnc_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    ptnt_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("ptnt_dtls.ptnt_id", ondelete="CASCADE"), nullable=False, index=True)
    prfrnc_typ_cd: Mapped[str] = mapped_column(String(50), nullable=False)  # COMM_METHOD, REMINDER_PREF
    prfrnc_val: Mapped[str] = mapped_column(String(250), nullable=False)
    efctv_dt: Mapped[date | None] = mapped_column(Date, default=date.today)
    actv_fl: Mapped[bool] = mapped_column(Boolean, default=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    patient = relationship("PatientDetails", back_populates="preferences")
