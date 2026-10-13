"""
Auto-seeder for MediCare AI.
Guarantees standard clinical demo credentials exist for production evaluation.
"""
from datetime import date
import uuid
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.patient import Patient, BloodType, Gender

log = structlog.get_logger(__name__)


async def seed_initial_data(session: AsyncSession) -> None:
    """Ensure baseline demo accounts exist for production evaluation."""
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

        await session.commit()
        log.info("Baseline clinical accounts verification/seeding completed successfully.")
    except Exception as exc:
        await session.rollback()
        log.error("Failed to seed initial clinical data", error=str(exc))
        raise exc
