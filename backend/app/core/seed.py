"""
Auto-seeder for MediCare AI.
Populates standard clinical demo credentials if database is empty on first boot.
"""
from datetime import date
import uuid
import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.patient import Patient, BloodType, Gender

log = structlog.get_logger(__name__)


async def seed_initial_data(session: AsyncSession) -> None:
    """Ensure baseline demo accounts exist for production evaluation."""
    try:
        user_count_stmt = select(func.count(User.id))
        result = await session.execute(user_count_stmt)
        count = result.scalar_one_or_none() or 0

        if count > 0:
            return  # Database already populated

        log.info("Empty database detected; seeding baseline clinical accounts...")

        # 1. Admin
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@medicare.ai",
            hashed_password=hash_password("AdminPass123!"),
            full_name="System Administrator",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(admin_user)

        # 2. Doctor Sarah Chen
        doc_user_id = uuid.uuid4()
        doc_user = User(
            id=doc_user_id,
            email="sarah.chen@medicare.ai",
            hashed_password=hash_password("DoctorPass123!"),
            full_name="Dr. Sarah Chen, MD",
            role=UserRole.DOCTOR,
            is_active=True,
            is_verified=True,
        )
        session.add(doc_user)
        await session.flush()

        doc_profile = Doctor(
            id=uuid.uuid4(),
            user_id=doc_user_id,
            license_number="MD-2024-99881",
            specialty="Internal Medicine",
            department="General Medicine",
            office_location="Building A, Room 302",
            is_accepting_patients=True,
            bio="Board-certified internal medicine physician specializing in preventive health.",
        )
        session.add(doc_profile)

        # 3. Patient Alice Johnson
        pat_user_id = uuid.uuid4()
        pat_user = User(
            id=pat_user_id,
            email="alice.johnson@medicare.ai",
            hashed_password=hash_password("PatientPass123!"),
            full_name="Alice Johnson",
            role=UserRole.PATIENT,
            is_active=True,
            is_verified=True,
        )
        session.add(pat_user)
        await session.flush()

        pat_profile = Patient(
            id=uuid.uuid4(),
            user_id=pat_user_id,
            mrn="MRN-10001",
            date_of_birth=date(1988, 4, 12),
            gender=Gender.FEMALE,
            blood_type=BloodType.O_POS,
            phone="(555) 234-5678",
            address="742 Evergreen Terrace, Springfield",
            emergency_contact_name="Bob Johnson",
            emergency_contact_phone="(555) 876-5432",
            allergies=["Penicillin"],
            chronic_conditions=["Mild Asthma"],
        )
        session.add(pat_profile)

        await session.commit()
        log.info("Baseline clinical accounts successfully seeded.")
    except Exception as exc:
        await session.rollback()
        log.warning("Seeder encountered an issue (ignoring if tables exist):", error=str(exc))
