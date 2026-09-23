import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.models.prescription import PrescriptionStatus


class PrescriptionBase(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    route: str = "Oral"
    start_date: date
    end_date: date | None = None
    refills_remaining: int = 0
    instructions: str | None = None


class PrescriptionCreate(PrescriptionBase):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID | None = None


class PrescriptionUpdate(BaseModel):
    medication_name: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    route: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    refills_remaining: int | None = None
    instructions: str | None = None
    status: PrescriptionStatus | None = None


class PrescriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    medication_name: str
    dosage: str
    frequency: str
    route: str
    start_date: date
    end_date: date | None = None
    refills_remaining: int
    instructions: str | None = None
    status: PrescriptionStatus
    created_at: datetime
    updated_at: datetime
