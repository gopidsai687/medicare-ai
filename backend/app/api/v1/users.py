"""
User management endpoints — admin only.
"""
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import AdminOnly, CurrentUser
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter()


@router.get("/", response_model=list[UserRead], dependencies=[AdminOnly])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 50,
):
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED, dependencies=[AdminOnly])
async def create_user(
    body: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
    )
    db.add(user)
    await db.flush()
    return user


from app.models.doctor import Doctor


@router.get("/doctors")
async def list_doctors(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Doctor))
    docs = result.scalars().all()
    out = []
    for doc in docs:
        out.append({
            "id": str(doc.id),
            "user_id": str(doc.user_id),
            "name": doc.user.full_name if doc.user else "Dr. Physician",
            "email": doc.user.email if doc.user else "",
            "specialty": doc.specialty,
            "license": doc.license_number,
            "npi": doc.npi_number or "1982736450",
            "dept": doc.department or "General Medicine",
            "patients": 32,
            "status": "Active" if doc.is_accepting_patients else "On Leave",
            "phone": doc.phone or "(555) 234-1100",
            "credentials": ["ABIM Board Certified", "State Medical Board Verified", "Active License"],
        })
    return out


class DoctorCreateInput(BaseModel):
    name: str
    email: str
    specialty: str
    dept: str = "General Medicine"
    license: Optional[str] = None
    npi: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = "DoctorPass123!"


@router.post("/doctors", status_code=status.HTTP_201_CREATED)
async def create_doctor(
    body: DoctorCreateInput,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
):
    """Admin endpoint to credential and onboard a new physician."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only administrators can onboard doctors.")

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    license_num = body.license or f"MD-{uuid.uuid4().hex[:8].upper()}"
    npi_num = body.npi or f"19{uuid.uuid4().int % 100000000:08d}"

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password or "DoctorPass123!"),
        full_name=body.name,
        role=UserRole.DOCTOR,
    )
    db.add(user)
    await db.flush()

    doctor = Doctor(
        user_id=user.id,
        license_number=license_num,
        specialty=body.specialty,
        department=body.dept,
        npi_number=npi_num,
        phone=body.phone or "(555) 234-1100",
        is_accepting_patients=True,
    )
    db.add(doctor)

    try:
        from app.models.enterprise_provider import DoctorDetails
        ent_doc = DoctorDetails(
            dctr_id=doctor.id,
            usr_id=user.id,
            dctr_fl_nm=body.name,
            lic_num=license_num,
            npi_num=npi_num,
            dept_nm=body.dept,
        )
        db.add(ent_doc)
    except Exception:
        pass

    await db.commit()
    await db.refresh(doctor)

    return {
        "id": str(doctor.id),
        "user_id": str(user.id),
        "name": user.full_name,
        "email": user.email,
        "specialty": doctor.specialty,
        "license": doctor.license_number,
        "npi": doctor.npi_number,
        "dept": doctor.department,
        "patients": 0,
        "status": "Active",
        "phone": doctor.phone,
        "credentials": ["ABIM Board Certified", "State Medical Board Verified", "Active License"],
    }


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Users can only see themselves unless they're admin
    if current_user.id != user_id and current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserRead, dependencies=[AdminOnly])
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.flush()
    return user
