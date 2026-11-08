"""
Hospital and Emergency Contacts Data Models.
Provides institutional directory, trauma hotlines, department links, and regional healthcare facility management.
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin, UUIDType


class Hospital(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "hospitals"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    hospital_type: Mapped[str] = mapped_column(String(100), default="Academic Medical Center", nullable=False)
    address: Mapped[str] = mapped_column(String(255), default="500 Healthcare Blvd, Pavilion North", nullable=False)
    city: Mapped[str] = mapped_column(String(100), default="New York", nullable=False)
    state: Mapped[str] = mapped_column(String(50), default="NY", nullable=False)
    zip_code: Mapped[str] = mapped_column(String(20), default="10001", nullable=False)

    phone: Mapped[str] = mapped_column(String(50), default="(555) 019-2000", nullable=False)
    emergency_phone: Mapped[str] = mapped_column(String(50), default="911 / (555) 019-9911", nullable=False)
    departments_available: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    operating_hours: Mapped[str] = mapped_column(String(255), default="Emergency: 24/7/365 | Outpatient: Mon-Fri 8am-6pm", nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType(), nullable=True)

    # Relationships
    contacts: Mapped[List[HospitalContact]] = relationship(
        "HospitalContact",
        back_populates="hospital",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Hospital {self.name} ({self.hospital_type})>"


class HospitalContact(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "hospital_contacts"

    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_type: Mapped[str] = mapped_column(String(100), default="Emergency Department", nullable=False)
    label: Mapped[str] = mapped_column(String(150), default="Main Emergency Hotline", nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    available_hours: Mapped[str] = mapped_column(String(100), default="24/7", nullable=False)
    is_emergency: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    hospital: Mapped[Hospital] = relationship("Hospital", back_populates="contacts")

    def __repr__(self) -> str:
        return f"<HospitalContact {self.label}: {self.phone}>"

