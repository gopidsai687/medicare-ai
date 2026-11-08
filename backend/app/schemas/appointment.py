from __future__ import annotations
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
    department_name: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    patient_phone: Optional[str] = None
    patient_email: Optional[str] = None
    patient_address: Optional[str] = None
    patient_dob: Optional[str] = None
    existing_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    referral_source: Optional[str] = "self_referral"
    referring_doctor_name: Optional[str] = None
    referring_doctor_phone: Optional[str] = None
    referring_doctor_email: Optional[str] = None


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
    patient_phone: Optional[str] = None
    patient_email: Optional[str] = None
    patient_address: Optional[str] = None
    patient_dob: Optional[str] = None
    existing_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    referral_source: Optional[str] = None
    referring_doctor_name: Optional[str] = None
    referring_doctor_phone: Optional[str] = None
    referring_doctor_email: Optional[str] = None


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

    # Extended Department & Financial Details
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    consultation_fee: Optional[float] = None

    # Extended Patient Contact & Clinical History
    patient_phone: Optional[str] = None
    patient_email: Optional[str] = None
    patient_address: Optional[str] = None
    patient_dob: Optional[str] = None
    existing_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None

    # Referral Tracking
    referral_source: Optional[str] = None
    referring_doctor_name: Optional[str] = None
    referring_doctor_phone: Optional[str] = None
    referring_doctor_email: Optional[str] = None

    # Enriched Fields for Direct Frontend Presentation
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    doctor_department: Optional[str] = None
    doctor_location: Optional[str] = None
    doctor_phone: Optional[str] = None
    doctor_qualifications: Optional[str] = None
    doctor_avatar_url: Optional[str] = None
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    is_upcoming: bool = False
    is_external: bool = False
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
    id: Optional[str] = None
    name: str
    code: str
    doctor_count: int
    department: str
    description: str
    icon: Optional[str] = "Stethoscope"
    location: Optional[str] = "Main Hospital Pavilion"
    phone: Optional[str] = "(555) 019-2800"
    email: Optional[str] = None
    head_of_department: Optional[str] = None
    is_active: bool = True


class DoctorReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    doctor_id: uuid.UUID
    patient_id: uuid.UUID
    appointment_id: Optional[uuid.UUID] = None
    rating: int
    review_text: str
    patient_display_name: str
    is_verified_appointment: bool = True
    is_approved: bool = True
    created_at: datetime
    updated_at: datetime


class DoctorReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    review_text: str = Field(..., min_length=5, max_length=1500)
    appointment_id: Optional[uuid.UUID] = None


class DoctorReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    review_text: Optional[str] = Field(None, min_length=5, max_length=1500)


class DoctorReviewsResponse(BaseModel):
    doctor_id: str
    average_rating: float
    total_reviews: int
    rating_distribution: dict[str, int]
    reviews: List[DoctorReviewRead]


class DoctorProfileRead(BaseModel):
    id: uuid.UUID
    name: str
    full_name: Optional[str] = None
    specialty: str
    department: str
    department_id: Optional[str] = None
    office_location: str
    phone: Optional[str] = None
    email: Optional[str] = None
    is_accepting_patients: bool = True
    bio: Optional[str] = None
    qualifications: Optional[str] = "MBBS, MD"
    experience_years: Optional[int] = 10
    consultation_fee: Optional[float] = 120.0
    languages: Optional[str] = "English"
    hospital_affiliation: Optional[str] = "MediCare Central Medical Center"
    avatar_url: Optional[str] = None
    rating: Optional[float] = 4.9
    review_count: Optional[int] = 24
    working_days: List[str] = []
    earliest_available_date: Optional[str] = None
    is_verified: bool = True
    license_number: Optional[str] = None

    def model_post_init(self, __context) -> None:
        if not self.full_name and self.name:
            self.full_name = self.name
        elif not self.name and self.full_name:
            self.name = self.full_name


class HospitalContactInfo(BaseModel):
    hospital_name: str = "MediCare Central Hospital & Academic Medical Center"
    main_phone: str = "(555) 019-2000"
    general_email: str = "contact@medicare.ai"
    emergency_hotline: str = "911 / (555) 019-9911"
    address: str = "500 Healthcare Blvd, North Pavilion, Suite 100, New York, NY 10001"
    working_hours: str = "Emergency Dept: 24/7/365 | Outpatient Clinics: Mon-Fri 8:00 AM - 6:00 PM, Sat 9:00 AM - 1:00 PM"
    website: str = "https://medicare.ai"
    emergency_triage_guidance: str = (
        "If you are experiencing acute chest pain, sudden numbness or speech difficulty, "
        "severe shortness of breath, or uncontrollable bleeding, please call 911 immediately "
        "or proceed to our ground-floor Emergency & Level 1 Trauma Center."
    )


class AppointmentTrackResponse(BaseModel):
    appointment: Optional[AppointmentRead] = None
    external_appointment: Optional[ExternalAppointmentRead] = None
    is_external: bool = False
    found: bool
    message: str


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


# -----------------------------------------------------------------------------
# Advanced Appointment Management & Dynamic Directory Schemas
# -----------------------------------------------------------------------------

class SpecialtyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    code: str = Field(..., min_length=2, max_length=20)
    description: str = Field(..., min_length=5, max_length=1000)
    icon: Optional[str] = "Stethoscope"
    location: Optional[str] = "Main Hospital Pavilion"
    phone: Optional[str] = "(555) 019-2800"
    email: Optional[str] = None
    head_of_department: Optional[str] = None
    is_active: bool = True


class SpecialtyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    head_of_department: Optional[str] = None
    is_active: Optional[bool] = None


class DoctorCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: str = Field(..., min_length=5, max_length=255)
    specialty: str = Field(..., min_length=2, max_length=150)
    sub_specialty: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[str] = None
    license_number: str = Field(..., min_length=4, max_length=50)
    npi_number: Optional[str] = None
    phone: Optional[str] = None
    office_location: Optional[str] = "North Wing, Suite 300"
    bio: Optional[str] = None
    qualifications: Optional[str] = "MD, Board Certified"
    experience_years: Optional[int] = 10
    consultation_fee: Optional[float] = 150.0
    languages: Optional[str] = "English"
    hospital_affiliation: Optional[str] = "MediCare Central Hospital"
    avatar_url: Optional[str] = None
    is_accepting_patients: bool = True
    is_verified: bool = True


class DoctorUpdate(BaseModel):
    full_name: Optional[str] = None
    specialty: Optional[str] = None
    sub_specialty: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    office_location: Optional[str] = None
    bio: Optional[str] = None
    qualifications: Optional[str] = None
    experience_years: Optional[int] = None
    consultation_fee: Optional[float] = None
    languages: Optional[str] = None
    hospital_affiliation: Optional[str] = None
    avatar_url: Optional[str] = None
    is_accepting_patients: Optional[bool] = None
    is_verified: Optional[bool] = None


class HospitalContactCreate(BaseModel):
    contact_type: str = "Emergency Department"
    label: str = "24/7 Trauma Hotline"
    phone: str
    email: Optional[str] = None
    available_hours: str = "24/7"
    is_emergency: bool = True
    is_verified: bool = True


class HospitalContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    hospital_id: uuid.UUID
    contact_type: str
    label: str
    phone: str
    email: Optional[str] = None
    available_hours: str
    is_emergency: bool
    is_verified: bool


class HospitalCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    hospital_type: str = "Academic Medical Center"
    address: str = Field(..., min_length=5, max_length=255)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=50)
    zip_code: str = Field(..., min_length=3, max_length=20)
    phone: str = Field(..., min_length=5, max_length=50)
    emergency_phone: str = Field(..., min_length=3, max_length=50)
    departments_available: Optional[str] = None
    operating_hours: str = "Emergency: 24/7/365 | Outpatient: Mon-Fri 8am-6pm"
    website: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contacts: List[HospitalContactCreate] = []


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    hospital_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    emergency_phone: Optional[str] = None
    departments_available: Optional[str] = None
    operating_hours: Optional[str] = None
    website: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None


class HospitalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    hospital_type: str
    address: str
    city: str
    state: str
    zip_code: str
    phone: str
    emergency_phone: str
    departments_available: Optional[str] = None
    operating_hours: str
    website: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_verified: bool
    is_active: bool
    contacts: List[HospitalContactRead] = []
    created_at: datetime
    updated_at: datetime


class ExternalAppointmentCreate(BaseModel):
    doctor_name: str = Field(..., min_length=2, max_length=200)
    hospital_name: str = Field(..., min_length=2, max_length=255)
    appointment_reference: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int = 30
    reason: str = Field(..., min_length=3, max_length=500)
    department: str = "General Medicine"
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    status: str = "scheduled"
    notes: Optional[str] = None


class ExternalAppointmentUpdate(BaseModel):
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    appointment_reference: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    reason: Optional[str] = None
    department: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ExternalAppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_name: str
    hospital_name: str
    appointment_reference: str
    scheduled_at: datetime
    duration_minutes: int
    reason: str
    department: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    status: str
    verification_status: str
    is_external: bool = True
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AppointmentDashboardStats(BaseModel):
    total_specialties: int
    total_departments: int = 0
    total_doctors: int
    total_hospitals: int
    upcoming_appointments: int
    pending_appointments: int
    confirmed_appointments: int
    total_patient_appointments: int = 0
    total_hospital_bookings: int = 0



