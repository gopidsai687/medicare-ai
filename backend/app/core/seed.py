"""
Auto-seeder for MediCare AI.
Guarantees standard clinical demo credentials exist for production evaluation.
"""
from datetime import date, datetime, time, timedelta, timezone
import uuid
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.doctor_schedule import DoctorSchedule, DoctorTimeOff, DayOfWeek
from app.models.patient import Patient, BloodType, Gender
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.prescription import Prescription, PrescriptionStatus
from app.models.medical_record import MedicalRecord, RecordCategory, RecordStatus
from app.models.vital_sign import VitalSign, VitalReminder, VitalSharingConsent
from app.models.medical_device import MedicalDevice, DeviceProtocol, DeviceStatus

log = structlog.get_logger(__name__)


async def seed_initial_data(session: AsyncSession) -> None:
    """Ensure baseline demo accounts exist for production evaluation."""
    try:
        from app.core.database import engine
        from app.core.migrations import run_schema_migrations
        await run_schema_migrations(engine)
    except Exception as _mig_err:
        log.debug("Auto-migration during seed pass-through", error=str(_mig_err))

    try:
        # 1. Admin
        res_admin = await session.execute(select(User).where(User.email == "admin@medicare.ai"))
        admin_user = res_admin.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                email="admin@medicare.ai",
                hashed_password=hash_password("AdminPass123!"),
                full_name="Dr. Arthur Vance (Chief Admin)",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            session.add(admin_user)
            await session.flush()
            log.info("Seeded admin account: admin@medicare.ai")
        else:
            # Ensure active & verified
            admin_user.is_active = True
            admin_user.is_verified = True

        # 2. Doctor Sarah Chen
        res_doc = await session.execute(select(User).where(User.email == "sarah.chen@medicare.ai"))
        doc_user = res_doc.scalar_one_or_none()
        if not doc_user:
            doc_user = User(
                id=uuid.uuid4(),
                email="sarah.chen@medicare.ai",
                hashed_password=hash_password("DoctorPass123!"),
                full_name="Dr. Sarah Chen, MD",
                role=UserRole.DOCTOR,
                is_active=True,
                is_verified=True,
            )
            session.add(doc_user)
            await session.flush()
            log.info("Seeded doctor user: sarah.chen@medicare.ai")
        else:
            doc_user.is_active = True
            doc_user.is_verified = True

        res_doc_profile = await session.execute(select(Doctor).where(Doctor.user_id == doc_user.id))
        doc_profile = res_doc_profile.scalar_one_or_none()
        if not doc_profile:
            doc_profile = Doctor(
                id=uuid.uuid4(),
                user_id=doc_user.id,
                license_number="MD-2024-99881",
                specialty="Internal Medicine",
                department="General Medicine",
                office_location="Building A, Room 302",
                is_accepting_patients=True,
                bio="Board-certified internal medicine physician specializing in preventive health.",
            )
            session.add(doc_profile)
            await session.flush()
            log.info("Seeded doctor profile for Dr. Sarah Chen")

        # 3. Patient Alice Johnson
        res_pat = await session.execute(select(User).where(User.email == "alice.johnson@medicare.ai"))
        pat_user = res_pat.scalar_one_or_none()
        if not pat_user:
            pat_user = User(
                id=uuid.uuid4(),
                email="alice.johnson@medicare.ai",
                hashed_password=hash_password("PatientPass123!"),
                full_name="Alice Johnson",
                role=UserRole.PATIENT,
                is_active=True,
                is_verified=True,
            )
            session.add(pat_user)
            await session.flush()
            log.info("Seeded patient user: alice.johnson@medicare.ai")
        else:
            pat_user.is_active = True
            pat_user.is_verified = True

        res_pat_profile = await session.execute(select(Patient).where(Patient.user_id == pat_user.id))
        pat_profile = res_pat_profile.scalar_one_or_none()
        if not pat_profile:
            pat_profile = Patient(
                id=uuid.uuid4(),
                user_id=pat_user.id,
                mrn="MRN-10001",
                date_of_birth=date(1988, 4, 12),
                gender=Gender.FEMALE,
                blood_type=BloodType.O_POS,
                phone="(555) 234-5678",
                address_line1="742 Evergreen Terrace",
                city="Springfield",
                state="OR",
                zip_code="97477",
                country="US",
                emergency_contact_name="Bob Johnson",
                emergency_contact_phone="(555) 876-5432",
                emergency_contact_relation="Spouse",
                notes="Allergies: Penicillin. Chronic conditions: Mild Asthma.",
            )
            session.add(pat_profile)
            await session.flush()
            log.info("Seeded patient profile for Alice Johnson")

        # 3b. Patient Bob Smith (for cross-patient isolation and testing)
        res_bob = await session.execute(select(User).where(User.email == "bob.smith@medicare.ai"))
        bob_user = res_bob.scalar_one_or_none()
        if not bob_user:
            bob_user = User(
                id=uuid.uuid4(),
                email="bob.smith@medicare.ai",
                hashed_password=hash_password("PatientPass123!"),
                full_name="Bob Smith",
                role=UserRole.PATIENT,
                is_active=True,
                is_verified=True,
            )
            session.add(bob_user)
            await session.flush()
            log.info("Seeded patient user: bob.smith@medicare.ai")
        else:
            bob_user.is_active = True
            bob_user.is_verified = True

        res_bob_profile = await session.execute(select(Patient).where(Patient.user_id == bob_user.id))
        bob_profile = res_bob_profile.scalar_one_or_none()
        if not bob_profile:
            bob_profile = Patient(
                id=uuid.uuid4(),
                user_id=bob_user.id,
                mrn="MRN-10002",
                date_of_birth=date(1985, 9, 23),
                gender=Gender.MALE,
                blood_type=BloodType.A_POS,
                phone="(555) 345-6789",
                address_line1="123 Oak Avenue",
                city="Springfield",
                state="OR",
                zip_code="97477",
                country="US",
                emergency_contact_name="Alice Smith",
                emergency_contact_phone="(555) 987-6543",
                emergency_contact_relation="Spouse",
                notes="Hypertension stage 1 under observation.",
            )
            session.add(bob_profile)
            await session.flush()
            log.info("Seeded patient profile for Bob Smith")

        # 4. Clinical Relationship Data: Appointment between Alice and Dr. Sarah Chen
        if pat_profile and doc_profile:
            res_appt = await session.execute(
                select(Appointment).where(Appointment.patient_id == pat_profile.id)
            )
            if not res_appt.scalars().first():
                appt = Appointment(
                    id=uuid.uuid4(),
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    scheduled_at=datetime(2026, 10, 20, 10, 0, tzinfo=timezone.utc),
                    duration_minutes=30,
                    status=AppointmentStatus.SCHEDULED,
                    appointment_type=AppointmentType.IN_PERSON,
                    reason="Comprehensive Wellness Examination & Diagnostic Review",
                    room="Examination Suite 3B",
                )
                session.add(appt)
                await session.flush()
                log.info("Seeded appointment for Alice Johnson with Dr. Sarah Chen")

            # 5. Prescriptions for Alice Johnson
            res_rx = await session.execute(
                select(Prescription).where(Prescription.patient_id == pat_profile.id)
            )
            if not res_rx.scalars().first():
                rx1 = Prescription(
                    id=uuid.uuid4(),
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    medication_name="Lisinopril",
                    dosage="10mg",
                    frequency="Once daily in the morning",
                    route="Oral",
                    start_date=date(2026, 1, 15),
                    refills_remaining=3,
                    instructions="Take with or without food. Monitor blood pressure weekly.",
                    status=PrescriptionStatus.ACTIVE,
                )
                rx2 = Prescription(
                    id=uuid.uuid4(),
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    medication_name="Metformin",
                    dosage="500mg",
                    frequency="Twice daily with meals",
                    route="Oral",
                    start_date=date(2026, 2, 1),
                    refills_remaining=2,
                    instructions="Take with meals to minimize GI discomfort.",
                    status=PrescriptionStatus.ACTIVE,
                )
                session.add_all([rx1, rx2])
                await session.flush()
                log.info("Seeded active clinical prescriptions for Alice Johnson")

            # 6. Medical Records for Alice Johnson
            res_med = await session.execute(
                select(MedicalRecord).where(MedicalRecord.patient_id == pat_profile.id)
            )
            if not res_med.scalars().first():
                rec1 = MedicalRecord(
                    id=uuid.uuid4(),
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    category=RecordCategory.DIAGNOSIS,
                    title="Essential Hypertension (Mild)",
                    description="Well controlled on Lisinopril 10mg daily. Patient reports adherence without adverse symptoms.",
                    icd10_code="I10",
                    record_date=date(2026, 1, 15),
                    status=RecordStatus.ACTIVE,
                )
                rec2 = MedicalRecord(
                    id=uuid.uuid4(),
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    category=RecordCategory.ALLERGY,
                    title="Penicillin",
                    description="Severe urticaria and angioedema reported upon pediatric exposure.",
                    record_date=date(2020, 5, 10),
                    status=RecordStatus.ACTIVE,
                )
                session.add_all([rec1, rec2])
                await session.flush()
                log.info("Seeded baseline medical records for Alice Johnson")

            # 7. VitalSense Telemetry for Alice Johnson
            res_vitals = await session.execute(
                select(VitalSign).where(VitalSign.patient_id == pat_profile.id)
            )
            if not res_vitals.scalars().first():
                now = datetime.now(timezone.utc)
                sample_readings = [
                    # Day -28
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=28, hours=2),
                        systolic_bp=128,
                        diastolic_bp=82,
                        heart_rate=72,
                        weight=64.5,
                        measurement_source="manual_entry",
                        notes="Morning reading before breakfast",
                        is_patient_entered=True,
                        is_sample=False,
                    ),
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=28, hours=1),
                        blood_glucose=95.0,
                        blood_glucose_mmol=5.27,
                        glucose_unit="mg/dL",
                        glucose_context="fasting",
                        measurement_source="manual_entry",
                        is_patient_entered=True,
                        is_sample=False,
                    ),
                    # Day -21
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=21, hours=3),
                        systolic_bp=122,
                        diastolic_bp=78,
                        heart_rate=70,
                        measurement_source="omron_connect",
                        device_name="Omron Evolv BP7000",
                        notes="Bluetooth sync from Omron cuff",
                        is_patient_entered=False,
                        is_sample=False,
                    ),
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=21),
                        blood_glucose=138.0,
                        blood_glucose_mmol=7.66,
                        glucose_unit="mg/dL",
                        glucose_context="after_meal",
                        measurement_source="dexcom_cgm",
                        device_name="Dexcom G7 Continuous Glucose Monitor",
                        is_patient_entered=False,
                        is_sample=False,
                    ),
                    # Day -14
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=14, hours=4),
                        systolic_bp=134,
                        diastolic_bp=86,
                        heart_rate=78,
                        weight=64.2,
                        measurement_source="manual_entry",
                        notes="Felt slightly stressed after work",
                        is_patient_entered=True,
                        is_sample=False,
                    ),
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=14, hours=2),
                        blood_glucose=92.0,
                        blood_glucose_mmol=5.11,
                        glucose_unit="mg/dL",
                        glucose_context="fasting",
                        measurement_source="dexcom_cgm",
                        device_name="Dexcom G7 Continuous Glucose Monitor",
                        is_patient_entered=False,
                        is_sample=False,
                    ),
                    # Day -7
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=7, hours=2),
                        systolic_bp=118,
                        diastolic_bp=76,
                        heart_rate=68,
                        weight=64.0,
                        measurement_source="omron_connect",
                        device_name="Omron Evolv BP7000",
                        notes="Post-exercise rest period",
                        is_patient_entered=False,
                        is_sample=False,
                    ),
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=7),
                        blood_glucose=125.0,
                        blood_glucose_mmol=6.94,
                        glucose_unit="mg/dL",
                        glucose_context="after_meal",
                        measurement_source="manual_entry",
                        is_patient_entered=True,
                        is_sample=False,
                    ),
                    # Day -2
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=2, hours=3),
                        systolic_bp=120,
                        diastolic_bp=78,
                        heart_rate=71,
                        weight=63.8,
                        measurement_source="manual_entry",
                        notes="Routine morning vitals",
                        is_patient_entered=True,
                        is_sample=False,
                    ),
                    VitalSign(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        recorded_by_id=pat_user.id,
                        recorded_at=now - timedelta(days=2, hours=1),
                        blood_glucose=89.0,
                        blood_glucose_mmol=4.94,
                        glucose_unit="mg/dL",
                        glucose_context="fasting",
                        measurement_source="dexcom_cgm",
                        device_name="Dexcom G7 Continuous Glucose Monitor",
                        is_patient_entered=False,
                        is_sample=False,
                    ),
                ]
                session.add_all(sample_readings)
                await session.flush()
                log.info("Seeded 10 VitalSense telemetry records for Alice Johnson")

            # 8. VitalSense Reminders
            res_rem = await session.execute(
                select(VitalReminder).where(VitalReminder.patient_id == pat_profile.id)
            )
            if not res_rem.scalars().first():
                rem1 = VitalReminder(
                    id=uuid.uuid4(),
                    patient_id=pat_profile.id,
                    reminder_type="bp",
                    label="Morning Blood Pressure Check",
                    time_of_day="08:00 AM",
                    frequency="daily",
                    days_of_week="Mon,Tue,Wed,Thu,Fri,Sat,Sun",
                    is_active=True,
                )
                rem2 = VitalReminder(
                    id=uuid.uuid4(),
                    patient_id=pat_profile.id,
                    reminder_type="glucose",
                    label="Fasting Glucose Log",
                    time_of_day="07:30 AM",
                    frequency="weekdays",
                    days_of_week="Mon,Tue,Wed,Thu,Fri",
                    is_active=True,
                )
                session.add_all([rem1, rem2])
                await session.flush()
                log.info("Seeded vital reminders for Alice Johnson")

            # 9. Active Sharing Consent with Dr. Sarah Chen
            res_consent = await session.execute(
                select(VitalSharingConsent).where(
                    VitalSharingConsent.patient_id == pat_profile.id,
                    VitalSharingConsent.doctor_id == doc_profile.id,
                )
            )
            if not res_consent.scalar_one_or_none():
                consent = VitalSharingConsent(
                    id=uuid.uuid4(),
                    patient_id=pat_profile.id,
                    doctor_id=doc_profile.id,
                    is_active=True,
                    notes="Patient consented to share continuous home telemetry for preventive hypertension care.",
                )
                session.add(consent)
                await session.flush()
                log.info("Seeded active VitalSense sharing consent for Dr. Sarah Chen")

            # 10. Medical Device: BioSens FS-100 Optical Station for Alice Johnson
            try:
                res_dev = await session.execute(
                    select(MedicalDevice).where(MedicalDevice.patient_id == pat_profile.id)
                )
                if not res_dev.scalar_one_or_none():
                    biosens_dev = MedicalDevice(
                        id=uuid.uuid4(),
                        patient_id=pat_profile.id,
                        device_name="MediCare BioSens FS-100 Optical Station",
                        device_type="fingertip_optical_station",
                        manufacturer="MediCare BioSens Lab",
                        model_number="MC-BIO-FS100",
                        serial_number="SN-FS100-2026-9812",
                        hardware_revision="Rev 2.1",
                        firmware_version="v1.4.2",
                        protocol=DeviceProtocol.WEBSERIAL.value,
                        status=DeviceStatus.CONNECTED.value,
                        battery_percentage=94,
                        supports_heart_rate=True,
                        supports_spo2=True,
                        supports_perfusion_index=True,
                        supports_dermal_temperature=True,
                        supports_contact_force=True,
                        supports_blood_pressure=False,  # Uncalibrated until cuff initialization
                        is_bp_calibrated=False,
                        supports_blood_glucose=False,   # Scientifically not feasible via non-invasive optical
                        is_demo_device=False,
                        notes="Primary clinical study device. Multi-spectral optical photoplethysmography array with contact force gating.",
                        last_heartbeat_at=datetime.now(timezone.utc),
                    )
                    session.add(biosens_dev)
                    await session.flush()
                    log.info("Seeded BioSens FS-100 optical station for Alice Johnson")
            except Exception as dev_err:
                log.warning("Skipping device seeding (table may not be created yet)", error=str(dev_err))

        # 9. Seed Full Demonstration Doctors and Working Shift Schedules
        try:
            CLINIC_DOCTORS = [
                {
                    "email": "sarah.chen@medicare.ai",
                    "name": "Dr. Sarah Chen, MD, FACC",
                    "specialty": "Cardiology",
                    "department": "Cardiovascular Medicine",
                    "license": "MD-2024-99881",
                    "location": "North Tower Suite 401",
                    "phone": "(555) 234-1101",
                    "bio": "Board-certified cardiologist specializing in preventive cardiology, hypertension titration, and echocardiography.",
                    "shifts": [
                        (DayOfWeek.MONDAY, time(9, 0), time(17, 0), 30),
                        (DayOfWeek.TUESDAY, time(9, 0), time(17, 0), 30),
                        (DayOfWeek.WEDNESDAY, time(9, 0), time(17, 0), 30),
                        (DayOfWeek.THURSDAY, time(9, 0), time(17, 0), 30),
                        (DayOfWeek.FRIDAY, time(9, 0), time(13, 0), 30),
                    ]
                },
                {
                    "email": "james.kim@medicare.ai",
                    "name": "Dr. James Kim, MD",
                    "specialty": "Endocrinology",
                    "department": "Endocrinology & Metabolism",
                    "license": "MD-2024-99882",
                    "location": "West Wing Suite 310",
                    "phone": "(555) 234-1102",
                    "bio": "Endocrinologist focusing on Type 1 and Type 2 diabetes management, CGM telemetry, and thyroid disease.",
                    "shifts": [
                        (DayOfWeek.MONDAY, time(8, 30), time(16, 30), 30),
                        (DayOfWeek.TUESDAY, time(8, 30), time(16, 30), 30),
                        (DayOfWeek.WEDNESDAY, time(8, 30), time(16, 30), 30),
                        (DayOfWeek.THURSDAY, time(8, 30), time(16, 30), 30),
                        (DayOfWeek.FRIDAY, time(8, 30), time(16, 30), 30),
                    ]
                },
                {
                    "email": "maria.lopez@medicare.ai",
                    "name": "Dr. Maria Lopez, MD",
                    "specialty": "General Practice",
                    "department": "General Internal Medicine",
                    "license": "MD-2024-99883",
                    "location": "East Pavilion Clinic 2A",
                    "phone": "(555) 234-1103",
                    "bio": "Primary care physician dedicated to routine physicals, wellness screening, and multi-morbid care coordination. (Demonstration Clinic Provider)",
                    "shifts": [
                        (DayOfWeek.MONDAY, time(8, 0), time(17, 0), 30),
                        (DayOfWeek.TUESDAY, time(8, 0), time(17, 0), 30),
                        (DayOfWeek.WEDNESDAY, time(8, 0), time(17, 0), 30),
                        (DayOfWeek.THURSDAY, time(8, 0), time(17, 0), 30),
                        (DayOfWeek.FRIDAY, time(8, 0), time(17, 0), 30),
                        (DayOfWeek.SATURDAY, time(9, 0), time(13, 0), 30),  # Demonstration Outpatient Saturday Clinic
                    ]
                },
                {
                    "email": "alex.taylor@medicare.ai",
                    "name": "Dr. Alex Taylor, MD, FCCP",
                    "specialty": "Pulmonology",
                    "department": "Pulmonology & Critical Care",
                    "license": "MD-2024-99884",
                    "location": "North Tower Suite 505",
                    "phone": "(555) 234-1104",
                    "bio": "Pulmonologist specializing in asthma, COPD, pulmonary fibrosis, and respiratory care. (Demonstration Clinic Provider)",
                    "shifts": [
                        (DayOfWeek.TUESDAY, time(9, 0), time(16, 0), 45),
                        (DayOfWeek.WEDNESDAY, time(9, 0), time(16, 0), 45),
                        (DayOfWeek.THURSDAY, time(9, 0), time(16, 0), 45),
                        (DayOfWeek.FRIDAY, time(9, 0), time(16, 0), 45),
                        (DayOfWeek.SATURDAY, time(9, 0), time(13, 0), 45), # Demonstration Saturday Respiratory Clinic
                    ]
                },
                {
                    "email": "elena.rostova@medicare.ai",
                    "name": "Dr. Elena Rostova, MD, PhD",
                    "specialty": "Neurology",
                    "department": "Neurology & Stroke",
                    "license": "MD-2024-99885",
                    "location": "West Wing Suite 412",
                    "phone": "(555) 234-1105",
                    "bio": "Neurologist and stroke specialist focusing on migraine management, peripheral neuropathies, and cognitive health. (Demonstration Clinic Provider)",
                    "shifts": [
                        (DayOfWeek.MONDAY, time(10, 0), time(17, 0), 45),
                        (DayOfWeek.WEDNESDAY, time(10, 0), time(17, 0), 45),
                        (DayOfWeek.FRIDAY, time(10, 0), time(17, 0), 45),
                    ]
                },
            ]

            for d_info in CLINIC_DOCTORS:
                # 1. Ensure user exists
                u_stmt = select(User).where(User.email == d_info["email"])
                u_res = await session.execute(u_stmt)
                u_obj = u_res.scalar_one_or_none()
                if not u_obj:
                    u_obj = User(
                        id=uuid.uuid4(),
                        email=d_info["email"],
                        hashed_password=hash_password("DoctorPass123!"),
                        full_name=d_info["name"],
                        role=UserRole.DOCTOR,
                        is_active=True,
                        is_verified=True,
                    )
                    session.add(u_obj)
                    await session.flush()
                else:
                    u_obj.full_name = d_info["name"]

                # 2. Ensure doctor profile exists
                d_stmt = select(Doctor).where(Doctor.user_id == u_obj.id)
                d_res = await session.execute(d_stmt)
                d_obj = d_res.scalar_one_or_none()
                if not d_obj:
                    d_obj = Doctor(
                        id=uuid.uuid4(),
                        user_id=u_obj.id,
                        license_number=d_info["license"],
                        specialty=d_info["specialty"],
                        department=d_info["department"],
                        office_location=d_info["location"],
                        phone=d_info["phone"],
                        is_accepting_patients=True,
                        bio=d_info["bio"],
                    )
                    session.add(d_obj)
                    await session.flush()
                else:
                    d_obj.specialty = d_info["specialty"]
                    d_obj.department = d_info["department"]
                    d_obj.office_location = d_info["location"]
                    d_obj.phone = d_info["phone"]
                    d_obj.is_accepting_patients = True
                    d_obj.bio = d_info["bio"]

                # 3. Ensure Doctor Schedule shifts exist
                for dow, start_tm, end_tm, duration in d_info["shifts"]:
                    s_stmt = select(DoctorSchedule).where(
                        DoctorSchedule.doctor_id == d_obj.id,
                        DoctorSchedule.day_of_week == dow,
                    )
                    s_res = await session.execute(s_stmt)
                    s_obj = s_res.scalar_one_or_none()
                    if not s_obj:
                        s_obj = DoctorSchedule(
                            id=uuid.uuid4(),
                            doctor_id=d_obj.id,
                            day_of_week=dow,
                            start_time=start_tm,
                            end_time=end_tm,
                            slot_duration_minutes=duration,
                            is_telehealth_capable=True,
                            is_in_person_capable=True,
                            clinic_timezone="America/New_York",
                            is_active=True,
                        )
                        session.add(s_obj)
                    else:
                        s_obj.is_active = True
                        s_obj.start_time = start_tm
                        s_obj.end_time = end_tm
                        s_obj.slot_duration_minutes = duration
                        s_obj.clinic_timezone = "America/New_York"

            await session.flush()
            log.info("Demonstration doctors and recurring weekly schedules successfully verified/seeded.")
        except Exception as sched_err:
            log.warning("Skipping schedule seeding (table might not exist yet)", error=str(sched_err))

        await session.commit()
        log.info("Baseline clinical accounts verification/seeding completed successfully.")
    except Exception as exc:
        await session.rollback()
        log.error("Failed to seed initial clinical data", error=str(exc))
        raise exc
