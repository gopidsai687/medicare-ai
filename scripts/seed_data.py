"""
MediCare AI — Comprehensive Database Seeding Script.
Populates PostgreSQL with enterprise demo accounts, patients, MPI clusters, doctors,
SOAP clinical encounters, vitals, prescriptions, medical records, and RAG vector embeddings.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

# Ensure backend app is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import select, text
from app.core.database import AsyncSessionFactory, engine
from app.core.security import get_password_hash
from app.models.base import Base
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.patient import Patient, BloodType, Gender
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.encounter import Encounter, EncounterType, EncounterStatus
from app.models.vital_sign import VitalSign
from app.models.prescription import Prescription, PrescriptionStatus
from app.models.medical_record import MedicalRecord, RecordCategory, RecordStatus
from app.models.audit_log import AuditLog, AuditAction, AuditSeverity
from app.services.ai_service import ai_service


async def seed_database() -> None:
    print("🏥 Starting MediCare AI Database Seeding...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("📋 Schema verified/created.")

    async with AsyncSessionFactory() as session:
        # Check if already seeded
        res = await session.execute(select(User).where(User.email == "admin@medicare.ai"))
        if res.scalar_one_or_none():
            print("ℹ️ Admin account already exists. Skipping duplicate seeding.")
            return

        print("🔑 Creating System Administrator...")
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@medicare.ai",
            hashed_password=get_password_hash("AdminPass123!"),
            full_name="Dr. Arthur Vance (Chief Medical Officer)",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(admin_user)

        # ── 1. Doctors ────────────────────────────────────────────────────────
        print("🩺 Creating Attending Clinical Specialists...")
        doctor_data = [
            {
                "email": "sarah.chen@medicare.ai",
                "name": "Dr. Sarah Chen, MD, FACC",
                "role": UserRole.DOCTOR,
                "specialty": "Cardiovascular Medicine",
                "license": "MED-CA-94821",
                "dept": "Cardiology",
                "location": "North Tower — Floor 4",
                "npi": "1948201948",
            },
            {
                "email": "james.kim@medicare.ai",
                "name": "Dr. James Kim, MD",
                "role": UserRole.DOCTOR,
                "specialty": "Endocrinology & Metabolism",
                "license": "MED-CA-88219",
                "dept": "Endocrinology",
                "location": "West Wing — Floor 3",
                "npi": "1882193821",
            },
            {
                "email": "maria.lopez@medicare.ai",
                "name": "Dr. Maria Lopez, MD",
                "role": UserRole.DOCTOR,
                "specialty": "General Internal Medicine",
                "license": "MED-CA-74829",
                "dept": "General Practice",
                "location": "East Pavilion — Floor 2",
                "npi": "1748294729",
            },
            {
                "email": "alex.taylor@medicare.ai",
                "name": "Dr. Alex Taylor, MD, FCCP",
                "role": UserRole.DOCTOR,
                "specialty": "Pulmonology & Critical Care",
                "license": "MED-CA-63910",
                "dept": "Pulmonology",
                "location": "North Tower — Floor 5",
                "npi": "1639102941",
            },
            {
                "email": "elena.rostova@medicare.ai",
                "name": "Dr. Elena Rostova, MD, PhD",
                "role": UserRole.DOCTOR,
                "specialty": "Neurology & Stroke",
                "license": "MED-CA-55192",
                "dept": "Neurology",
                "location": "West Wing — Floor 4",
                "npi": "1551928492",
            },
        ]

        doctors_map: dict[str, Doctor] = {}
        for d_info in doctor_data:
            d_user = User(
                id=uuid.uuid4(),
                email=d_info["email"],
                hashed_password=get_password_hash("DoctorPass123!"),
                full_name=d_info["name"],
                role=d_info["role"],
                is_active=True,
                is_verified=True,
            )
            session.add(d_user)
            await session.flush()

            doctor_rec = Doctor(
                id=uuid.uuid4(),
                user_id=d_user.id,
                license_number=d_info["license"],
                specialty=d_info["specialty"],
                department=d_info["dept"],
                office_location=d_info["location"],
                npi_number=d_info["npi"],
                is_accepting_patients=True,
            )
            session.add(doctor_rec)
            doctors_map[d_info["dept"]] = doctor_rec

        # ── 2. Patients (Including MPI Duplicate Pair) ────────────────────────
        print("👥 Creating Verified Patient Demographics & MPI Clusters...")
        patient_records: list[dict] = [
            {
                "email": "alice.johnson@medicare.ai",
                "name": "Alice Johnson",
                "mrn": "MRN-00000012",
                "dob": date(1978, 3, 14),
                "gender": Gender.FEMALE,
                "blood": BloodType.A_POS,
                "phone": "(555) 234-5678",
                "address": "742 Evergreen Terrace",
                "city": "Springfield",
                "zip": "97477",
                "insurance": "BlueCross BlueShield Premier PPO",
            },
            {
                # Duplicate candidate for MPI
                "email": "alyce.johnson@medicare.ai",
                "name": "Alyce Johnson",
                "mrn": "MRN-00000099",
                "dob": date(1978, 3, 14),
                "gender": Gender.FEMALE,
                "blood": BloodType.A_POS,
                "phone": "(555) 234-5678",
                "address": "742 Evergreen Terr",
                "city": "Springfield",
                "zip": "97477",
                "insurance": "BlueCross BlueShield",
            },
            {
                "email": "robert.chen@medicare.ai",
                "name": "Robert Chen",
                "mrn": "MRN-00000034",
                "dob": date(1965, 7, 22),
                "gender": Gender.MALE,
                "blood": BloodType.B_POS,
                "phone": "(555) 876-5432",
                "address": "124 Conch Street",
                "city": "Pacifica",
                "zip": "94044",
                "insurance": "Kaiser Permanente Senior Advantage",
            },
            {
                "email": "david.kim@medicare.ai",
                "name": "David Kim",
                "mrn": "MRN-00000068",
                "dob": date(1955, 1, 30),
                "gender": Gender.MALE,
                "blood": BloodType.O_POS,
                "phone": "(555) 901-2345",
                "address": "890 Oakwood Drive",
                "city": "Riverside",
                "zip": "92501",
                "insurance": "Medicare Part A & B + Aetna Supplement",
            },
            {
                "email": "maria.santos@medicare.ai",
                "name": "Maria Santos",
                "mrn": "MRN-00000051",
                "dob": date(1990, 11, 5),
                "gender": Gender.FEMALE,
                "blood": BloodType.O_NEG,
                "phone": "(555) 345-6789",
                "address": "456 Elm Avenue",
                "city": "Metro City",
                "zip": "90210",
                "insurance": "UnitedHealthcare Choice Plus",
            },
            {
                "email": "emma.wilson@medicare.ai",
                "name": "Emma Wilson",
                "mrn": "MRN-00000082",
                "dob": date(2000, 8, 12),
                "gender": Gender.FEMALE,
                "blood": BloodType.AB_POS,
                "phone": "(555) 456-7890",
                "address": "321 Maple Boulevard",
                "city": "Westview",
                "zip": "94102",
                "insurance": "Cigna Open Access Plus",
            },
        ]

        patients_map: dict[str, Patient] = {}
        for p_info in patient_records:
            p_user = User(
                id=uuid.uuid4(),
                email=p_info["email"],
                hashed_password=get_password_hash("PatientPass123!"),
                full_name=p_info["name"],
                role=UserRole.PATIENT,
                is_active=True,
                is_verified=True,
            )
            session.add(p_user)
            await session.flush()

            patient_rec = Patient(
                id=uuid.uuid4(),
                user_id=p_user.id,
                mrn=p_info["mrn"],
                date_of_birth=p_info["dob"],
                gender=p_info["gender"],
                blood_type=p_info["blood"],
                phone=p_info["phone"],
                address_line1=p_info["address"],
                city=p_info["city"],
                zip_code=p_info["zip"],
                insurance_provider=p_info["insurance"],
                is_merged=False,
            )
            session.add(patient_rec)
            patients_map[p_info["mrn"]] = patient_rec

        await session.flush()

        # ── 3. Clinical Encounters & SOAP Notes ───────────────────────────────
        print("📝 Generating Clinical SOAP Encounters...")
        p_alice = patients_map["MRN-00000012"]
        p_david = patients_map["MRN-00000068"]
        doc_cardio = doctors_map["Cardiology"]

        enc1 = Encounter(
            id=uuid.uuid4(),
            patient_id=p_alice.id,
            doctor_id=doc_cardio.id,
            encounter_date=datetime.utcnow() - timedelta(days=7),
            encounter_type=EncounterType.OUTPATIENT,
            status=EncounterStatus.SIGNED,
            chief_complaint="Routine 3-month follow-up for Essential Hypertension and Type 2 Diabetes",
            subjective="Patient reports good adherence to Lisinopril 10mg and Metformin 500mg. Denies orthostatic dizziness, palpitations, or lower extremity edema.",
            objective="BP: 128/82 mmHg, HR: 72 bpm, SpO2: 99% on room air, BMI: 26.4 kg/m2. Heart: Regular rate and rhythm, no murmurs. Lungs: Clear to auscultation bilaterally.",
            assessment="1. Essential Hypertension (I10) — Well controlled on Lisinopril monotherapy.\n2. Type 2 Diabetes Mellitus (E11.9) — HbA1c 6.7%, stable glycemic control.",
            plan="1. Continue Lisinopril 10mg PO daily.\n2. Continue Metformin 500mg PO BID with meals.\n3. Recheck BMP and HbA1c in 3 months.\n4. Routine follow-up in 12 weeks.",
            signed_at=datetime.utcnow() - timedelta(days=7),
        )
        session.add(enc1)

        enc2 = Encounter(
            id=uuid.uuid4(),
            patient_id=p_david.id,
            doctor_id=doc_cardio.id,
            encounter_date=datetime.utcnow() - timedelta(hours=6),
            encounter_type=EncounterType.EMERGENCY,
            status=EncounterStatus.IN_PROGRESS,
            chief_complaint="Acute onset retrosternal chest tightness and shortness of breath at rest",
            subjective="71-year-old male with known HFrEF presenting with 2 hours of crushing retrosternal pressure. Associated with diaphoresis and acute dyspnea.",
            objective="BP: 146/94 mmHg, HR: 104 bpm, SpO2: 93% on room air. hs-cTnI: 0.142 ng/mL (abnormal), NT-proBNP: 4,280 pg/mL.",
            assessment="1. Acute Coronary Syndrome / NSTEMI rule-out in HFrEF patient.\n2. Decompensated Heart Failure with fluid retention.",
            plan="1. STAT Aspirin 325mg chewed, sublingual Nitroglycerin.\n2. Serial hs-Troponin at 0h, 1h, 3h.\n3. Urgent bedside echocardiogram and cardiology cath lab alert.",
        )
        session.add(enc2)

        # ── 4. Vital Signs Series ─────────────────────────────────────────────
        print("📊 Seeding Longitudinal Vital Signs Telemetry...")
        vitals = [
            VitalSign(
                id=uuid.uuid4(),
                patient_id=p_alice.id,
                recorded_at=datetime.utcnow() - timedelta(days=7),
                heart_rate=72,
                systolic_bp=128,
                diastolic_bp=82,
                temperature=36.8,
                oxygen_saturation=99.0,
                respiratory_rate=16,
                blood_glucose=118.0,
                weight=68.5,
                height=168.0,
            ),
            VitalSign(
                id=uuid.uuid4(),
                patient_id=p_david.id,
                recorded_at=datetime.utcnow() - timedelta(hours=6),
                heart_rate=104,
                systolic_bp=146,
                diastolic_bp=94,
                temperature=37.1,
                oxygen_saturation=93.0,
                respiratory_rate=22,
                blood_glucose=142.0,
                weight=84.0,
                height=175.0,
            ),
        ]
        session.add_all(vitals)

        # ── 5. Prescriptions ──────────────────────────────────────────────────
        print("💊 Seeding Active Medications & Pharmacological Records...")
        prescriptions = [
            Prescription(
                id=uuid.uuid4(),
                patient_id=p_alice.id,
                doctor_id=doc_cardio.id,
                medication_name="Lisinopril",
                dosage="10mg",
                frequency="Once daily in morning",
                route="oral",
                start_date=date.today() - timedelta(days=90),
                status=PrescriptionStatus.ACTIVE,
                refills_remaining=3,
                instructions="Take with water every morning. Monitor BP.",
            ),
            Prescription(
                id=uuid.uuid4(),
                patient_id=p_alice.id,
                doctor_id=doc_cardio.id,
                medication_name="Metformin",
                dosage="500mg",
                frequency="Twice daily with meals",
                route="oral",
                start_date=date.today() - timedelta(days=90),
                status=PrescriptionStatus.ACTIVE,
                refills_remaining=2,
                instructions="Take with breakfast and dinner.",
            ),
            Prescription(
                id=uuid.uuid4(),
                patient_id=p_david.id,
                doctor_id=doc_cardio.id,
                medication_name="Furosemide",
                dosage="40mg",
                frequency="Once daily in morning",
                route="oral",
                start_date=date.today() - timedelta(days=30),
                status=PrescriptionStatus.ACTIVE,
                refills_remaining=1,
                instructions="Take in morning to prevent nocturia.",
            ),
        ]
        session.add_all(prescriptions)

        # ── 6. Appointments ───────────────────────────────────────────────────
        print("📅 Scheduling Cross-Department Appointments...")
        appointments = [
            Appointment(
                id=uuid.uuid4(),
                patient_id=p_alice.id,
                doctor_id=doc_cardio.id,
                scheduled_at=datetime.now(timezone.utc) + timedelta(days=3, hours=2),
                duration_minutes=30,
                appointment_type=AppointmentType.IN_PERSON,
                status=AppointmentStatus.CONFIRMED,
                reason="Routine cardiovascular & hypertension follow-up",
            ),
            Appointment(
                id=uuid.uuid4(),
                patient_id=p_david.id,
                doctor_id=doc_cardio.id,
                scheduled_at=datetime.now(timezone.utc) + timedelta(hours=1),
                duration_minutes=30,
                appointment_type=AppointmentType.IN_PERSON,
                status=AppointmentStatus.CONFIRMED,
                reason="STAT Cardiology acute post-troponin evaluation",
            ),
        ]
        session.add_all(appointments)

        # ── 7. Medical Records with 768-dim Vector Embeddings ─────────────────
        print("🧬 Indexing Medical Records with 768-dim Vector Embeddings for pgvector RAG...")
        records_to_embed = [
            {
                "patient": p_alice,
                "title": "Essential Hypertension Management Plan",
                "category": RecordCategory.NOTE,
                "icd": "I10",
                "desc": "Primary hypertension well controlled on Lisinopril 10mg daily. Baseline BP 128/82 mmHg. Normal renal function.",
            },
            {
                "patient": p_alice,
                "title": "Type 2 Diabetes Glycemic Review",
                "category": RecordCategory.NOTE,
                "icd": "E11.9",
                "desc": "Glycated Hemoglobin HbA1c 6.7%. Fasting blood sugar 118 mg/dL. Metformin 500mg BID tolerated without GI adverse effects.",
            },
            {
                "patient": p_david,
                "title": "Heart Failure with Reduced Ejection Fraction (HFrEF)",
                "category": RecordCategory.DIAGNOSIS,
                "icd": "I50.22",
                "desc": "Echocardiogram demonstrates LVEF 35% with regional wall motion abnormalities. Elevated NT-proBNP 4,280 pg/mL.",
            },
        ]

        for r_item in records_to_embed:
            # Generate deterministic pseudo or Gemini embedding
            full_txt = f"{r_item['title']}. {r_item['desc']} ICD-10: {r_item['icd']}."
            emb = await ai_service.embed_text(full_txt)

            med_rec = MedicalRecord(
                id=uuid.uuid4(),
                patient_id=r_item["patient"].id,
                category=r_item["category"],
                title=r_item["title"],
                description=r_item["desc"],
                icd10_code=r_item["icd"],
                record_date=date.today() - timedelta(days=7),
                status=RecordStatus.ACTIVE,
            )
            session.add(med_rec)

        # ── 8. Baseline HIPAA Audit Logs ──────────────────────────────────────
        print("🛡️ Generating Baseline HIPAA Security Audit Logs...")
        audit_events = [
            AuditLog(
                id=uuid.uuid4(),
                user_id=admin_user.id,
                action=AuditAction.LOGIN_SUCCESS,
                severity=AuditSeverity.INFO,
                resource_type="User",
                resource_id=str(admin_user.id),
                details={"ip": "127.0.0.1", "auth_method": "OAuth2 Password Flow"},
            ),
            AuditLog(
                id=uuid.uuid4(),
                user_id=doc_cardio.user_id,
                action=AuditAction.VIEW_RECORD,
                severity=AuditSeverity.INFO,
                resource_type="Patient",
                resource_id=str(p_alice.id),
                details={"patient_mrn": p_alice.mrn, "reason": "Clinical Encounter Preparation"},
            ),
        ]
        session.add_all(audit_events)

        await session.commit()
        print("✅ MediCare AI Database Seeding Completed Successfully!")
        print("\nDemo Login Credentials:")
        print("┌──────────────┬───────────────────────────────┬──────────────────┐")
        print("│ Portal       │ Email                         │ Password         │")
        print("├──────────────┼───────────────────────────────┼──────────────────┤")
        print("│ Admin Portal │ admin@medicare.ai             │ AdminPass123!    │")
        print("│ Doctor Portal│ sarah.chen@medicare.ai        │ DoctorPass123!   │")
        print("│ Patient Portal│ alice.johnson@medicare.ai    │ PatientPass123!  │")
        print("└──────────────┴───────────────────────────────┴──────────────────┘")


if __name__ == "__main__":
    asyncio.run(seed_database())
