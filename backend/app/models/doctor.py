"""
Doctor model — clinical staff profile.
"""
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from app.models.base import UUIDType
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Doctor(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "doctors"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Professional details
    license_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    specialty: Mapped[str] = mapped_column(String(150), nullable=False)
    sub_specialty: Mapped[str | None] = mapped_column(String(150), nullable=True)
    department: Mapped[str | None] = mapped_column(String(150), nullable=True)
    npi_number: Mapped[str | None] = mapped_column(String(20), nullable=True)  # National Provider ID

    # Contact
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    office_location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status
    is_accepting_patients: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")

    def __repr__(self) -> str:
        return f"<Doctor id={self.id} specialty={self.specialty}>"
