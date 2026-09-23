import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.models.medical_record import RecordCategory, RecordStatus


class MedicalRecordBase(BaseModel):
    category: RecordCategory
    title: str
    description: str | None = None
    icd10_code: str | None = None
    record_date: date
    status: RecordStatus = RecordStatus.ACTIVE
    severity: str | None = None
    metadata_json: dict | None = None


class MedicalRecordCreate(MedicalRecordBase):
    patient_id: uuid.UUID | None = None
    doctor_id: uuid.UUID | None = None


class MedicalRecordUpdate(BaseModel):
    category: RecordCategory | None = None
    title: str | None = None
    description: str | None = None
    icd10_code: str | None = None
    record_date: date | None = None
    status: RecordStatus | None = None
    severity: str | None = None
    metadata_json: dict | None = None


class MedicalRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID | None = None
    category: RecordCategory
    title: str
    description: str | None = None
    icd10_code: str | None = None
    record_date: date
    status: RecordStatus
    severity: str | None = None
    metadata_json: dict | None = None
    created_at: datetime
    updated_at: datetime
