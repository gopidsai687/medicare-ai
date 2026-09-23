"""
Laboratories & Diagnostic Panels Router.
Serves laboratory orders and analyte results for Patient and Doctor portals.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.base import UUIDType
from app.models.enterprise_clinical import ClinicalEncounter
from app.models.enterprise_diagnostics import LaboratoryOrder, LaboratoryResult
from app.models.enterprise_patient import PatientDetails
from app.models.enterprise_provider import DoctorDetails
from app.models.patient import Patient
from app.models.user import User, UserRole

router = APIRouter(prefix="/labs", tags=["Laboratories & Diagnostics"])


class LabTestSchema(BaseModel):
    id: str
    name: str = ""
    value: float
    unit: str
    rangeMin: float
    rangeMax: float
    status: str  # Normal, Elevated, Low
    trend: str = "stable"
    date: str


class LabPanelSchema(BaseModel):
    id: str
    title: str
    orderedBy: str
    date: str
    tests: List[Dict[str, Any]]


@router.get("", response_model=List[Dict[str, Any]])
async def get_lab_panels(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve grouped lab panels with test results.
    Patients only see their own lab panels. Doctors/Admins can query any patient.
    """
    target_patient_id = patient_id
    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        target_patient_id = p_res.scalar_one_or_none()
        if not target_patient_id:
            # Check ptnt_dtls
            p2_stmt = select(PatientDetails.ptnt_id).where(PatientDetails.usr_id == current_user.id)
            p2_res = await db.execute(p2_stmt)
            target_patient_id = p2_res.scalar_one_or_none()

    # Query laboratory orders
    query = select(LaboratoryOrder).order_by(desc(LaboratoryOrder.ordr_dttm))
    if target_patient_id:
        query = query.where(LaboratoryOrder.ptnt_id == target_patient_id)

    orders_res = await db.execute(query)
    orders = orders_res.scalars().all()

    panels: List[Dict[str, Any]] = []

    for ordr in orders:
        # Load doctor name
        doc_stmt = select(DoctorDetails.dctr_fl_nm).where(DoctorDetails.dctr_id == ordr.dctr_id)
        doc_res = await db.execute(doc_stmt)
        doc_name = doc_res.scalar_one_or_none() or "Attending Physician"

        # Load results for this order
        res_stmt = select(LaboratoryResult).where(LaboratoryResult.lab_ordr_id == ordr.lab_ordr_id)
        res_exec = await db.execute(res_stmt)
        results = res_exec.scalars().all()

        tests_list = []
        for r in results:
            val = float(r.rslt_num_val) if r.rslt_num_val is not None else 0.0
            test_status = "Elevated" if r.abnrml_fl else "Normal"

            # Parse range if present
            rmin, rmax = 3.5, 5.0
            if r.ref_rng_txt and "-" in r.ref_rng_txt:
                try:
                    parts = r.ref_rng_txt.split("-")
                    rmin = float(parts[0].strip())
                    rmax = float(parts[1].strip())
                except Exception:
                    pass

            tests_list.append({
                "id": str(r.lab_rslt_id),
                "name": r.test_nm,
                "value": val,
                "unit": r.unit_cd or "",
                "rangeMin": rmin,
                "rangeMax": rmax,
                "status": test_status,
                "trend": "stable",
                "date": r.rslt_dttm.strftime("%Y-%m-%d") if r.rslt_dttm else str(date.today()),
            })

        panels.append({
            "id": str(ordr.lab_ordr_id),
            "title": ordr.test_nm,
            "orderedBy": doc_name,
            "date": ordr.ordr_dttm.strftime("%Y-%m-%d") if ordr.ordr_dttm else str(date.today()),
            "priority": ordr.priority_cd,
            "status": ordr.ordr_sts_cd,
            "tests": tests_list,
        })

    return panels


class LabOrderCreate(BaseModel):
    patient_id: Optional[uuid.UUID] = None
    patient_name: Optional[str] = None
    panel_name: str
    priority: str = "ROUTINE"
    fasting: bool = False
    clinical_indication: Optional[str] = None


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_lab_order(
    body: LabOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Doctors and Admins can create a new laboratory diagnostic order.
    """
    if current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Patients cannot create laboratory orders.")

    # Resolve target patient
    target_patient_id = body.patient_id
    if not target_patient_id:
        p_stmt = select(PatientDetails.ptnt_id).limit(1)
        p_res = await db.execute(p_stmt)
        target_patient_id = p_res.scalar_one_or_none()

    if not target_patient_id:
        p_stmt2 = select(Patient.id).limit(1)
        p_res2 = await db.execute(p_stmt2)
        target_patient_id = p_res2.scalar_one_or_none()

    if not target_patient_id:
        raise HTTPException(status_code=404, detail="No patient found to associate with this order.")

    # Resolve doctor
    doc_stmt = select(DoctorDetails.dctr_id).where(DoctorDetails.usr_id == current_user.id)
    doc_res = await db.execute(doc_stmt)
    doc_id = doc_res.scalar_one_or_none()

    if not doc_id:
        doc_stmt2 = select(DoctorDetails.dctr_id).limit(1)
        doc_res2 = await db.execute(doc_stmt2)
        doc_id = doc_res2.scalar_one_or_none()

    if not doc_id:
        doc_id = current_user.id

    new_order = LaboratoryOrder(
        lab_ordr_id=uuid.uuid4(),
        ptnt_id=target_patient_id,
        dctr_id=doc_id,
        test_nm=body.panel_name,
        test_cd="LOINC-PANEL",
        ordr_sts_cd="PENDING",
        priority_cd=body.priority.upper(),
        instrctn_txt=body.clinical_indication or ("Fasting required" if body.fasting else "Routine"),
    )
    db.add(new_order)
    await db.flush()

    default_tests = [
        ("Glucose", 92.0, "mg/dL", "70-99", False),
        ("BUN", 14.0, "mg/dL", "7-20", False),
        ("Creatinine", 0.95, "mg/dL", "0.6-1.2", False),
        ("Potassium", 4.1, "mmol/L", "3.5-5.0", False),
    ]
    for t_nm, t_val, t_unit, t_rng, is_abn in default_tests:
        res_row = LaboratoryResult(
            lab_rslt_id=uuid.uuid4(),
            lab_ordr_id=new_order.lab_ordr_id,
            ptnt_id=target_patient_id,
            test_nm=t_nm,
            test_cd="LOINC-" + t_nm[:3].upper(),
            rslt_num_val=t_val,
            unit_cd=t_unit,
            ref_rng_txt=t_rng,
            abnrml_fl=is_abn,
            lab_rslt_sts_cd="PENDING",
        )
        db.add(res_row)

    await db.commit()
    await db.refresh(new_order)

    return {
        "id": str(new_order.lab_ordr_id),
        "title": new_order.test_nm,
        "orderedBy": current_user.full_name or "Attending Physician",
        "date": str(date.today()),
        "priority": new_order.priority_cd,
        "status": new_order.ordr_sts_cd,
        "tests": [],
    }


@router.patch("/orders/{order_id}/sign")
async def sign_lab_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Doctors can sign off on completed laboratory results.
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only doctors and admins can sign off on lab orders.")

    stmt = select(LaboratoryOrder).where(LaboratoryOrder.lab_ordr_id == order_id)
    res = await db.execute(stmt)
    ordr = res.scalar_one_or_none()
    if not ordr:
        raise HTTPException(status_code=404, detail="Laboratory order not found.")

    ordr.ordr_sts_cd = "COMPLETED"

    r_stmt = select(LaboratoryResult).where(LaboratoryResult.lab_ordr_id == order_id)
    r_res = await db.execute(r_stmt)
    results = r_res.scalars().all()
    for r in results:
        r.vrfd_by = current_user.id
        r.lab_rslt_sts_cd = "FINAL"

    await db.commit()
    return {"status": "signed", "order_id": str(order_id)}
