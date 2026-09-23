import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.appointment import AppointmentStatus, AppointmentType


class AppointmentBase(BaseModel):
    doctor_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = 30
    appointment_type: AppointmentType = AppointmentType.IN_PERSON
    reason: str
    notes: str | None = None


class AppointmentCreate(AppointmentBase):
    patient_id: uuid.UUID | None = None  # If not set, extracted from current patient


class AppointmentUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = None
    status: AppointmentStatus | None = None
    appointment_type: AppointmentType | None = None
    reason: str | None = None
    notes: str | None = None
    room: str | None = None
    telehealth_url: str | None = None


class DoctorBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    specialty: str
    license_number: str


class AppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int
    status: AppointmentStatus
    appointment_type: AppointmentType
    reason: str
    notes: str | None = None
    room: str | None = None
    telehealth_url: str | None = None
    created_at: datetime
    updated_at: datetime
