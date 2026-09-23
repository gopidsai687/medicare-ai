import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class VitalSignBase(BaseModel):
    recorded_at: datetime
    heart_rate: int | None = None
    systolic_bp: int | None = None
    diastolic_bp: int | None = None
    temperature: float | None = None
    oxygen_saturation: float | None = None
    respiratory_rate: int | None = None
    blood_glucose: float | None = None
    weight: float | None = None
    height: float | None = None


class VitalSignCreate(VitalSignBase):
    patient_id: uuid.UUID | None = None


class VitalSignRead(VitalSignBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    recorded_by_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
