import uuid
from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.appointment import AppointmentStatus, AppointmentType
from app.models.doctor_schedule import DayOfWeek


class AppointmentBase(BaseModel):
    doctor_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = 30
    appointment_type: AppointmentType = AppointmentType.IN_PERSON
    reason: str = Field(..., min_length=5, max_length=500, description="Clinical reason or primary symptom for visit")
    notes: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    patient_id: Optional[uuid.UUID] = None


class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[AppointmentStatus] = None
    appointment_type: Optional[AppointmentType] = None
    reason: Optional[str] = Field(None, min_length=5, max_length=500)
    notes: Optional[str] = None
    room: Optional[str] = None
    telehealth_url: Optional[str] = None


class AppointmentRescheduleRequest(BaseModel):
    new_scheduled_at: datetime
    reason: Optional[str] = Field(None, max_length=500, description="Reason for rescheduling")


class AppointmentCancelRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500, description="Reason for cancellation")
    cancellation_reason: Optional[str] = Field(None, max_length=500, description="Alternative field for cancellation reason")


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
    notes: Optional[str] = None
    room: Optional[str] = None
    telehealth_url: Optional[str] = None
    booking_reference: Optional[str] = None
    cancellation_reason: Optional[str] = None
    rescheduled_from_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    # Enriched Fields for Direct Frontend Presentation
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    doctor_department: Optional[str] = None
    doctor_location: Optional[str] = None
    doctor_phone: Optional[str] = None
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    is_upcoming: bool = False
    clinic_timezone: str = "America/New_York"


class DoctorSlotRead(BaseModel):
    start_time: str
    end_time: str
    time_display: str
    label: Optional[str] = None
    duration_minutes: Optional[int] = 30
    iso_datetime: str
    is_available: bool
    reason: Optional[str] = None

    def model_post_init(self, __context) -> None:
        if not self.label:
            self.label = self.time_display


class DoctorAvailabilityResponse(BaseModel):
    doctor_id: str
    doctor_name: str
    date: str
    status: str
    message: str
    clinic_timezone: str
    slot_duration_minutes: int
    slots: List[DoctorSlotRead]
    available_count: int
    total_count: int
    suggested_dates: List[str] = []


class SpecialtyRead(BaseModel):
    name: str
    code: str
    doctor_count: int
    department: str
    description: str


class DoctorProfileRead(BaseModel):
    id: uuid.UUID
    name: str
    full_name: Optional[str] = None
    specialty: str
    department: str
    office_location: str
    phone: Optional[str] = None
    is_accepting_patients: bool = True
    bio: Optional[str] = None
    working_days: List[str] = []
    earliest_available_date: Optional[str] = None

    def model_post_init(self, __context) -> None:
        if not self.full_name and self.name:
            self.full_name = self.name
        elif not self.name and self.full_name:
            self.name = self.full_name


# -----------------------------------------------------------------------------
# Demonstration & Clinical Shift Configuration Schemas
# -----------------------------------------------------------------------------

class DoctorScheduleBase(BaseModel):
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    slot_duration_minutes: int = 30
    is_telehealth_capable: bool = True
    is_in_person_capable: bool = True
    clinic_timezone: str = "America/New_York"
    is_active: bool = True


class DoctorScheduleCreate(DoctorScheduleBase):
    doctor_id: uuid.UUID


class DoctorScheduleRead(DoctorScheduleBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    doctor_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class DoctorTimeOffBase(BaseModel):
    start_date: date
    end_date: date
    reason: str = "Approved Leave / Clinic Holiday"


class DoctorTimeOffCreate(DoctorTimeOffBase):
    doctor_id: uuid.UUID


class DoctorTimeOffRead(DoctorTimeOffBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    doctor_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


