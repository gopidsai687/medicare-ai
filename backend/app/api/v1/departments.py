"""
Hospital Department Management API endpoints.
"""
import uuid
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.enterprise_provider import Department

router = APIRouter(prefix="/departments", tags=["Hospital Departments"])


class DepartmentSchema(BaseModel):
    id: str
    name: str
    code: str
    director: str = "Dr. Medical Director"
    location: str = "Central Facility"
    bedsTotal: int = 50
    bedsOccupied: int = 35
    staffCount: int = 15
    monthlyVisits: int = 400
    status: str = "Operational"
    phone: str = "(555) 019-2830"


class DepartmentCreate(BaseModel):
    name: str
    code: str
    director: Optional[str] = "Dr. Attending"
    location: Optional[str] = "Main Hospital"
    bedsTotal: Optional[int] = 50
    staffCount: Optional[int] = 12
    phone: Optional[str] = "(555) 019-2800"


@router.get("", response_model=List[DepartmentSchema])
async def list_departments(
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Department)
    res = await db.execute(stmt)
    depts = res.scalars().all()

    out: List[DepartmentSchema] = []
    for d in depts:
        out.append(DepartmentSchema(
            id=str(d.dept_id),
            name=d.dept_nm,
            code=d.dept_cd,
            director="Dr. Department Chair",
            location=d.locn_nm or "North Wing",
            bedsTotal=50,
            bedsOccupied=36,
            staffCount=14,
            monthlyVisits=420,
            status="Operational" if d.dept_sts_cd == "ACTIVE" else "Maintenance",
            phone=d.phone_num or "(555) 019-2800",
        ))
    return out


@router.post("", response_model=DepartmentSchema, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dept = Department(
        dept_cd=payload.code.upper(),
        dept_nm=payload.name,
        locn_nm=payload.location,
        phone_num=payload.phone,
        dept_sts_cd="ACTIVE",
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)

    return DepartmentSchema(
        id=str(dept.dept_id),
        name=dept.dept_nm,
        code=dept.dept_cd,
        director=payload.director or "Dr. Department Chair",
        location=dept.locn_nm or "Main Facility",
        bedsTotal=payload.bedsTotal or 50,
        bedsOccupied=20,
        staffCount=payload.staffCount or 12,
        monthlyVisits=350,
        status="Operational",
        phone=dept.phone_num or "(555) 019-2800",
    )
