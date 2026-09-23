"""
Enterprise Identity, Provider, Staffing & Facility Domain Models.
Tables 14–23, 35–36: usr, role, prmssn, usr_role, role_prmssn, dctr, spclty, dctr_spclty, dept, dctr_avlblty, rm, bed
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDType


class SystemUser(Base):
    """Table 14: usr — System User Credentials and Auth Identity"""
    __tablename__ = "usr"

    usr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    usr_nm: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email_addr: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    pswd_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    usr_sts_cd: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False, index=True)
    last_lgn_dttm: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    crte_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updt_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)

    roles = relationship("UserRoleMapping", back_populates="user", cascade="all, delete-orphan", lazy="selectin")

    @property
    def id(self) -> uuid.UUID:
        return self.usr_id

    @property
    def email(self) -> str:
        return self.email_addr


class SystemRole(Base):
    """Table 15: role — Security & Clinical Roles"""
    __tablename__ = "role"

    role_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    role_nm: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    role_dscrptn: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role_sts_cd: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    users = relationship("UserRoleMapping", back_populates="role")
    permissions = relationship("RolePermissionMapping", back_populates="role")


class SystemPermission(Base):
    """Table 16: prmssn — Granular Functional Permissions"""
    __tablename__ = "prmssn"

    prmssn_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    prmssn_nm: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    prmssn_dscrptn: Mapped[str | None] = mapped_column(String(500), nullable=True)

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class UserRoleMapping(Base):
    """Table 17: usr_role — User to Role Assignment"""
    __tablename__ = "usr_role"

    usr_role_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    usr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="CASCADE"), nullable=False, index=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("role.role_id", ondelete="CASCADE"), nullable=False, index=True)
    efctv_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expr_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actv_fl: Mapped[bool] = mapped_column(Boolean, default=True)

    user = relationship("SystemUser", back_populates="roles")
    role = relationship("SystemRole", back_populates="users", lazy="selectin")


class RolePermissionMapping(Base):
    """Table 18: role_prmssn — Role to Permission Assignment"""
    __tablename__ = "role_prmssn"

    role_prmssn_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("role.role_id", ondelete="CASCADE"), nullable=False, index=True)
    prmssn_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("prmssn.prmssn_id", ondelete="CASCADE"), nullable=False, index=True)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    role = relationship("SystemRole", back_populates="permissions")
    permission = relationship("SystemPermission", lazy="selectin")


class Department(Base):
    """Table 22: dept — Medical and Clinical Departments"""
    __tablename__ = "dept"

    dept_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    dept_cd: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    dept_nm: Mapped[str] = mapped_column(String(150), nullable=False)
    dept_dscrptn: Mapped[str | None] = mapped_column(String(500), nullable=True)
    locn_nm: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone_num: Mapped[str | None] = mapped_column(String(30), nullable=True)
    dept_sts_cd: Mapped[str] = mapped_column(String(20), default="ACTIVE")

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    doctors = relationship("DoctorDetails", back_populates="department")
    rooms = relationship("FacilityRoom", back_populates="department")


class MedicalSpecialty(Base):
    """Table 20: spclty — Medical Specialties"""
    __tablename__ = "spclty"

    spclty_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    spclty_nm: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    spclty_cd: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    spclty_dscrptn: Mapped[str | None] = mapped_column(String(500), nullable=True)
    actv_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DoctorDetails(Base):
    """Table 19: dctr — Attending Physicians & Specialists"""
    __tablename__ = "dctr"

    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    usr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    dctr_frst_nm: Mapped[str] = mapped_column(String(100), nullable=False)
    dctr_mdl_nm: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dctr_lst_nm: Mapped[str] = mapped_column(String(100), nullable=False)
    dctr_fl_nm: Mapped[str] = mapped_column(String(250), nullable=False)
    dept_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("dept.dept_id", ondelete="SET NULL"), nullable=True)
    lic_num: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    phone_num: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email_addr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    yr_exp_num: Mapped[int] = mapped_column(Integer, default=0)
    dctr_sts_cd: Mapped[str] = mapped_column(String(20), default="ACTIVE")

    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    crte_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updt_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType(), ForeignKey("usr.usr_id", ondelete="SET NULL"), nullable=True)

    department = relationship("Department", back_populates="doctors", lazy="selectin")
    specialties = relationship("DoctorSpecialtyMapping", back_populates="doctor", cascade="all, delete-orphan", lazy="selectin")
    availabilities = relationship("DoctorAvailability", back_populates="doctor", cascade="all, delete-orphan", lazy="selectin")

    @property
    def id(self) -> uuid.UUID:
        return self.dctr_id

    @property
    def full_name(self) -> str:
        return self.dctr_fl_nm


class DoctorSpecialtyMapping(Base):
    """Table 21: dctr_spclty — Doctor Specialties Assignment"""
    __tablename__ = "dctr_spclty"

    dctr_spclty_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False, index=True)
    spclty_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("spclty.spclty_id", ondelete="CASCADE"), nullable=False, index=True)
    prmry_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    actv_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    doctor = relationship("DoctorDetails", back_populates="specialties")
    specialty = relationship("MedicalSpecialty", lazy="selectin")


class DoctorAvailability(Base):
    """Table 23: dctr_avlblty — Doctor Scheduling Shift Slots"""
    __tablename__ = "dctr_avlblty"

    dctr_avlblty_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    dctr_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dctr.dctr_id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_wk_cd: Mapped[str] = mapped_column(String(10), nullable=False)  # MON, TUE, WED, THU, FRI, SAT, SUN
    strt_tm: Mapped[time] = mapped_column(Time, nullable=False)
    end_tm: Mapped[time] = mapped_column(Time, nullable=False)
    slot_dur_min_num: Mapped[int] = mapped_column(Integer, default=30)
    actv_fl: Mapped[bool] = mapped_column(Boolean, default=True)
    efctv_dt: Mapped[date] = mapped_column(Date, default=date.today)
    expr_dt: Mapped[date | None] = mapped_column(Date, nullable=True)

    doctor = relationship("DoctorDetails", back_populates="availabilities")


class FacilityRoom(Base):
    """Table 35: rm — Hospital Room Units"""
    __tablename__ = "rm"

    rm_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    dept_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("dept.dept_id", ondelete="CASCADE"), nullable=False, index=True)
    rm_num: Mapped[str] = mapped_column(String(30), nullable=False)
    rm_typ_cd: Mapped[str] = mapped_column(String(30), default="STANDARD")
    rm_sts_cd: Mapped[str] = mapped_column(String(30), default="AVAILABLE")
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    department = relationship("Department", back_populates="rooms")
    beds = relationship("FacilityBed", back_populates="room", cascade="all, delete-orphan")


class FacilityBed(Base):
    """Table 36: bed — Hospital Bed Assignment Units"""
    __tablename__ = "bed"

    bed_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), primary_key=True, default=uuid.uuid4, index=True)
    rm_id: Mapped[uuid.UUID] = mapped_column(UUIDType(), ForeignKey("rm.rm_id", ondelete="CASCADE"), nullable=False, index=True)
    bed_num: Mapped[str] = mapped_column(String(30), nullable=False)
    bed_typ_cd: Mapped[str] = mapped_column(String(30), default="STANDARD")
    bed_sts_cd: Mapped[str] = mapped_column(String(30), default="VACANT")
    crte_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updt_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    room = relationship("FacilityRoom", back_populates="beds")
