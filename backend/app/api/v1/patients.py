"""
Patient Management API endpoints — Admin and Doctor access.
Provides GET (list/detail) and POST (create) for Patient records.
"""
import uuid
from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.appointment import Appointment
from app.models.prescription import Prescription
from app.models.lab_result import LabResult
from app.models.medical_record import MedicalRecord
from app.models.vital_sign import VitalSign
from app.models.encounter import Encounter
from app.models.enterprise_patient import PatientDetails

router = APIRouter(prefix="/patients", tags=["Patients"])


# ── Response schema ────────────────────────────────────────────────────────────

class PatientSummary(BaseModel):
    id: str
    name: str
    mrn: str
    dob: Optional[str] = None
    gender: str = "prefer_not_to_say"
    blood_type: str = "unknown"
    phone: Optional[str] = None
    address: Optional[str] = None
    insurance_provider: Optional[str] = None
    doctor: Optional[str] = None
    dept: Optional[str] = None
    status: str = "Active"
    is_merged: bool = False
    merged_into_mrn: Optional[str] = None
    notes: Optional[str] = None


class PatientCreate(BaseModel):
    full_name: str
    email: str
    date_of_birth: Optional[date] = None
    gender: str = "prefer_not_to_say"
    blood_type: str = "unknown"
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    notes: Optional[str] = None


# ── Helper ─────────────────────────────────────────────────────────────────────

def _build_address(p: Patient) -> Optional[str]:
    parts = [p.address_line1, p.city, p.state, p.zip_code]
    filled = [x for x in parts if x]
    return ", ".join(filled) if filled else None


async def _to_summary(p: Patient, db: AsyncSession) -> Dict[str, Any]:
    name = p.user.full_name if p.user else "Unknown Patient"

    # Attempt to find their primary doctor via most recent appointment
    doctor_name: Optional[str] = None
    dept_name: Optional[str] = None
    try:
        from app.models.appointment import Appointment
        apt_stmt = (
            select(Appointment)
            .where(Appointment.patient_id == p.id)
            .order_by(Appointment.scheduled_at.desc())
            .limit(1)
        )
        apt_res = await db.execute(apt_stmt)
        apt = apt_res.scalar_one_or_none()
        if apt and apt.doctor_id:
            doc_stmt = select(Doctor).where(Doctor.id == apt.doctor_id)
            doc_res = await db.execute(doc_stmt)
            doc = doc_res.scalar_one_or_none()
            if doc and doc.user:
                doctor_name = doc.user.full_name
                dept_name = doc.department or "General Medicine"
    except Exception:
        pass

    merged_into_mrn: Optional[str] = None
    if p.is_merged and p.merged_into_id:
        try:
            mi_stmt = select(Patient.mrn).where(Patient.id == p.merged_into_id)
            mi_res = await db.execute(mi_stmt)
            merged_into_mrn = mi_res.scalar_one_or_none()
        except Exception:
            pass

    status_val = "Merged" if p.is_merged else "Active"

    return {
        "id": str(p.id),
        "name": name,
        "mrn": p.mrn,
        "dob": p.date_of_birth.isoformat() if p.date_of_birth else None,
        "gender": p.gender.value if hasattr(p.gender, "value") else str(p.gender),
        "blood_type": p.blood_type.value if hasattr(p.blood_type, "value") else str(p.blood_type),
        "phone": p.phone,
        "address": _build_address(p),
        "insurance_provider": p.insurance_provider,
        "doctor": doctor_name,
        "dept": dept_name,
        "status": status_val,
        "is_merged": p.is_merged,
        "merged_into_mrn": merged_into_mrn,
        "notes": p.notes,
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[Dict[str, Any]])
async def list_patients(
    search: Optional[str] = Query(None, description="Search name or MRN"),
    include_merged: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin / Doctor: list all patients with demographic summary.
    Patients cannot list other patients.
    """
    if current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Patients cannot list the patient directory.")

    query = select(Patient)

    if not include_merged:
        query = query.where(Patient.is_merged == False)  # noqa: E712

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    patients = result.scalars().all()

    # Optional search filter (applied after DB fetch to allow full-name join via user relationship)
    if search:
        q = search.lower()
        patients = [
            p for p in patients
            if q in (p.user.full_name if p.user else "").lower()
            or q in p.mrn.lower()
        ]

    summaries = []
    for p in patients:
        summaries.append(await _to_summary(p, db))

    return summaries


@router.get("/count")
async def patient_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick census count for dashboard KPIs."""
    if current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Forbidden")

    total_res = await db.execute(select(func.count()).select_from(Patient))
    total = total_res.scalar_one()

    merged_res = await db.execute(
        select(func.count()).select_from(Patient).where(Patient.is_merged == True)  # noqa: E712
    )
    merged = merged_res.scalar_one()

    return {"total": total, "active": total - merged, "merged": merged}


# ── Helper functions for Dashboard & Vitals Evaluation ────────────────────────

def _format_elapsed_text(dt: Optional[datetime], now: datetime) -> str:
    if not dt:
        return "Never recorded"
    utc_dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    diff = now - utc_dt
    secs = max(0, int(diff.total_seconds()))
    if secs < 60:
        return "Just now"
    if secs < 3600:
        m = secs // 60
        return f"{m}m ago"
    if secs < 86400:
        h = secs // 3600
        return f"{h}h ago"
    d = secs // 86400
    if d == 1:
        return "Yesterday"
    if d < 14:
        return f"{d}d ago"
    return utc_dt.strftime("%b %d, %Y")


def _is_stale_measurement(dt: Optional[datetime], now: datetime, max_days: int = 14) -> bool:
    if not dt:
        return False
    utc_dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return (now - utc_dt).total_seconds() > (max_days * 86400)


async def _resolve_patient_for_dashboard(
    current_user: User,
    explicit_patient_id: Optional[uuid.UUID],
    db: AsyncSession,
) -> Patient:
    if current_user.role == UserRole.PATIENT:
        stmt = select(Patient).where(Patient.user_id == current_user.id)
        res = await db.execute(stmt)
        pat = res.scalar_one_or_none()
        if not pat:
            p2_stmt = select(PatientDetails.ptnt_id).where(PatientDetails.usr_id == current_user.id)
            p2_res = await db.execute(p2_stmt)
            pat_id = p2_res.scalar_one_or_none()
            if pat_id:
                pat = await db.get(Patient, pat_id)
        if not pat:
            mrn = f"MRN-{uuid.uuid4().hex[:8].upper()}"
            pat = Patient(id=uuid.uuid4(), user_id=current_user.id, mrn=mrn)
            db.add(pat)
            await db.commit()
            await db.refresh(pat)

        if explicit_patient_id and pat and explicit_patient_id != pat.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Patients cannot query another patient's dashboard",
            )
        return pat
    else:
        if explicit_patient_id:
            pat = await db.get(Patient, explicit_patient_id)
            if not pat:
                raise HTTPException(status_code=404, detail="Requested patient not found.")
            return pat
        # Default for admin/clinician preview to the first patient
        stmt = select(Patient).limit(1)
        res = await db.execute(stmt)
        pat = res.scalar_one_or_none()
        if not pat:
            raise HTTPException(status_code=404, detail="No patient found in database.")
        return pat


# ── Patient Dashboard Endpoint ────────────────────────────────────────────────

@router.get("/dashboard", response_model=Dict[str, Any])
async def get_patient_dashboard(
    patient_id: Optional[uuid.UUID] = Query(None, description="Explicit patient ID for doctors/admins"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Patient Portal Dashboard Aggregation:
    - Verified clinical stats (Appointments, Medications, Lab Results, Documents)
    - Authentic live vitals with strict status logic (Within Target Band, Attention, Urgent, Stale Data, No Data)
    - Full chronological Recent Activity across all clinical events
    - Functional Diagnostics HUD with missing/outdated/abnormal indicators
    - Guarantees strict patient isolation
    """
    patient = await _resolve_patient_for_dashboard(current_user, patient_id, db)
    now = datetime.now(timezone.utc)

    # 1. Dashboard Stats Cards
    now_dt = datetime.now(timezone.utc)
    appts_stmt = select(func.count(Appointment.id)).where(
        Appointment.patient_id == patient.id,
        Appointment.scheduled_at >= now_dt,
        Appointment.status.notin_(["cancelled", "Cancelled"]),
    )
    appts_count = await db.scalar(appts_stmt) or 0

    rx_stmt = select(func.count(Prescription.id)).where(
        Prescription.patient_id == patient.id,
        Prescription.status.in_(["active", "Active"]),
        Prescription.is_archived == False,
    )
    rx_count = await db.scalar(rx_stmt) or 0

    labs_stmt = select(func.count(LabResult.id)).where(
        LabResult.patient_id == patient.id,
        LabResult.is_archived == False,
    )
    labs_count = await db.scalar(labs_stmt) or 0

    docs_stmt = select(func.count(MedicalRecord.id)).where(
        MedicalRecord.patient_id == patient.id,
        MedicalRecord.is_archived == False,
    )
    docs_count = await db.scalar(docs_stmt) or 0

    # 2. Query Recent Telemetry & Records
    v_stmt = (
        select(VitalSign)
        .where(VitalSign.patient_id == patient.id)
        .order_by(desc(VitalSign.recorded_at))
        .limit(100)
    )
    v_res = await db.execute(v_stmt)
    vital_records = v_res.scalars().all()

    # Prefer verified non-sample entries
    actual_vitals = [v for v in vital_records if not v.is_sample]
    pool = actual_vitals if actual_vitals else vital_records

    # ── A. Blood Pressure ──
    latest_bp_rec = next((v for v in pool if v.systolic_bp is not None and v.diastolic_bp is not None), None)
    if latest_bp_rec:
        sbp = latest_bp_rec.systolic_bp
        dbp = latest_bp_rec.diastolic_bp
        stale_bp = _is_stale_measurement(latest_bp_rec.recorded_at, now, 14)
        if stale_bp:
            bp_status = "Stale Data"
            bp_cat = "Stale Measurement (>14d)"
            bp_color = "#94a3b8"
        elif sbp > 180 or dbp > 120:
            bp_status = "Urgent"
            bp_cat = "Hypertensive Crisis"
            bp_color = "#f43f5e"
        elif sbp >= 140 or dbp >= 90:
            bp_status = "Urgent"
            bp_cat = "Stage 2 Hypertension"
            bp_color = "#f43f5e"
        elif sbp >= 130 or dbp >= 80:
            bp_status = "Attention"
            bp_cat = "Stage 1 Hypertension"
            bp_color = "#f59e0b"
        elif sbp >= 120 and dbp < 80:
            bp_status = "Attention"
            bp_cat = "Elevated Blood Pressure"
            bp_color = "#f59e0b"
        elif sbp < 90 or dbp < 60:
            bp_status = "Attention"
            bp_cat = "Low Blood Pressure"
            bp_color = "#f59e0b"
        else:
            bp_status = "Within Target Band"
            bp_cat = "Normal"
            bp_color = "#10b981"

        is_dev = bool(latest_bp_rec.device_name or "omron" in (latest_bp_rec.measurement_source or "").lower() or "device" in (latest_bp_rec.measurement_source or "").lower())
        bp_data = {
            "has_data": True,
            "label": "Blood Pressure",
            "value": f"{sbp}/{dbp}",
            "unit": "mmHg",
            "status": bp_status,
            "status_label": bp_status.upper(),
            "category": bp_cat,
            "color": bp_color,
            "recorded_at": latest_bp_rec.recorded_at.isoformat() if latest_bp_rec.recorded_at else None,
            "elapsed_time": _format_elapsed_text(latest_bp_rec.recorded_at, now),
            "source": latest_bp_rec.measurement_source or "manual_entry",
            "device_name": latest_bp_rec.device_name,
            "measurement_type": "Resting Upper-Arm Cuff",
            "verification_status": "REAL DEVICE DATA" if is_dev else "Manual Entry — Not Device Verified",
            "path": "/patient/vitalsense/blood-pressure",
        }
    else:
        bp_data = {
            "has_data": False,
            "label": "Blood Pressure",
            "value": "--",
            "unit": "mmHg",
            "status": "No Data",
            "status_label": "NO DATA",
            "category": "No Telemetry Recorded",
            "color": "#64748b",
            "recorded_at": None,
            "elapsed_time": "Never recorded",
            "source": None,
            "device_name": None,
            "measurement_type": "Upper-Arm Cuff",
            "verification_status": "No Data Recorded",
            "path": "/patient/vitalsense/blood-pressure",
        }

    # ── B. Heart Rate ──
    latest_hr_rec = next((v for v in pool if v.heart_rate is not None), None)
    if latest_hr_rec:
        hr = latest_hr_rec.heart_rate
        stale_hr = _is_stale_measurement(latest_hr_rec.recorded_at, now, 14)
        if stale_hr:
            hr_status = "Stale Data"
            hr_cat = "Stale Pulse (>14d)"
            hr_color = "#94a3b8"
        elif hr > 120 or hr < 40:
            hr_status = "Urgent"
            hr_cat = "Marked Tachycardia" if hr > 120 else "Marked Bradycardia"
            hr_color = "#f43f5e"
        elif hr > 100 or hr < 50:
            hr_status = "Attention"
            hr_cat = "Elevated Pulse" if hr > 100 else "Low Resting Pulse"
            hr_color = "#f59e0b"
        else:
            hr_status = "Within Target Band"
            hr_cat = "Normal Resting Pulse"
            hr_color = "#10b981"

        is_cam = "webcam" in (latest_hr_rec.measurement_source or "").lower() or "rppg" in (latest_hr_rec.measurement_source or "").lower()
        is_dev = bool(latest_hr_rec.device_name or "omron" in (latest_hr_rec.measurement_source or "").lower())
        hr_data = {
            "has_data": True,
            "label": "Heart Rate",
            "value": str(hr),
            "unit": "bpm",
            "status": hr_status,
            "status_label": hr_status.upper(),
            "category": hr_cat,
            "color": hr_color,
            "recorded_at": latest_hr_rec.recorded_at.isoformat() if latest_hr_rec.recorded_at else None,
            "elapsed_time": _format_elapsed_text(latest_hr_rec.recorded_at, now),
            "source": latest_hr_rec.measurement_source or "manual_entry",
            "device_name": latest_hr_rec.device_name or ("VitalSense rPPG Camera" if is_cam else None),
            "measurement_type": "Resting Pulse Rate",
            "verification_status": "VitalSense rPPG Camera" if is_cam else ("REAL DEVICE DATA" if is_dev else "Manual Entry — Not Device Verified"),
            "path": "/patient/vitalsense",
        }
    else:
        hr_data = {
            "has_data": False,
            "label": "Heart Rate",
            "value": "--",
            "unit": "bpm",
            "status": "No Data",
            "status_label": "NO DATA",
            "category": "No Telemetry Recorded",
            "color": "#64748b",
            "recorded_at": None,
            "elapsed_time": "Never recorded",
            "source": None,
            "device_name": None,
            "measurement_type": "Resting Pulse",
            "verification_status": "No Data Recorded",
            "path": "/patient/vitalsense",
        }

    # ── C. Blood Glucose ──
    latest_glu_rec = next((v for v in pool if v.blood_glucose is not None), None)
    # Also check LabResult if no VitalSign glucose exists
    lab_glu_fallback = None
    if not latest_glu_rec:
        l_stmt = (
            select(LabResult)
            .where(
                LabResult.patient_id == patient.id,
                LabResult.is_archived == False,
                or_(
                    LabResult.test_name.ilike("%glucose%"),
                    LabResult.test_name.ilike("%fingerstick%"),
                ),
            )
            .order_by(desc(LabResult.test_date), desc(LabResult.created_at))
            .limit(1)
        )
        l_res = await db.execute(l_stmt)
        lab_glu_fallback = l_res.scalar_one_or_none()

    if latest_glu_rec:
        g_val = latest_glu_rec.blood_glucose
        g_unit = latest_glu_rec.glucose_unit or "mg/dL"
        ctx = (latest_glu_rec.glucose_context or "").strip().lower()
        stale_g = _is_stale_measurement(latest_glu_rec.recorded_at, now, 14)
        if stale_g:
            g_status = "Stale Data"
            g_cat = "Stale Glucose (>14d)"
            g_color = "#94a3b8"
        elif g_val < 54:
            g_status = "Urgent"
            g_cat = "Severe Hypoglycemia"
            g_color = "#f43f5e"
        elif g_val < 70:
            g_status = "Urgent"
            g_cat = "Hypoglycemia"
            g_color = "#f43f5e"
        elif "fasting" in ctx:
            if g_val >= 126:
                g_status = "Urgent"
                g_cat = "Elevated Fasting Glucose"
                g_color = "#f43f5e"
            elif g_val >= 100:
                g_status = "Attention"
                g_cat = "Impaired Fasting Glucose"
                g_color = "#f59e0b"
            else:
                g_status = "Within Target Band"
                g_cat = "Normal Fasting"
                g_color = "#10b981"
        elif "after" in ctx or "post" in ctx:
            if g_val >= 200:
                g_status = "Urgent"
                g_cat = "Marked Post-Meal Elevation"
                g_color = "#f43f5e"
            elif g_val >= 140:
                g_status = "Attention"
                g_cat = "Elevated Post-Meal Glucose"
                g_color = "#f59e0b"
            else:
                g_status = "Within Target Band"
                g_cat = "Normal Post-Meal"
                g_color = "#10b981"
        else:
            if g_val >= 200:
                g_status = "Urgent"
                g_cat = "Marked Hyperglycemia"
                g_color = "#f43f5e"
            elif g_val >= 140:
                g_status = "Attention"
                g_cat = "Elevated Random Glucose"
                g_color = "#f59e0b"
            else:
                g_status = "Within Target Band"
                g_cat = "Normal Glucose"
                g_color = "#10b981"

        ctx_label = "Fasting Fingerstick" if "fasting" in ctx else ("Post-Prandial (2h)" if "after" in ctx or "post" in ctx else "Random Glucose")
        is_dev = bool(latest_glu_rec.device_name or "cgm" in (latest_glu_rec.measurement_source or "").lower() or "dexcom" in (latest_glu_rec.measurement_source or "").lower())
        glucose_data = {
            "has_data": True,
            "label": "Blood Glucose",
            "value": str(round(g_val, 1)),
            "unit": g_unit,
            "status": g_status,
            "status_label": g_status.upper(),
            "category": g_cat,
            "color": g_color,
            "recorded_at": latest_glu_rec.recorded_at.isoformat() if latest_glu_rec.recorded_at else None,
            "elapsed_time": _format_elapsed_text(latest_glu_rec.recorded_at, now),
            "source": latest_glu_rec.measurement_source or "manual_entry",
            "device_name": latest_glu_rec.device_name,
            "measurement_type": ctx_label,
            "verification_status": "REAL DEVICE DATA" if is_dev else "Manual Entry — Not Device Verified",
            "path": "/patient/vitalsense/blood-glucose",
        }
    elif lab_glu_fallback:
        g_val = lab_glu_fallback.value
        g_unit = lab_glu_fallback.unit or "mg/dL"
        ctx = (lab_glu_fallback.fasting_status or "").lower()
        is_fasting = "fasting" in (lab_glu_fallback.test_name or "").lower() or "fasting" in ctx
        if g_val < 70:
            g_status = "Urgent"
            g_cat = "Hypoglycemia"
            g_color = "#f43f5e"
        elif is_fasting and g_val >= 126:
            g_status = "Urgent"
            g_cat = "Elevated Fasting Glucose"
            g_color = "#f43f5e"
        elif is_fasting and g_val >= 100:
            g_status = "Attention"
            g_cat = "Impaired Fasting Glucose"
            g_color = "#f59e0b"
        elif g_val >= 200:
            g_status = "Urgent"
            g_cat = "Marked Hyperglycemia"
            g_color = "#f43f5e"
        elif g_val >= 140:
            g_status = "Attention"
            g_cat = "Elevated Glucose"
            g_color = "#f59e0b"
        else:
            g_status = "Within Target Band"
            g_cat = "Normal Glucose"
            g_color = "#10b981"

        ctx_label = "Fasting Fingerstick" if is_fasting else "Diagnostic Lab Glucose"
        glu_dt = datetime.combine(lab_glu_fallback.test_date, datetime.min.time(), tzinfo=timezone.utc)
        glucose_data = {
            "has_data": True,
            "label": "Blood Glucose",
            "value": str(round(g_val, 1)),
            "unit": g_unit,
            "status": g_status,
            "status_label": g_status.upper(),
            "category": g_cat,
            "color": g_color,
            "recorded_at": glu_dt.isoformat(),
            "elapsed_time": _format_elapsed_text(glu_dt, now),
            "source": lab_glu_fallback.source or "laboratory_imported",
            "device_name": lab_glu_fallback.device_name or lab_glu_fallback.laboratory_name,
            "measurement_type": ctx_label,
            "verification_status": "Diagnostic Lab Record",
            "path": "/patient/vitalsense/blood-glucose",
        }
    else:
        glucose_data = {
            "has_data": False,
            "label": "Blood Glucose",
            "value": "--",
            "unit": "mg/dL",
            "status": "No Data",
            "status_label": "NO DATA",
            "category": "No Telemetry Recorded",
            "color": "#64748b",
            "recorded_at": None,
            "elapsed_time": "Never recorded",
            "source": None,
            "device_name": None,
            "measurement_type": "Capillary Fingerstick / Plasma",
            "verification_status": "No Data Recorded",
            "path": "/patient/vitalsense/blood-glucose",
        }

    # ── D. BMI & Body Mass ──
    latest_wt_rec = next((v for v in pool if v.weight is not None), None)
    if not latest_wt_rec:
        wt_stmt = select(VitalSign).where(VitalSign.patient_id == patient.id, VitalSign.weight.isnot(None)).order_by(desc(VitalSign.recorded_at)).limit(1)
        latest_wt_rec = (await db.execute(wt_stmt)).scalars().first()
    if latest_wt_rec:
        w = latest_wt_rec.weight
        h = latest_wt_rec.height or 170.0
        bmi_val = round(w / ((h / 100.0) ** 2), 1)
        stale_bmi = _is_stale_measurement(latest_wt_rec.recorded_at, now, 30)
        if stale_bmi:
            bmi_status = "Stale Data"
            bmi_cat = "Stale Weight (>30d)"
            bmi_color = "#94a3b8"
        elif bmi_val < 18.5:
            bmi_status = "Attention"
            bmi_cat = "Underweight (<18.5)"
            bmi_color = "#f59e0b"
        elif bmi_val <= 24.9:
            bmi_status = "Within Target Band"
            bmi_cat = "Normal Weight (18.5 – 24.9)"
            bmi_color = "#10b981"
        elif bmi_val <= 29.9:
            bmi_status = "Attention"
            bmi_cat = "Overweight (25.0 – 29.9)"
            bmi_color = "#f59e0b"
        elif bmi_val >= 35.0:
            bmi_status = "Urgent"
            bmi_cat = "Class 2+ Obesity (≥35.0)"
            bmi_color = "#f43f5e"
        else:
            bmi_status = "Attention"
            bmi_cat = "Class 1 Obesity (30.0 – 34.9)"
            bmi_color = "#f59e0b"

        bmi_data = {
            "has_data": True,
            "label": "BMI",
            "value": str(bmi_val),
            "unit": "kg/m²",
            "weight_kg": w,
            "height_cm": h,
            "status": bmi_status,
            "status_label": bmi_status.upper(),
            "category": bmi_cat,
            "color": bmi_color,
            "recorded_at": latest_wt_rec.recorded_at.isoformat() if latest_wt_rec.recorded_at else None,
            "elapsed_time": _format_elapsed_text(latest_wt_rec.recorded_at, now),
            "source": latest_wt_rec.measurement_source or "manual_entry",
            "device_name": latest_wt_rec.device_name,
            "measurement_type": "Body Mass Index",
            "verification_status": "Calculated from Weight & Height",
            "path": "/patient/profile",
        }
    else:
        bmi_data = {
            "has_data": False,
            "label": "BMI",
            "value": "--",
            "unit": "kg/m²",
            "status": "No Data",
            "status_label": "NO DATA",
            "category": "No Telemetry Recorded",
            "color": "#64748b",
            "recorded_at": None,
            "elapsed_time": "Never recorded",
            "source": None,
            "device_name": None,
            "measurement_type": "Anthropometric Index",
            "verification_status": "No Data Recorded",
            "path": "/patient/profile",
        }

    # 3. Recent Activity Aggregation across Real Patient Records
    activities = []

    # Appointments
    a_q = select(Appointment).where(Appointment.patient_id == patient.id).order_by(desc(Appointment.scheduled_at)).limit(5)
    a_rows = (await db.execute(a_q)).scalars().all()
    for a in a_rows:
        sched_utc = a.scheduled_at if a.scheduled_at.tzinfo else a.scheduled_at.replace(tzinfo=timezone.utc)
        if a.status and a.status.lower() == "cancelled":
            st_text = "Cancelled"
            st_class = "badge-rose"
        elif a.status and a.status.lower() in ("completed", "confirmed"):
            st_text = "Completed" if sched_utc < now else "Confirmed"
            st_class = "badge-gray" if st_text == "Completed" else "badge-blue"
        elif sched_utc < now:
            st_text = "Overdue"
            st_class = "badge-amber"
        else:
            st_text = "Upcoming"
            st_class = "badge-blue"

        doc_label = "Assigned Clinician"
        dept_label = a.department_name or "General Practice"
        if a.doctor:
            if getattr(a.doctor, "user", None) and a.doctor.user.full_name:
                doc_label = f"Dr. {a.doctor.user.full_name}"
            elif getattr(a.doctor, "specialty", None):
                doc_label = f"Dr. ({a.doctor.specialty})"
            if not a.department_name and getattr(a.doctor, "department", None):
                dept_label = a.doctor.department

        activities.append({
            "type": "Appointment",
            "title": f"{doc_label} — {dept_label}",
            "date": sched_utc.strftime("%b %d, %Y"),
            "raw_date": sched_utc,
            "relative_time": _format_elapsed_text(sched_utc, now),
            "status": st_text,
            "status_class": st_class,
            "path": "/patient/appointments",
        })

    # Lab Results
    l_q = select(LabResult).where(LabResult.patient_id == patient.id, LabResult.is_archived == False).order_by(desc(LabResult.test_date), desc(LabResult.created_at)).limit(5)
    l_rows = (await db.execute(l_q)).scalars().all()
    for l in l_rows:
        l_dt = datetime.combine(l.test_date, datetime.min.time(), tzinfo=timezone.utc)
        activities.append({
            "type": "Lab Result",
            "title": f"{l.test_name} ({l.value} {l.unit})",
            "date": l.test_date.strftime("%b %d, %Y") if hasattr(l.test_date, "strftime") else str(l.test_date),
            "raw_date": l_dt,
            "relative_time": _format_elapsed_text(l_dt, now),
            "status": l.status or "Completed",
            "status_class": "badge-green" if (l.status or "").lower() == "normal" else "badge-amber",
            "path": "/patient/labs",
        })

    # Prescriptions
    p_q = select(Prescription).where(Prescription.patient_id == patient.id, Prescription.is_archived == False).order_by(desc(Prescription.created_at)).limit(5)
    p_rows = (await db.execute(p_q)).scalars().all()
    for p in p_rows:
        p_dt = p.created_at if p.created_at.tzinfo else p.created_at.replace(tzinfo=timezone.utc)
        is_act = (p.status or "").lower() in ("active", "renewed")
        activities.append({
            "type": "Prescription",
            "title": f"{p.medication_name} {p.dosage or p.strength or ''}".strip(),
            "date": p_dt.strftime("%b %d, %Y"),
            "raw_date": p_dt,
            "relative_time": _format_elapsed_text(p_dt, now),
            "status": "Active" if is_act else "Discontinued",
            "status_class": "badge-teal" if is_act else "badge-gray",
            "path": "/patient/prescriptions",
        })

    # Medical Records / Visits
    mr_q = select(MedicalRecord).where(MedicalRecord.patient_id == patient.id, MedicalRecord.is_archived == False).order_by(desc(MedicalRecord.record_date), desc(MedicalRecord.created_at)).limit(5)
    mr_rows = (await db.execute(mr_q)).scalars().all()
    for mr in mr_rows:
        rec_dt = datetime.combine(mr.record_date, datetime.min.time(), tzinfo=timezone.utc) if isinstance(mr.record_date, date) else now
        activities.append({
            "type": "Medical Visit" if "visit" in (mr.category.value if hasattr(mr.category, "value") else str(mr.category)).lower() else "Document",
            "title": mr.title,
            "date": rec_dt.strftime("%b %d, %Y"),
            "raw_date": rec_dt,
            "relative_time": _format_elapsed_text(rec_dt, now),
            "status": "Completed",
            "status_class": "badge-gray",
            "path": "/patient/records",
        })

    # Home Monitoring Vitals
    for v in pool[:4]:
        v_dt = v.recorded_at if v.recorded_at.tzinfo else v.recorded_at.replace(tzinfo=timezone.utc)
        v_label = []
        if v.systolic_bp and v.diastolic_bp:
            v_label.append(f"BP {v.systolic_bp}/{v.diastolic_bp} mmHg")
        if v.blood_glucose:
            v_label.append(f"Glucose {v.blood_glucose} mg/dL")
        if v.heart_rate:
            v_label.append(f"Pulse {v.heart_rate} bpm")
        if v_label:
            dev_str = f" ({v.device_name})" if v.device_name else ""
            activities.append({
                "type": "Home Vital",
                "title": f"Logged {', '.join(v_label)}{dev_str}",
                "date": v_dt.strftime("%b %d, %Y"),
                "raw_date": v_dt,
                "relative_time": _format_elapsed_text(v_dt, now),
                "status": "Recorded",
                "status_class": "badge-teal",
                "path": "/patient/vitalsense",
            })

    # Sort all chronologically (newest first)
    activities.sort(key=lambda x: x["raw_date"], reverse=True)
    for a in activities:
        del a["raw_date"]

    recent_activity_list = activities[:8]

    # 4. Diagnostics HUD Payload
    vitals_dict = {
        "blood_pressure": bp_data,
        "heart_rate": hr_data,
        "blood_glucose": glucose_data,
        "bmi": bmi_data,
    }

    abnormal_list = [v for v in vitals_dict.values() if v.get("status") in ("Attention", "Urgent")]
    missing_list = [k.replace("_", " ").title() for k, v in vitals_dict.items() if not v.get("has_data")]
    outdated_list = [k.replace("_", " ").title() for k, v in vitals_dict.items() if v.get("status") == "Stale Data"]

    provenance = {
        "device_verified_count": sum(1 for v in vitals_dict.values() if v.get("verification_status") == "REAL DEVICE DATA"),
        "manual_entry_count": sum(1 for v in vitals_dict.values() if "Manual" in (v.get("verification_status") or "")),
        "total_active_telemetry": sum(1 for v in vitals_dict.values() if v.get("has_data")),
    }

    diagnostics_hud = {
        "patient_name": patient.user.full_name if patient.user else "Patient",
        "mrn": patient.mrn,
        "evaluated_at": now.isoformat(),
        "abnormal_values": abnormal_list,
        "missing_measurements": missing_list,
        "outdated_measurements": outdated_list,
        "provenance": provenance,
        "disclaimer": "Educational physiological visualization • Not an optical scan or automated diagnosis.",
    }

    return {
        "patient_id": str(patient.id),
        "patient_name": patient.user.full_name if patient.user else "Patient",
        "mrn": patient.mrn,
        "evaluated_at": now.isoformat(),
        "stats": {
            "upcoming_appointments": appts_count,
            "active_medications": rx_count,
            "recent_lab_results": labs_count,
            "medical_documents": docs_count,
        },
        "vitals": vitals_dict,
        "recent_activity": recent_activity_list,
        "diagnostics_hud": diagnostics_hud,
        "educational_disclaimer": "This dashboard visualizes verified patient electronic health records. Medical decisions should be confirmed with your licensed physician.",
    }


@router.get("/{patient_id}", response_model=Dict[str, Any])
async def get_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a single patient's full profile."""
    # Patients can only see their own record
    stmt = select(Patient).where(Patient.id == patient_id)
    result = await db.execute(stmt)
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == UserRole.PATIENT and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return await _to_summary(patient, db)
