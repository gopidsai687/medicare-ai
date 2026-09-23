import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field
from app.models.encounter import EncounterType, EncounterStatus


class EncounterBase(BaseModel):
    patient_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    encounter_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    encounter_type: EncounterType = EncounterType.OUTPATIENT
    chief_complaint: str
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None


class EncounterCreate(EncounterBase):
    doctor_id: uuid.UUID | None = None


class EncounterUpdate(BaseModel):
    encounter_type: EncounterType | None = None
    chief_complaint: str | None = None
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None
    status: EncounterStatus | None = None


class EncounterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    encounter_date: datetime
    encounter_type: EncounterType
    status: EncounterStatus
    chief_complaint: str
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None
    signed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
