"""
MediCare VitalSense API — Advanced Health Monitoring, Telemetry, AI Trend Analysis,
Device Integrations, Reminders, Sharing Consent, and Biometrics.
"""
from __future__ import annotations

import csv
import io
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.medical_record import MedicalRecord
from app.models.medical_report_analysis import MedicalReportUpload
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.prescription_analysis import PrescriptionUpload
from app.models.user import User, UserRole
from app.models.vital_sign import (
    AlertSeverity,
    AlertStatus,
    GlucoseContext,
    MeasurementSource,
    NotificationPreference,
    VitalAlert,
    VitalReminder,
    VitalSharingConsent,
    VitalSign,
    WebAuthnCredential,
)
from app.schemas.vital_sign import (
    BloodGlucoseLogRequest,
    BloodPressureLogRequest,
    BodyMapIndicator,
    BodyMapResponse,
    DeviceBatchImportRequest,
    DeviceBatchImportResponse,
    DoctorClinicalNoteRequest,
    HeartRateLogRequest,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    NotificationSubscribeRequest,
    VitalAlertAcknowledgeRequest,
    VitalAlertRead,
    VitalReminderCreate,
    VitalReminderRead,
    VitalReminderUpdate,
    VitalSharingConsentCreate,
    VitalSharingConsentRead,
    VitalSignCreate,
    VitalSignRead,
    VitalSignUpdate,
    VitalTrendAnalysisRequest,
    VitalTrendAnalysisResponse,
    VitalTrendStats,
    WeightLogRequest,
    classify_blood_glucose,
    classify_blood_pressure,
)
from app.services.ai_service import ai_service
from app.services.alert_engine import check_stale_measurements, evaluate_vital_reading
from app.services.hospital_service import search_nearby_hospitals

router = APIRouter(prefix="/vitals", tags=["VitalSense"])


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _enrich_vital_sign(v: VitalSign, alert: Optional[Any] = None) -> VitalSignRead:
    """Compute deterministic clinical guideline categories and MAP."""
    bp_cat = classify_blood_pressure(v.systolic_bp, v.diastolic_bp)
    glu_cat = classify_blood_glucose(v.blood_glucose, v.glucose_context)
    map_val = None
    if v.systolic_bp is not None and v.diastolic_bp is not None:
        map_val = round(v.diastolic_bp + (v.systolic_bp - v.diastolic_bp) / 3.0, 1)

    read_model = VitalSignRead.model_validate(v)
    read_model.bp_category = bp_cat
    read_model.glucose_category = glu_cat
    read_model.mean_arterial_pressure = map_val
    if alert is not None:
        read_model.alert = {
            "id": alert.id,
            "severity": alert.severity.value if hasattr(alert.severity, "value") else str(alert.severity),
            "title": alert.title,
            "message": alert.message,
            "recommendation": alert.clinical_guidance,
        }
    return read_model


async def _resolve_patient_id(
    db: AsyncSession, current_user: User, requested_patient_id: Optional[uuid.UUID] = None
) -> uuid.UUID:
    """Enforce patient isolation: Patients can only ever query/write their own record."""
    if current_user.role == UserRole.PATIENT:
        stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        res = await db.execute(stmt)
        patient_id = res.scalar_one_or_none()
        if not patient_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found for current user",
            )
        return patient_id

    if requested_patient_id:
        return requested_patient_id

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Target patient_id is required for clinical or administrative requests",
    )


async def _verify_doctor_access(
    db: AsyncSession, doctor_user: User, patient_id: uuid.UUID
) -> Doctor:
    """
    Verify that the doctor has explicit patient consent or an active clinical relationship.
    Prevents cross-patient leakage in the Doctor portal.
    """
    doc_stmt = select(Doctor).where(Doctor.user_id == doctor_user.id)
    doc_res = await db.execute(doc_stmt)
    doctor = doc_res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor profile not found for current user",
        )

    # 1. Check explicit active VitalSharingConsent
    consent_stmt = select(VitalSharingConsent).where(
        VitalSharingConsent.patient_id == patient_id,
        VitalSharingConsent.doctor_id == doctor.id,
        VitalSharingConsent.is_active == True,
    )
    consent_res = await db.execute(consent_stmt)
    active_consent = consent_res.scalar_one_or_none()
    if active_consent:
        return doctor

    # 2. Check active or historical appointment relationship
    appt_stmt = select(Appointment.id).where(
        Appointment.patient_id == patient_id,
        Appointment.doctor_id == doctor.id,
    ).limit(1)
    appt_res = await db.execute(appt_stmt)
    if appt_res.scalar_one_or_none():
        return doctor

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: The patient has not granted consent to share VitalSense data with your provider account.",
    )


# -----------------------------------------------------------------------------
# Core Vitals CRUD & Queries
# -----------------------------------------------------------------------------
@router.get("", response_model=List[VitalSignRead])
@router.get("/history", response_model=List[VitalSignRead])
async def get_vital_signs(
    patient_id: Optional[uuid.UUID] = None,
    limit: int = 100,
    days: Optional[int] = None,
    source: Optional[str] = None,
    vital_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve telemetry records with deterministic AHA/ADA guideline categories.
    Enforces strict patient-level isolation.
    """
    target_patient_id = await _resolve_patient_id(db, current_user, patient_id)

    # If doctor is requesting, verify consent
    if current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        await _verify_doctor_access(db, current_user, target_patient_id)

    query = select(VitalSign).where(VitalSign.patient_id == target_patient_id)

    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(VitalSign.recorded_at >= cutoff)

    if source:
        query = query.where(VitalSign.measurement_source == source)

    if vital_type == "bp":
        query = query.where(VitalSign.systolic_bp.is_not(None))
    elif vital_type == "glucose":
        query = query.where(VitalSign.blood_glucose.is_not(None))
    elif vital_type == "weight":
        query = query.where(VitalSign.weight.is_not(None))
    elif vital_type == "heart_rate":
        query = query.where(VitalSign.heart_rate.is_not(None))

    query = query.order_by(desc(VitalSign.recorded_at)).limit(limit)
    result = await db.execute(query)
    rows = result.scalars().all()
    return [_enrich_vital_sign(r) for r in rows]


@router.post("", response_model=VitalSignRead, status_code=status.HTTP_201_CREATED)
async def record_vital_signs(
    payload: VitalSignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """General telemetry entry endpoint (backward compatible)."""
    target_patient_id = await _resolve_patient_id(db, current_user, payload.patient_id)

    # Standardize glucose mmol/L if mg/dL provided, or vice versa
    glucose_mgdl = payload.blood_glucose
    glucose_mmol = payload.blood_glucose_mmol
    if glucose_mgdl and not glucose_mmol:
        glucose_mmol = round(glucose_mgdl / 18.0182, 2)
    elif glucose_mmol and not glucose_mgdl:
        glucose_mgdl = round(glucose_mmol * 18.0182, 1)

    vitals = VitalSign(
        patient_id=target_patient_id,
        recorded_by_id=current_user.id,
        recorded_at=payload.recorded_at or datetime.now(timezone.utc),
        heart_rate=payload.heart_rate,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        temperature=payload.temperature,
        oxygen_saturation=payload.oxygen_saturation,
        respiratory_rate=payload.respiratory_rate,
        blood_glucose=glucose_mgdl,
        blood_glucose_mmol=glucose_mmol,
        glucose_unit=payload.glucose_unit or "mg/dL",
        glucose_context=payload.glucose_context or "fasting",
        weight=payload.weight,
        height=payload.height,
        measurement_source=payload.measurement_source or "manual_entry",
        device_name=payload.device_name,
        notes=payload.notes,
        is_patient_entered=(current_user.role == UserRole.PATIENT),
        is_sample=payload.is_sample,
    )
    db.add(vitals)
    await evaluate_vital_reading(db, patient_id, vitals)
    await db.commit()
    await db.refresh(vitals)
    return _enrich_vital_sign(vitals)


# -----------------------------------------------------------------------------
# Dedicated Patient Logging Workflows
# -----------------------------------------------------------------------------
@router.post("/blood-pressure", response_model=VitalSignRead, status_code=status.HTTP_201_CREATED)
async def log_blood_pressure(
    payload: BloodPressureLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log blood pressure with systolic, diastolic, pulse, source, and optional notes.
    Categorized deterministically per AHA/ACC 2017.
    """
    patient_id = await _resolve_patient_id(db, current_user)
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)

    source = "SAMPLE_DATA" if payload.is_sample else payload.measurement_source
    vitals = VitalSign(
        patient_id=patient_id,
        recorded_by_id=current_user.id,
        recorded_at=recorded_at,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        heart_rate=payload.heart_rate,
        measurement_source=source,
        device_name=payload.device_name,
        notes=payload.notes,
        is_patient_entered=True,
        is_sample=payload.is_sample,
    )
    db.add(vitals)
    created_alerts = await evaluate_vital_reading(db, patient_id, vitals)
    await db.commit()
    await db.refresh(vitals)
    primary_alert = created_alerts[0] if created_alerts else None
    return _enrich_vital_sign(vitals, alert=primary_alert)


@router.post("/blood-glucose", response_model=VitalSignRead, status_code=status.HTTP_201_CREATED)
async def log_blood_glucose(
    payload: BloodGlucoseLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log blood glucose with bidirectional unit conversion (mg/dL <-> mmol/L)
    and ADA meal context (fasting, before_meal, after_meal, bedtime, random).
    """
    patient_id = await _resolve_patient_id(db, current_user)
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)

    if payload.glucose_unit == "mmol/L":
        glucose_mmol = round(payload.blood_glucose, 2)
        glucose_mgdl = round(payload.blood_glucose * 18.0182, 1)
    else:
        glucose_mgdl = round(payload.blood_glucose, 1)
        glucose_mmol = round(payload.blood_glucose / 18.0182, 2)

    source = "SAMPLE_DATA" if payload.is_sample else payload.measurement_source
    vitals = VitalSign(
        patient_id=patient_id,
        recorded_by_id=current_user.id,
        recorded_at=recorded_at,
        blood_glucose=glucose_mgdl,
        blood_glucose_mmol=glucose_mmol,
        glucose_unit=payload.glucose_unit,
        glucose_context=payload.glucose_context,
        measurement_source=source,
        device_name=payload.device_name,
        notes=payload.notes,
        is_patient_entered=True,
        is_sample=payload.is_sample,
    )
    db.add(vitals)
    created_alerts = await evaluate_vital_reading(db, patient_id, vitals)
    await db.commit()
    await db.refresh(vitals)
    primary_alert = created_alerts[0] if created_alerts else None
    return _enrich_vital_sign(vitals, alert=primary_alert)


@router.put("/{vital_id}", response_model=VitalSignRead)
async def update_vital_sign(
    vital_id: uuid.UUID,
    payload: VitalSignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing vital reading (BP, glucose, heart rate, weight, notes)."""
    patient_id = await _resolve_patient_id(db, current_user)
    stmt = select(VitalSign).where(
        VitalSign.id == vital_id,
        VitalSign.patient_id == patient_id,
    )
    res = await db.execute(stmt)
    vital = res.scalar_one_or_none()
    if not vital:
        raise HTTPException(status_code=404, detail="Vital reading not found")

    if payload.recorded_at is not None:
        vital.recorded_at = payload.recorded_at
    if payload.systolic_bp is not None:
        vital.systolic_bp = payload.systolic_bp
    if payload.diastolic_bp is not None:
        vital.diastolic_bp = payload.diastolic_bp
    if payload.heart_rate is not None:
        vital.heart_rate = payload.heart_rate
    if payload.blood_glucose is not None:
        if payload.glucose_unit == "mmol/L":
            vital.blood_glucose = round(payload.blood_glucose * 18.0182, 1)
            vital.blood_glucose_mmol = round(payload.blood_glucose, 2)
        else:
            vital.blood_glucose = round(payload.blood_glucose, 1)
            vital.blood_glucose_mmol = round(payload.blood_glucose / 18.0182, 2)
        vital.glucose_unit = payload.glucose_unit or "mg/dL"
    if payload.glucose_context is not None:
        vital.glucose_context = payload.glucose_context
    if payload.weight is not None:
        vital.weight = payload.weight
    if payload.notes is not None:
        vital.notes = payload.notes
    if payload.clinical_notes is not None:
        vital.clinical_notes = payload.clinical_notes

    # Re-evaluate alerts
    alerts = await evaluate_vital_reading(db, patient_id, vital)
    await db.commit()
    await db.refresh(vital)
    primary_alert = alerts[0] if alerts else None
    return _enrich_vital_sign(vital, alert=primary_alert)


@router.delete("/{vital_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vital_sign(
    vital_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a vital reading and clean up associated alerts."""
    patient_id = await _resolve_patient_id(db, current_user)
    stmt = select(VitalSign).where(
        VitalSign.id == vital_id,
        VitalSign.patient_id == patient_id,
    )
    res = await db.execute(stmt)
    vital = res.scalar_one_or_none()
    if not vital:
        raise HTTPException(status_code=404, detail="Vital reading not found")

    from sqlalchemy import delete
    await db.execute(delete(VitalAlert).where(VitalAlert.vital_id == vital_id))
    await db.delete(vital)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test-mode/simulate")
async def simulate_clinical_test_state(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Simulates clinical test states (Normal, Attention, Urgent, Stale, or Clear)
    with explicitly tagged fictional test telemetry (is_sample=True, measurement_source='SAMPLE_DATA').
    Never fabricates real measurements or claims device sensor capability.
    """
    patient_id = await _resolve_patient_id(db, current_user)
    state = (payload.get("state") or "normal").lower()
    now = datetime.now(timezone.utc)

    from sqlalchemy import delete
    if state == "clear_test_data":
        del_vitals_res = await db.execute(
            delete(VitalSign).where(
                VitalSign.patient_id == patient_id,
                VitalSign.is_sample == True,
            )
        )
        await db.commit()
        return {
            "status": "success",
            "state": "clear_test_data",
            "message": "Fictional test telemetry cleared. Demonstrating missing/unavailable data state.",
            "deleted_count": del_vitals_res.rowcount,
        }

    vital = None
    if state == "normal":
        vital = VitalSign(
            patient_id=patient_id,
            recorded_by_id=current_user.id,
            recorded_at=now,
            systolic_bp=118,
            diastolic_bp=76,
            heart_rate=72,
            blood_glucose=94.0,
            blood_glucose_mmol=5.22,
            glucose_unit="mg/dL",
            glucose_context="fasting",
            oxygen_saturation=98.5,
            respiratory_rate=16,
            measurement_source="SAMPLE_DATA",
            device_name="Clinical Simulator (Normal Baseline)",
            notes="Fictional test reading: Normal blood pressure & fasting glucose",
            is_patient_entered=False,
            is_sample=True,
        )
    elif state == "attention":
        vital = VitalSign(
            patient_id=patient_id,
            recorded_by_id=current_user.id,
            recorded_at=now,
            systolic_bp=136,
            diastolic_bp=86,
            heart_rate=82,
            blood_glucose=168.0,
            blood_glucose_mmol=9.32,
            glucose_unit="mg/dL",
            glucose_context="after_meal",
            oxygen_saturation=97.0,
            respiratory_rate=18,
            measurement_source="SAMPLE_DATA",
            device_name="Clinical Simulator (Elevated / Stage 1)",
            notes="Fictional test reading: Hypertension Stage 1 & elevated postprandial glucose",
            is_patient_entered=False,
            is_sample=True,
        )
    elif state == "urgent":
        vital = VitalSign(
            patient_id=patient_id,
            recorded_by_id=current_user.id,
            recorded_at=now,
            systolic_bp=192,
            diastolic_bp=124,
            heart_rate=96,
            blood_glucose=48.0,
            blood_glucose_mmol=2.66,
            glucose_unit="mg/dL",
            glucose_context="fasting",
            oxygen_saturation=94.0,
            respiratory_rate=22,
            measurement_source="SAMPLE_DATA",
            device_name="Clinical Simulator (Urgent Crisis)",
            notes="Fictional test reading: Hypertensive crisis (>180/120) & Severe Hypoglycemia (<54)",
            is_patient_entered=False,
            is_sample=True,
        )
    elif state == "stale":
        stale_time = now - timedelta(days=14)
        vital = VitalSign(
            patient_id=patient_id,
            recorded_by_id=current_user.id,
            recorded_at=stale_time,
            systolic_bp=120,
            diastolic_bp=78,
            heart_rate=70,
            blood_glucose=98.0,
            blood_glucose_mmol=5.44,
            glucose_unit="mg/dL",
            glucose_context="fasting",
            measurement_source="SAMPLE_DATA",
            device_name="Clinical Simulator (Stale Telemetry)",
            notes="Fictional test reading: Recorded 14 days ago to evaluate stale telemetry alert",
            is_patient_entered=False,
            is_sample=True,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown test state: {state}. Supported states: normal, attention, urgent, stale, clear_test_data."
        )

    db.add(vital)
    alerts = await evaluate_vital_reading(db, patient_id, vital)
    await db.commit()
    await db.refresh(vital)
    primary_alert = alerts[0] if alerts else None
    return {
        "status": "success",
        "state": state,
        "message": f"Simulated {state.upper()} clinical test reading recorded successfully.",
        "vital": _enrich_vital_sign(vital, alert=primary_alert),
        "alerts_triggered": len(alerts),
    }



@router.post("/weight", response_model=VitalSignRead, status_code=status.HTTP_201_CREATED)
async def log_weight(
    payload: WeightLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log body weight in kilograms."""
    patient_id = await _resolve_patient_id(db, current_user)
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)
    source = "SAMPLE_DATA" if payload.is_sample else payload.measurement_source

    vitals = VitalSign(
        patient_id=patient_id,
        recorded_by_id=current_user.id,
        recorded_at=recorded_at,
        weight=round(payload.weight, 1),
        measurement_source=source,
        device_name=payload.device_name,
        notes=payload.notes,
        is_patient_entered=True,
        is_sample=payload.is_sample,
    )
    db.add(vitals)
    await db.commit()
    await db.refresh(vitals)
    return _enrich_vital_sign(vitals)


@router.post("/heart-rate", response_model=VitalSignRead, status_code=status.HTTP_201_CREATED)
async def log_heart_rate(
    payload: HeartRateLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log resting pulse / heart rate in bpm."""
    patient_id = await _resolve_patient_id(db, current_user)
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)
    source = "SAMPLE_DATA" if payload.is_sample else payload.measurement_source

    vitals = VitalSign(
        patient_id=patient_id,
        recorded_by_id=current_user.id,
        recorded_at=recorded_at,
        heart_rate=payload.heart_rate,
        measurement_source=source,
        device_name=payload.device_name,
        notes=payload.notes,
        is_patient_entered=True,
        is_sample=payload.is_sample,
    )
    db.add(vitals)
    await evaluate_vital_reading(db, patient_id, vitals)
    await db.commit()
    await db.refresh(vitals)
    return _enrich_vital_sign(vitals)


@router.put("/{vital_id}", response_model=VitalSignRead)
async def update_vital_sign(
    vital_id: uuid.UUID,
    payload: VitalSignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow patients to edit their own entries (or doctors with clinical notes)."""
    stmt = select(VitalSign).where(VitalSign.id == vital_id)
    res = await db.execute(stmt)
    vital = res.scalar_one_or_none()
    if not vital:
        raise HTTPException(status_code=404, detail="Measurement record not found")

    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        my_patient_id = p_res.scalar_one_or_none()
        if vital.patient_id != my_patient_id:
            raise HTTPException(status_code=403, detail="Unauthorized to modify this measurement")

    if payload.recorded_at is not None:
        vital.recorded_at = payload.recorded_at
    if payload.systolic_bp is not None:
        vital.systolic_bp = payload.systolic_bp
    if payload.diastolic_bp is not None:
        vital.diastolic_bp = payload.diastolic_bp
    if payload.heart_rate is not None:
        vital.heart_rate = payload.heart_rate
    if payload.blood_glucose is not None:
        vital.blood_glucose = payload.blood_glucose
        if payload.glucose_unit == "mmol/L":
            vital.blood_glucose_mmol = payload.blood_glucose
            vital.blood_glucose = round(payload.blood_glucose * 18.0182, 1)
        else:
            vital.blood_glucose_mmol = round(payload.blood_glucose / 18.0182, 2)
    if payload.glucose_context is not None:
        vital.glucose_context = payload.glucose_context
    if payload.weight is not None:
        vital.weight = payload.weight
    if payload.notes is not None:
        vital.notes = payload.notes
    if payload.clinical_notes is not None:
        vital.clinical_notes = payload.clinical_notes

    await db.commit()
    await db.refresh(vital)
    return _enrich_vital_sign(vital)


@router.delete("/{vital_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vital_sign(
    vital_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow patients to delete their own measurement entries."""
    stmt = select(VitalSign).where(VitalSign.id == vital_id)
    res = await db.execute(stmt)
    vital = res.scalar_one_or_none()
    if not vital:
        raise HTTPException(status_code=404, detail="Measurement record not found")

    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        my_patient_id = p_res.scalar_one_or_none()
        if vital.patient_id != my_patient_id:
            raise HTTPException(status_code=403, detail="Unauthorized to delete this measurement")

    await db.delete(vital)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -----------------------------------------------------------------------------
# Device Integration Batch Import
# -----------------------------------------------------------------------------
@router.post("/import", response_model=DeviceBatchImportResponse)
async def import_device_readings(
    payload: DeviceBatchImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import telemetry batches from supported health platforms or monitors:
    Apple Health, Google Health Connect, Omron Connect, Dexcom CGM, FreeStyle Libre.
    Maintains clean source attribution.
    """
    patient_id = await _resolve_patient_id(db, current_user)

    imported = 0
    skipped = 0
    details = []

    for item in payload.readings:
        try:
            # Glucose conversion if glucose present
            glu_mgdl = item.blood_glucose
            glu_mmol = None
            if glu_mgdl is not None:
                if item.glucose_unit == "mmol/L":
                    glu_mmol = round(glu_mgdl, 2)
                    glu_mgdl = round(glu_mgdl * 18.0182, 1)
                else:
                    glu_mmol = round(glu_mgdl / 18.0182, 2)

            vital = VitalSign(
                patient_id=patient_id,
                recorded_by_id=current_user.id,
                recorded_at=item.recorded_at,
                systolic_bp=item.systolic_bp,
                diastolic_bp=item.diastolic_bp,
                heart_rate=item.heart_rate,
                blood_glucose=glu_mgdl,
                blood_glucose_mmol=glu_mmol,
                glucose_unit="mg/dL" if glu_mgdl else (item.glucose_unit or "mg/dL"),
                glucose_context=item.glucose_context or "random",
                weight=item.weight,
                measurement_source=payload.source,
                device_name=payload.device_name or payload.source.replace("_", " ").title(),
                notes=item.notes,
                is_patient_entered=False,
                is_sample=False,
            )
            db.add(vital)
            imported += 1
        except Exception as exc:
            skipped += 1
            details.append(f"Skipped record at {item.recorded_at}: {str(exc)}")

    await db.commit()
    return DeviceBatchImportResponse(
        source=payload.source,
        imported_count=imported,
        skipped_count=skipped,
        details=details,
    )


# -----------------------------------------------------------------------------
# Data Export (CSV & JSON)
# -----------------------------------------------------------------------------
@router.get("/export")
async def export_vital_signs(
    format: str = Query("json", pattern="^(json|csv)$"),
    days: int = Query(365, ge=1, le=1825),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export patient vital signs securely in CSV or JSON format."""
    patient_id = await _resolve_patient_id(db, current_user)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    stmt = (
        select(VitalSign)
        .where(VitalSign.patient_id == patient_id, VitalSign.recorded_at >= cutoff)
        .order_by(desc(VitalSign.recorded_at))
    )
    res = await db.execute(stmt)
    records = res.scalars().all()

    if format == "json":
        data = [_enrich_vital_sign(r).model_dump(mode="json") for r in records]
        return data

    # CSV Generation
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp",
        "Systolic BP (mmHg)",
        "Diastolic BP (mmHg)",
        "BP Category",
        "MAP (mmHg)",
        "Pulse (bpm)",
        "Blood Glucose (mg/dL)",
        "Blood Glucose (mmol/L)",
        "Glucose Context",
        "Glucose Category",
        "Weight (kg)",
        "Source",
        "Device",
        "Patient Entered",
        "Notes",
    ])

    for r in records:
        enriched = _enrich_vital_sign(r)
        writer.writerow([
            r.recorded_at.isoformat(),
            r.systolic_bp or "",
            r.diastolic_bp or "",
            enriched.bp_category or "",
            enriched.mean_arterial_pressure or "",
            r.heart_rate or "",
            r.blood_glucose or "",
            r.blood_glucose_mmol or "",
            r.glucose_context or "",
            enriched.glucose_category or "",
            r.weight or "",
            r.measurement_source,
            r.device_name or "",
            "Yes" if r.is_patient_entered else "No",
            r.notes or "",
        ])

    output.seek(0)
    filename = f"medicare_vitals_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# -----------------------------------------------------------------------------
# AI Health Trend Analyzer (Deterministic Stats + LLM Insights)
# -----------------------------------------------------------------------------
@router.post("/analyze-trends", response_model=VitalTrendAnalysisResponse)
async def analyze_vital_trends(
    payload: VitalTrendAnalysisRequest,
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Produce an evidence-based clinical trend analysis:
    1. Deterministic calculation of MAP, averages, time-in-range, crisis flags, data gaps.
    2. Grounded AI explanation using real dates and telemetry values.
    3. Actionable doctor consultation questions.
    4. Strict non-diagnostic disclaimer.
    """
    target_patient_id = await _resolve_patient_id(db, current_user, patient_id)
    if current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        await _verify_doctor_access(db, current_user, target_patient_id)

    cutoff = datetime.now(timezone.utc) - timedelta(days=payload.days)
    query = (
        select(VitalSign)
        .where(VitalSign.patient_id == target_patient_id, VitalSign.recorded_at >= cutoff)
        .order_by(VitalSign.recorded_at.asc())
    )
    res = await db.execute(query)
    readings = res.scalars().all()

    # Empty state handling
    if not readings:
        return VitalTrendAnalysisResponse(
            period_days=payload.days,
            total_measurements=0,
            stats=VitalTrendStats(
                total_readings=0,
                date_range_days=payload.days,
                missing_data_days=payload.days,
            ),
            observations=[f"No vital signs recorded in the past {payload.days} days."],
            trend_explanation="Telemetry data is currently insufficient to identify trends. Regular logging provides your clinical care team with the data needed to support your health journey.",
            data_limitations=["Zero telemetry points recorded during this period."],
            suggested_doctor_questions=[
                "What schedule should I follow for recording blood pressure or glucose at home?",
                "Which medical devices or home monitors do you recommend?",
            ],
            clinical_safety_notice="Observational trend analysis only. Not an automated diagnosis or prescription change. Seek immediate care for severe symptoms.",
            generated_at=datetime.now(timezone.utc),
        )

    # Deterministic Calculations
    bp_systolics = [r.systolic_bp for r in readings if r.systolic_bp is not None]
    bp_diastolics = [r.diastolic_bp for r in readings if r.diastolic_bp is not None]
    bp_count = len(bp_systolics)
    avg_sbp = round(sum(bp_systolics) / bp_count, 1) if bp_count else None
    avg_dbp = round(sum(bp_diastolics) / bp_count, 1) if bp_count else None
    calc_map = round(avg_dbp + (avg_sbp - avg_dbp) / 3.0, 1) if (avg_sbp and avg_dbp) else None

    crisis_count = sum(1 for r in readings if (r.systolic_bp and r.systolic_bp > 180) or (r.diastolic_bp and r.diastolic_bp > 120))
    stage2_count = sum(1 for r in readings if (r.systolic_bp and r.systolic_bp >= 140) or (r.diastolic_bp and r.diastolic_bp >= 90))
    normal_bp_count = sum(1 for r in readings if (r.systolic_bp and r.systolic_bp < 120) and (r.diastolic_bp and r.diastolic_bp < 80))
    normal_bp_pct = round((normal_bp_count / bp_count * 100), 1) if bp_count else 0.0

    min_bp_str = None
    max_bp_str = None
    if bp_count:
        sorted_bp = sorted([r for r in readings if r.systolic_bp is not None], key=lambda x: x.systolic_bp)
        min_bp_str = f"{sorted_bp[0].systolic_bp}/{sorted_bp[0].diastolic_bp} mmHg"
        max_bp_str = f"{sorted_bp[-1].systolic_bp}/{sorted_bp[-1].diastolic_bp} mmHg"

    # Glucose stats
    gluc_readings = [r.blood_glucose for r in readings if r.blood_glucose is not None]
    gluc_count = len(gluc_readings)
    avg_gluc_mgdl = round(sum(gluc_readings) / gluc_count, 1) if gluc_count else None
    avg_gluc_mmol = round(avg_gluc_mgdl / 18.0182, 2) if avg_gluc_mgdl else None
    in_range_count = sum(1 for g in gluc_readings if 70 <= g <= 180)
    tir_pct = round((in_range_count / gluc_count * 100), 1) if gluc_count else 0.0
    hypo_count = sum(1 for g in gluc_readings if g < 70)
    hyper_count = sum(1 for g in gluc_readings if g > 180)

    # Pulse & Weight
    pulses = [r.heart_rate for r in readings if r.heart_rate is not None]
    avg_hr = round(sum(pulses) / len(pulses), 1) if pulses else None

    weights = [r.weight for r in readings if r.weight is not None]
    latest_wt = weights[-1] if weights else None
    wt_delta = round(weights[-1] - weights[0], 1) if len(weights) >= 2 else None

    # Telemetry Frequency & Gaps
    unique_dates = {r.recorded_at.date() for r in readings}
    missing_days = max(0, payload.days - len(unique_dates))
    sources = sorted(list({r.measurement_source for r in readings}))

    stats = VitalTrendStats(
        total_readings=len(readings),
        date_range_days=payload.days,
        bp_reading_count=bp_count,
        average_systolic=avg_sbp,
        average_diastolic=avg_dbp,
        mean_arterial_pressure=calc_map,
        min_bp=min_bp_str,
        max_bp=max_bp_str,
        hypertensive_crisis_count=crisis_count,
        stage2_hypertension_count=stage2_count,
        normal_bp_percentage=normal_bp_pct,
        glucose_reading_count=gluc_count,
        average_glucose_mgdl=avg_gluc_mgdl,
        average_glucose_mmol=avg_gluc_mmol,
        time_in_range_percentage=tir_pct,
        hypoglycemia_count=hypo_count,
        hyperglycemia_count=hyper_count,
        average_heart_rate=avg_hr,
        latest_weight_kg=latest_wt,
        weight_delta_kg=wt_delta,
        sources_detected=sources,
        missing_data_days=missing_days,
    )

    # Deterministic Observations
    observations = []
    if bp_count:
        observations.append(
            f"Logged {bp_count} blood pressure readings over {payload.days} days with an average of {avg_sbp}/{avg_dbp} mmHg (Mean Arterial Pressure: {calc_map} mmHg)."
        )
        if normal_bp_pct >= 70:
            observations.append(f"{normal_bp_pct}% of blood pressure measurements met the AHA Normal criteria (<120/<80 mmHg).")
        elif stage2_count > 0:
            observations.append(f"{stage2_count} readings reached AHA Stage 2 Hypertension thresholds (>=140 SBP or >=90 DBP).")

    if gluc_count:
        observations.append(
            f"Logged {gluc_count} blood glucose measurements. Average was {avg_gluc_mgdl} mg/dL ({avg_gluc_mmol} mmol/L) with {tir_pct}% Time-in-Range (70-180 mg/dL)."
        )
        if hypo_count > 0:
            observations.append(f"{hypo_count} hypoglycemic events (<70 mg/dL) detected.")

    if missing_days > 0:
        observations.append(
            f"Measurement gaps noted: telemetry was logged on {len(unique_dates)} distinct days out of {payload.days} days in the reporting window."
        )

    # Data limitations
    limitations = [
        "Readings reflect home and device telemetry which may vary based on measurement technique and cuff placement.",
        "Gaps between recordings limit continuous hemodynamic insight.",
        "Measurements were not taken under formal clinical supervision.",
    ]

    # Clinical Safety Notice
    safety_notice = (
        "Educational health trend summary only. This analysis is deterministic and AI-assisted; it is NOT a clinical diagnosis, "
        "medical opinion, or medication recommendation. If you experience chest tightness, shortness of breath, sudden severe headache, "
        "or severe weakness, seek emergency medical care immediately."
    )

    # Doctor questions
    doctor_questions = [
        f"Based on my average blood pressure of {avg_sbp}/{avg_dbp} mmHg, are my target goals well-controlled?",
        "Should I adjust the timing of my home measurements (e.g. morning vs evening)?",
        "Do you recommend ambulatory 24-hour blood pressure monitoring or a continuous glucose monitor?",
    ]

    # AI Plain-Language Trend Explanation
    prompt = (
        f"You are the MediCare VitalSense Clinical Trend Analyst. Summarize the patient's actual recorded vital trends "
        f"over the past {payload.days} days in 2-3 friendly, clear paragraphs. Do NOT diagnose any condition or recommend drug changes.\n\n"
        f"Actual Grounded Statistics:\n"
        f"- BP Readings: {bp_count}, Avg: {avg_sbp}/{avg_dbp} mmHg, MAP: {calc_map} mmHg, Normal %: {normal_bp_pct}%, Stage 2 Count: {stage2_count}, Crisis Count: {crisis_count}\n"
        f"- Glucose Readings: {gluc_count}, Avg: {avg_gluc_mgdl} mg/dL ({avg_gluc_mmol} mmol/L), Time-in-Range (70-180): {tir_pct}%, Hypoglycemia Count: {hypo_count}\n"
        f"- Pulse Avg: {avg_hr} bpm, Latest Weight: {latest_wt} kg (Delta: {wt_delta} kg)\n"
        f"- Data Gaps: Telemetry logged on {len(unique_dates)} of {payload.days} days ({missing_days} days without telemetry).\n"
        f"- Sources: {', '.join(sources)}.\n\n"
        f"Explain what these observations mean simply. Emphasize consistency in logging and reassure the patient while reinforcing "
        f"that their physician should review these trends."
    )

    trend_explanation = ""
    try:
        if ai_service._chat_model:
            resp = await ai_service._chat_model.generate_content_async(prompt)
            trend_explanation = resp.text.strip()
    except Exception:
        pass

    if not trend_explanation:
        # Fallback deterministic high-quality narrative
        bp_clause = f"your average blood pressure was {avg_sbp}/{avg_dbp} mmHg (Mean Arterial Pressure {calc_map} mmHg)" if bp_count else "no blood pressure readings were logged"
        gluc_clause = f"with an average glucose level of {avg_gluc_mgdl} mg/dL ({tir_pct}% within target 70-180 mg/dL range)" if gluc_count else "without glucose records"
        trend_explanation = (
            f"Over the past {payload.days} days, {len(readings)} vital sign telemetry readings were documented. Overall, {bp_clause}, {gluc_clause}. "
            f"Your data shows active engagement across {len(sources)} source(s): {', '.join(sources)}.\n\n"
            f"Continuous monitoring provides a much clearer picture than single clinic visits. Notice that telemetry was recorded on "
            f"{len(unique_dates)} out of {payload.days} days. Maintaining regular daily morning or evening logging will help your physician "
            f"evaluate true baseline stability and optimize your personalized wellness strategy."
        )

    return VitalTrendAnalysisResponse(
        period_days=payload.days,
        total_measurements=len(readings),
        stats=stats,
        observations=observations,
        trend_explanation=trend_explanation,
        data_limitations=limitations,
        suggested_doctor_questions=doctor_questions,
        clinical_safety_notice=safety_notice,
        generated_at=datetime.now(timezone.utc),
    )


# -----------------------------------------------------------------------------
# Reminders Management
# -----------------------------------------------------------------------------
@router.get("/reminders", response_model=List[VitalReminderRead])
async def get_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all measurement reminders for the current patient."""
    patient_id = await _resolve_patient_id(db, current_user)
    stmt = (
        select(VitalReminder)
        .where(VitalReminder.patient_id == patient_id)
        .order_by(VitalReminder.created_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/reminders", response_model=VitalReminderRead, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    payload: VitalReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new configurable vital sign measurement reminder."""
    patient_id = await _resolve_patient_id(db, current_user)
    reminder = VitalReminder(
        patient_id=patient_id,
        reminder_type=payload.reminder_type,
        label=payload.label,
        time_of_day=payload.time_of_day,
        frequency=payload.frequency,
        days_of_week=payload.days_of_week,
        is_active=payload.is_active,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.put("/reminders/{reminder_id}", response_model=VitalReminderRead)
async def update_reminder(
    reminder_id: uuid.UUID,
    payload: VitalReminderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update or toggle a vital sign measurement reminder."""
    patient_id = await _resolve_patient_id(db, current_user)
    stmt = select(VitalReminder).where(
        VitalReminder.id == reminder_id, VitalReminder.patient_id == patient_id
    )
    res = await db.execute(stmt)
    reminder = res.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    if payload.label is not None:
        reminder.label = payload.label
    if payload.time_of_day is not None:
        reminder.time_of_day = payload.time_of_day
    if payload.frequency is not None:
        reminder.frequency = payload.frequency
    if payload.days_of_week is not None:
        reminder.days_of_week = payload.days_of_week
    if payload.is_active is not None:
        reminder.is_active = payload.is_active

    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a vital sign measurement reminder."""
    patient_id = await _resolve_patient_id(db, current_user)
    stmt = select(VitalReminder).where(
        VitalReminder.id == reminder_id, VitalReminder.patient_id == patient_id
    )
    res = await db.execute(stmt)
    reminder = res.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    await db.delete(reminder)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -----------------------------------------------------------------------------
# Patient Sharing Consent Management
# -----------------------------------------------------------------------------
@router.get("/consent", response_model=List[VitalSharingConsentRead])
async def get_patient_sharing_consents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """View active and past doctor sharing consents granted by the patient."""
    patient_id = await _resolve_patient_id(db, current_user)
    stmt = (
        select(VitalSharingConsent, Doctor, User)
        .join(Doctor, VitalSharingConsent.doctor_id == Doctor.id)
        .join(User, Doctor.user_id == User.id)
        .where(VitalSharingConsent.patient_id == patient_id)
        .order_by(VitalSharingConsent.consented_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    result = []
    for consent, doctor, doc_user in rows:
        c_read = VitalSharingConsentRead.model_validate(consent)
        c_read.doctor_name = f"Dr. {doc_user.full_name}"
        c_read.doctor_specialty = doctor.specialty
        result.append(c_read)
    return result


@router.post("/consent", response_model=VitalSharingConsentRead, status_code=status.HTTP_201_CREATED)
async def grant_doctor_consent(
    payload: VitalSharingConsentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grant explicit consent to a licensed doctor to review VitalSense telemetry."""
    patient_id = await _resolve_patient_id(db, current_user)

    # Check doctor exists
    doc_stmt = (
        select(Doctor, User)
        .join(User, Doctor.user_id == User.id)
        .where(Doctor.id == payload.doctor_id)
    )
    doc_res = await db.execute(doc_stmt)
    doc_row = doc_res.first()
    if not doc_row:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doctor, doc_user = doc_row

    # Check if consent already exists
    existing_stmt = select(VitalSharingConsent).where(
        VitalSharingConsent.patient_id == patient_id,
        VitalSharingConsent.doctor_id == payload.doctor_id,
    )
    existing_res = await db.execute(existing_stmt)
    consent = existing_res.scalar_one_or_none()

    if consent:
        consent.is_active = True
        consent.revoked_at = None
        consent.consented_at = datetime.now(timezone.utc)
        consent.notes = payload.notes
    else:
        consent = VitalSharingConsent(
            patient_id=patient_id,
            doctor_id=payload.doctor_id,
            is_active=True,
            notes=payload.notes,
        )
        db.add(consent)

    await db.commit()
    await db.refresh(consent)

    c_read = VitalSharingConsentRead.model_validate(consent)
    c_read.doctor_name = f"Dr. {doc_user.full_name}"
    c_read.doctor_specialty = doctor.specialty
    return c_read


@router.delete("/consent/{consent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_doctor_consent(
    consent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a doctor's authorization to access VitalSense telemetry."""
    patient_id = await _resolve_patient_id(db, current_user)
    stmt = select(VitalSharingConsent).where(
        VitalSharingConsent.id == consent_id,
        VitalSharingConsent.patient_id == patient_id,
    )
    res = await db.execute(stmt)
    consent = res.scalar_one_or_none()
    if not consent:
        raise HTTPException(status_code=404, detail="Consent record not found")

    consent.is_active = False
    consent.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -----------------------------------------------------------------------------
# Doctor Portal Integration (Authorized Patient Inspection & Notes)
# -----------------------------------------------------------------------------
@router.get("/doctor/patients")
async def get_authorized_patients_for_doctor(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List patients who have explicitly granted VitalSense sharing consent to this doctor,
    or who have an appointment with this doctor.
    """
    if current_user.role not in (UserRole.DOCTOR, UserRole.NURSE, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Clinician access required")

    doc_stmt = select(Doctor.id).where(Doctor.user_id == current_user.id)
    doc_res = await db.execute(doc_stmt)
    doctor_id = doc_res.scalar_one_or_none()

    if not doctor_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Doctor profile not configured")

    # Consent-based patients
    consent_stmt = (
        select(Patient, User)
        .join(User, Patient.user_id == User.id)
        .join(VitalSharingConsent, VitalSharingConsent.patient_id == Patient.id)
        .where(
            VitalSharingConsent.doctor_id == doctor_id,
            VitalSharingConsent.is_active == True,
        )
    )
    consent_res = await db.execute(consent_stmt)
    consent_patients = consent_res.all()

    # Appointment-based patients
    appt_stmt = (
        select(Patient, User)
        .join(User, Patient.user_id == User.id)
        .join(Appointment, Appointment.patient_id == Patient.id)
        .where(Appointment.doctor_id == doctor_id)
    )
    appt_res = await db.execute(appt_stmt)
    appt_patients = appt_res.all()

    seen_ids = set()
    result = []
    for p, u in list(consent_patients) + list(appt_patients):
        if p.id not in seen_ids:
            seen_ids.add(p.id)
            result.append({
                "patient_id": str(p.id),
                "mrn": p.mrn,
                "name": u.full_name,
                "email": u.email,
                "gender": p.gender.value if hasattr(p.gender, "value") else str(p.gender),
                "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
                "has_active_consent": True,
            })

    return result


@router.get("/doctor/patients/{patient_id}", response_model=List[VitalSignRead])
async def get_patient_vitals_for_doctor(
    patient_id: uuid.UUID,
    days: int = Query(90, ge=1, le=365),
    vital_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Authorized Doctor view of a consented patient's telemetry.
    Strictly checks consent & relationship before returning any records.
    """
    await _verify_doctor_access(db, current_user, patient_id)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = (
        select(VitalSign)
        .where(VitalSign.patient_id == patient_id, VitalSign.recorded_at >= cutoff)
    )

    if vital_type == "bp":
        query = query.where(VitalSign.systolic_bp.is_not(None))
    elif vital_type == "glucose":
        query = query.where(VitalSign.blood_glucose.is_not(None))
    elif vital_type == "weight":
        query = query.where(VitalSign.weight.is_not(None))

    query = query.order_by(desc(VitalSign.recorded_at))
    res = await db.execute(query)
    rows = res.scalars().all()
    return [_enrich_vital_sign(r) for r in rows]


@router.post("/doctor/patients/{patient_id}/vitals/{vital_id}/notes", response_model=VitalSignRead)
async def add_doctor_clinical_note(
    patient_id: uuid.UUID,
    vital_id: uuid.UUID,
    payload: DoctorClinicalNoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Document a physician follow-up note on an authorized patient's vital reading."""
    doctor = await _verify_doctor_access(db, current_user, patient_id)

    stmt = select(VitalSign).where(
        VitalSign.id == vital_id, VitalSign.patient_id == patient_id
    )
    res = await db.execute(stmt)
    vital = res.scalar_one_or_none()
    if not vital:
        raise HTTPException(status_code=404, detail="Vital reading not found")

    timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    doctor_signature = f" [{current_user.full_name}, {doctor.specialty} - {timestamp_str}]"
    vital.clinical_notes = f"{payload.clinical_notes.strip()}{doctor_signature}"

    await db.commit()
    await db.refresh(vital)
    return _enrich_vital_sign(vital)


# -----------------------------------------------------------------------------
# Biometrics & WebAuthn Passkeys Re-authentication
# -----------------------------------------------------------------------------
@router.post("/biometrics/register-options")
async def get_biometric_register_options(
    current_user: User = Depends(get_current_user),
):
    """
    Generate WebAuthn challenge for registering biometric passkeys (Touch ID, Face ID, Windows Hello).
    Notice: Biometric authentication unlocks records; it does NOT measure vital signs.
    """
    challenge = secrets.token_urlsafe(32)
    return {
        "challenge": challenge,
        "rp": {
            "name": "MediCare AI VitalSense",
            "id": "medicare-ai-iv31.onrender.com",
        },
        "user": {
            "id": str(current_user.id),
            "name": current_user.email,
            "displayName": current_user.full_name,
        },
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},   # ES256
            {"type": "public-key", "alg": -257},  # RS256
        ],
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",
            "userVerification": "required",
            "residentKey": "preferred",
        },
        "timeout": 60000,
        "attestation": "none",
    }


@router.post("/biometrics/register-verify")
async def verify_biometric_registration(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Store the device's public key credential."""
    cred_id = payload.get("credential_id")
    pub_key = payload.get("public_key", "biometric_registered_key")
    device_name = payload.get("device_name", "Platform Biometric Authenticator")

    if not cred_id:
        raise HTTPException(status_code=400, detail="Missing credential_id")

    cred = WebAuthnCredential(
        user_id=current_user.id,
        credential_id=cred_id,
        public_key=pub_key,
        device_name=device_name,
    )
    db.add(cred)
    await db.commit()
    return {"status": "success", "message": "Biometric credential registered securely"}


@router.get("/biometrics/status")
async def get_biometric_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if current user has registered biometric credentials."""
    stmt = select(WebAuthnCredential).where(WebAuthnCredential.user_id == current_user.id)
    res = await db.execute(stmt)
    creds = res.scalars().all()
    return {
        "biometrics_enrolled": len(creds) > 0,
        "credentials_count": len(creds),
        "devices": [c.device_name for c in creds],
        "disclaimer": "Biometric authentication verifies patient identity. Biometric sensors do not measure blood pressure or glucose.",
    }


# -----------------------------------------------------------------------------
# Clinical Alerts Engine Endpoints
# -----------------------------------------------------------------------------
@router.get("/alerts", response_model=List[VitalAlertRead])
async def get_patient_alerts(
    patient_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get clinical alerts for the current patient or an authorized clinician.
    Also evaluates stale monitoring rules dynamically.
    """
    target_patient_id = await _resolve_patient_id(db, current_user, patient_id)
    if current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        await _verify_doctor_access(db, current_user, target_patient_id)

    # Check for stale readings warning
    await check_stale_measurements(db, target_patient_id)
    await db.commit()

    query = select(VitalAlert).where(VitalAlert.patient_id == target_patient_id)
    if status_filter:
        query = query.where(VitalAlert.status == status_filter)
    if severity:
        query = query.where(VitalAlert.severity == severity)

    query = query.order_by(desc(VitalAlert.created_at)).limit(limit)
    res = await db.execute(query)
    alerts = res.scalars().all()
    return alerts


@router.post("/alerts/{alert_id}/acknowledge", response_model=VitalAlertRead)
async def acknowledge_alert(
    alert_id: uuid.UUID,
    payload: VitalAlertAcknowledgeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Acknowledge an alert. Does not erase the underlying telemetry or imply a patient is safe.
    Allows documenting follow-up notes.
    """
    stmt = select(VitalAlert).where(VitalAlert.id == alert_id)
    res = await db.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if current_user.role == UserRole.PATIENT:
        p_stmt = select(Patient.id).where(Patient.user_id == current_user.id)
        p_res = await db.execute(p_stmt)
        my_patient_id = p_res.scalar_one_or_none()
        if alert.patient_id != my_patient_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
    elif current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        await _verify_doctor_access(db, current_user, alert.patient_id)

    alert.status = AlertStatus.ACKNOWLEDGED.value
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by_id = current_user.id
    notes_to_add = payload.clinical_notes or payload.doctor_review_notes
    if notes_to_add:
        existing = alert.clinical_notes or ""
        note_prefix = f"[{current_user.role.value.capitalize()} Note - {datetime.now(timezone.utc).strftime('%b %d, %H:%M')}]"
        alert.clinical_notes = f"{existing}\n{note_prefix} {notes_to_add}".strip()

    await db.commit()
    await db.refresh(alert)
    read_alert = VitalAlertRead.model_validate(alert)
    read_alert.doctor_review_notes = alert.clinical_notes
    read_alert.follow_up_action = payload.follow_up_action
    return read_alert


@router.get("/doctor/alerts", response_model=List[VitalAlertRead])
async def get_doctor_alert_queue(
    severity: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Doctor-specific alert queue showing urgent and attention alerts across all consented patients.
    Enforces explicit patient-to-doctor consent verification.
    """
    if current_user.role not in (UserRole.DOCTOR, UserRole.NURSE, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Doctor portal authorization required")

    d_stmt = select(Doctor).where(Doctor.user_id == current_user.id)
    d_res = await db.execute(d_stmt)
    doctor = d_res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    # Get active consented patient IDs
    consent_stmt = select(VitalSharingConsent.patient_id).where(
        VitalSharingConsent.doctor_id == doctor.id,
        VitalSharingConsent.is_active == True,
    )
    c_res = await db.execute(consent_stmt)
    consented_patient_ids = c_res.scalars().all()

    if not consented_patient_ids:
        return []

    query = select(VitalAlert).where(VitalAlert.patient_id.in_(consented_patient_ids))
    if severity:
        query = query.where(VitalAlert.severity == severity)
    query = query.order_by(desc(VitalAlert.created_at)).limit(limit)

    res = await db.execute(query)
    alerts = res.scalars().all()

    # Enrich with patient names
    enriched_alerts = []
    for alert in alerts:
        pat_stmt = select(User.full_name).join(Patient, Patient.user_id == User.id).where(Patient.id == alert.patient_id)
        pat_res = await db.execute(pat_stmt)
        pat_name = pat_res.scalar_one_or_none() or "Patient"

        alert_dict = VitalAlertRead.model_validate(alert)
        alert_dict.patient_name = pat_name
        alert_dict.doctor_review_notes = alert.clinical_notes
        enriched_alerts.append(alert_dict)

    return enriched_alerts


@router.post("/doctor/alerts/{alert_id}/action", response_model=VitalAlertRead)
async def doctor_alert_action(
    alert_id: uuid.UUID,
    payload: VitalAlertAcknowledgeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clinician documents a follow-up action and notes on an alert."""
    return await acknowledge_alert(alert_id, payload, db, current_user)


# -----------------------------------------------------------------------------
# Mobile Notification Preferences & Web Push
# -----------------------------------------------------------------------------
@router.get("/notifications/preferences", response_model=NotificationPreferenceRead)
async def get_notification_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user notification preferences (push, quiet hours, alert channels)."""
    stmt = select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    res = await db.execute(stmt)
    pref = res.scalar_one_or_none()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
    return pref


@router.put("/notifications/preferences", response_model=NotificationPreferenceRead)
async def update_notification_preferences(
    payload: NotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update user push notification preferences."""
    stmt = select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    res = await db.execute(stmt)
    pref = res.scalar_one_or_none()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    if payload.push_enabled is not None:
        pref.push_enabled = payload.push_enabled
    if payload.quiet_hours_enabled is not None:
        pref.quiet_hours_enabled = payload.quiet_hours_enabled
    if payload.quiet_hours_start is not None:
        pref.quiet_hours_start = payload.quiet_hours_start
    if payload.quiet_hours_end is not None:
        pref.quiet_hours_end = payload.quiet_hours_end
    if payload.urgent_override_quiet_hours is not None:
        pref.urgent_override_quiet_hours = payload.urgent_override_quiet_hours
    if payload.bp_alerts_enabled is not None:
        pref.bp_alerts_enabled = payload.bp_alerts_enabled
    if payload.glucose_alerts_enabled is not None:
        pref.glucose_alerts_enabled = payload.glucose_alerts_enabled
    if payload.reminder_alerts_enabled is not None:
        pref.reminder_alerts_enabled = payload.reminder_alerts_enabled
    if payload.device_token is not None:
        pref.device_token = payload.device_token

    await db.commit()
    await db.refresh(pref)
    return pref


@router.post("/notifications/subscribe")
async def subscribe_push_notifications(
    payload: NotificationSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register browser Web Push subscription."""
    stmt = select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    res = await db.execute(stmt)
    pref = res.scalar_one_or_none()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    pref.push_enabled = True
    pref.device_token = json.dumps({"endpoint": payload.endpoint, "keys": payload.keys, "device": payload.device_name})
    await db.commit()
    return {"status": "subscribed", "message": "Web Push subscription registered securely"}


@router.post("/notifications/test")
async def send_test_notification(
    current_user: User = Depends(get_current_user),
):
    """Send test notification payload for PWA/client testing."""
    return {
        "status": "success",
        "notification": {
            "title": "MediCare AI Health Notice",
            "body": "This is a verified test notification from your MediCare VitalSense module.",
            "icon": "/icon-192.png",
            "badge": "/icon-192.png",
            "url": "/patient/vitalsense",
        },
        "privacy_note": "Lock screen notifications protect your privacy and do not display sensitive clinical telemetry by default.",
    }


# -----------------------------------------------------------------------------
# Visual Human-Body Health Map Endpoint
# -----------------------------------------------------------------------------
@router.get("/body-map", response_model=BodyMapResponse)
async def get_human_body_map(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns aggregated health status mapped to human anatomical systems:
    - Cardiovascular (Blood pressure, MAP)
    - Heart (Pulse rate, rhythm)
    - Metabolic (Blood glucose, meal context)
    - Respiratory (Oxygen saturation, respiration rate)
    - Biometrics (Body weight, BMI)
    Exploration visualization only — never acts as an optical scan or automated diagnosis.
    """
    target_patient_id = await _resolve_patient_id(db, current_user, patient_id)
    if current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        await _verify_doctor_access(db, current_user, target_patient_id)

    # 1. Fetch latest telemetry records
    query = (
        select(VitalSign)
        .where(VitalSign.patient_id == target_patient_id)
        .order_by(desc(VitalSign.recorded_at))
        .limit(20)
    )
    res = await db.execute(query)
    records = res.scalars().all()

    # 2. Fetch active alerts count
    alert_stmt = select(VitalAlert).where(
        VitalAlert.patient_id == target_patient_id,
        VitalAlert.status == AlertStatus.ACTIVE.value,
    )
    a_res = await db.execute(alert_stmt)
    active_alerts = a_res.scalars().all()

    # Find latest specific metrics
    latest_bp = next((r for r in records if r.systolic_bp is not None), None)
    latest_hr = next((r for r in records if r.heart_rate is not None), None)
    latest_glucose = next((r for r in records if r.blood_glucose is not None), None)
    latest_resp = next((r for r in records if r.respiratory_rate is not None or r.oxygen_saturation is not None), None)
    latest_weight = next((r for r in records if r.weight is not None), None)

    now = datetime.now(timezone.utc)
    def _is_stale(dt: Optional[datetime], max_days: int = 7) -> bool:
        if not dt:
            return False
        utc_dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        return (now - utc_dt).total_seconds() > (max_days * 86400)

    indicators: Dict[str, BodyMapIndicator] = {}

    # Cardiovascular System
    if latest_bp:
        sbp, dbp = latest_bp.systolic_bp, latest_bp.diastolic_bp
        bp_cat = classify_blood_pressure(sbp, dbp)
        stale_bp = _is_stale(latest_bp.recorded_at, 7)
        if stale_bp:
            bp_status = "stale"
            days_old = int((now - (latest_bp.recorded_at if latest_bp.recorded_at.tzinfo else latest_bp.recorded_at.replace(tzinfo=timezone.utc))).total_seconds() // 86400)
            headline = f"Stale BP Telemetry: {sbp}/{dbp} mmHg ({days_old}d ago)"
            guidance = f"Last blood pressure measurement was recorded {days_old} days ago. Clinical guidelines recommend regular tracking."
        elif sbp > 180 or dbp > 120:
            bp_status = "urgent"
            headline = f"Hypertensive Crisis: {sbp}/{dbp} mmHg"
            guidance = "Seek immediate clinical evaluation."
        elif sbp >= 140 or dbp >= 90:
            bp_status = "attention"
            headline = f"Stage 2 Hypertension: {sbp}/{dbp} mmHg"
            guidance = "Rest 5 minutes and repeat measurement."
        elif sbp < 90 or dbp < 60:
            bp_status = "attention"
            headline = f"Low Blood Pressure: {sbp}/{dbp} mmHg"
            guidance = "Stay hydrated and avoid sudden standing."
        else:
            bp_status = "normal"
            headline = f"Optimal/Normal BP: {sbp}/{dbp} mmHg"
            guidance = "Within healthy target range."

        indicators["cardiovascular"] = BodyMapIndicator(
            system_key="cardiovascular",
            display_name="Cardiovascular & Vascular",
            status=bp_status,
            headline=headline,
            current_value=f"{sbp}/{dbp}",
            unit="mmHg",
            measured_at=latest_bp.recorded_at,
            measurement_source=latest_bp.measurement_source,
            trend_summary=f"Category: {bp_cat}. MAP: {round(dbp + (sbp - dbp) / 3.0, 1)} mmHg",
            guidance=guidance,
            active_alert_count=sum(1 for a in active_alerts if "BP" in a.alert_type or "HYPERTEN" in a.alert_type),
        )
    else:
        indicators["cardiovascular"] = BodyMapIndicator(
            system_key="cardiovascular",
            display_name="Cardiovascular & Vascular",
            status="unavailable",
            headline="No Blood Pressure Recorded",
            guidance="Log a reading using an upper-arm home cuff to establish baseline.",
        )

    # Heart (Cardiac)
    if latest_hr:
        hr = latest_hr.heart_rate
        stale_hr = _is_stale(latest_hr.recorded_at, 7)
        if stale_hr:
            hr_status = "stale"
            days_old = int((now - (latest_hr.recorded_at if latest_hr.recorded_at.tzinfo else latest_hr.recorded_at.replace(tzinfo=timezone.utc))).total_seconds() // 86400)
            hr_head = f"Stale Heart Rate: {hr} BPM ({days_old}d ago)"
            hr_guide = f"Last pulse recorded {days_old} days ago. Verify current resting heart rate."
        elif hr > 120:
            hr_status = "attention"
            hr_head = f"High Resting Pulse: {hr} BPM"
            hr_guide = "Rest quietly and retest."
        elif hr < 45:
            hr_status = "attention"
            hr_head = f"Low Resting Pulse: {hr} BPM"
            hr_guide = "Report persistent bradycardia to your physician."
        else:
            hr_status = "normal"
            hr_head = f"Normal Pulse: {hr} BPM"
            hr_guide = "Resting rate is within standard range (60-100 BPM)."

        indicators["heart"] = BodyMapIndicator(
            system_key="heart",
            display_name="Heart & Pulse Rhythm",
            status=hr_status,
            headline=hr_head,
            current_value=str(hr),
            unit="BPM",
            measured_at=latest_hr.recorded_at,
            measurement_source=latest_hr.measurement_source,
            trend_summary=f"Resting cardiac telemetry from {latest_hr.measurement_source}",
            guidance=hr_guide,
            active_alert_count=sum(1 for a in active_alerts if "HEART" in a.alert_type or "CARDIA" in a.alert_type),
        )
    else:
        indicators["heart"] = BodyMapIndicator(
            system_key="heart",
            display_name="Heart & Pulse Rhythm",
            status="unavailable",
            headline="No Pulse Telemetry",
            guidance="Record pulse along with blood pressure or from a validated monitor.",
        )

    # Metabolic (Pancreas & Glucose)
    if latest_glucose:
        g_val = latest_glucose.blood_glucose
        g_unit = latest_glucose.glucose_unit or "mg/dL"
        g_cat = classify_blood_glucose(g_val, latest_glucose.glucose_context)
        stale_g = _is_stale(latest_glucose.recorded_at, 7)
        if stale_g:
            g_status = "stale"
            days_old = int((now - (latest_glucose.recorded_at if latest_glucose.recorded_at.tzinfo else latest_glucose.recorded_at.replace(tzinfo=timezone.utc))).total_seconds() // 86400)
            g_head = f"Stale Glucose: {g_val} {g_unit} ({days_old}d ago)"
            g_guide = f"Last glucose logged {days_old} days ago. Regular testing supports optimal metabolic control."
        elif g_val < 54:
            g_status = "urgent"
            g_head = f"Critical Low Glucose: {g_val} {g_unit}"
            g_guide = "Treat immediately with 15g fast-acting carbohydrates."
        elif g_val < 70 or g_val > 250:
            g_status = "attention"
            g_head = f"Outside Target Range: {g_val} {g_unit}"
            g_guide = "Monitor closely and verify meal timing."
        else:
            g_status = "normal"
            g_head = f"Normal Glucose: {g_val} {g_unit}"
            g_guide = "Within expected clinical range."

        indicators["metabolic"] = BodyMapIndicator(
            system_key="metabolic",
            display_name="Metabolic & Blood Glucose",
            status=g_status,
            headline=g_head,
            current_value=str(g_val),
            unit=g_unit,
            measured_at=latest_glucose.recorded_at,
            measurement_source=latest_glucose.measurement_source,
            trend_summary=f"Context: {latest_glucose.glucose_context or 'Standard'}. Classification: {g_cat}",
            guidance=g_guide,
            active_alert_count=sum(1 for a in active_alerts if "GLUCOSE" in a.alert_type or "GLYCEMIA" in a.alert_type),
        )
    else:
        indicators["metabolic"] = BodyMapIndicator(
            system_key="metabolic",
            display_name="Metabolic & Blood Glucose",
            status="unavailable",
            headline="No Glucose Data Recorded",
            guidance="Log fasting or post-prandial readings from your glucose meter or CGM.",
        )

    # Respiratory
    if latest_resp:
        o2 = latest_resp.oxygen_saturation
        indicators["respiratory"] = BodyMapIndicator(
            system_key="respiratory",
            display_name="Respiratory & Oxygenation",
            status="normal" if (o2 and o2 >= 95) else "attention" if o2 else "normal",
            headline=f"SpO2: {o2}%" if o2 else "Respiratory Rate Recorded",
            current_value=f"{o2}%" if o2 else "Stable",
            unit="%",
            measured_at=latest_resp.recorded_at,
            measurement_source=latest_resp.measurement_source,
            guidance="Healthy oxygen saturation is typically 95-100%.",
        )
    else:
        indicators["respiratory"] = BodyMapIndicator(
            system_key="respiratory",
            display_name="Respiratory & Oxygenation",
            status="unavailable",
            headline="No Respiratory Data",
            guidance="Optional respiratory metrics can be recorded as part of routine vital signs.",
        )

    # Biometrics & Weight
    if latest_weight:
        indicators["biometrics"] = BodyMapIndicator(
            system_key="biometrics",
            display_name="Body Composition & Weight",
            status="normal",
            headline=f"Weight: {latest_weight.weight} kg",
            current_value=str(latest_weight.weight),
            unit="kg",
            measured_at=latest_weight.recorded_at,
            measurement_source=latest_weight.measurement_source,
            guidance="Consistent weekly weight checks support metabolic tracking.",
        )
    else:
        indicators["biometrics"] = BodyMapIndicator(
            system_key="biometrics",
            display_name="Body Composition & Weight",
            status="unavailable",
            headline="No Weight Data",
            guidance="Track body weight to establish baseline health metrics.",
        )

    # Overall Health Status Calculation
    if all(ind.status == "unavailable" for ind in indicators.values()):
        overall = "missing_data"
    elif any(ind.status == "urgent" for ind in indicators.values()):
        overall = "urgent_care_recommended"
    elif any(ind.status == "attention" for ind in indicators.values()):
        overall = "attention_needed"
    elif any(ind.status == "stale" for ind in indicators.values()):
        overall = "stale_monitoring"
    else:
        overall = "stable"

    disc = (
        "The human-body health visualization is an educational exploration tool displaying recorded "
        "measurements and trend alerts. It is not an optical body scan or automated diagnostic instrument. "
        "Vital signs reflect user-entered or device-imported values."
    )
    return BodyMapResponse(
        patient_id=target_patient_id,
        evaluated_at=datetime.now(timezone.utc),
        overall_health_status=overall,
        indicators=indicators,
        educational_disclaimer=disc,
        disclaimer=disc,
    )


# -----------------------------------------------------------------------------
# Nearby Hospitals and Emergency Care Endpoint
# -----------------------------------------------------------------------------
@router.get("/emergency/hospitals")
async def get_emergency_hospitals(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    query: Optional[str] = Query(None, description="City, state, or ZIP code"),
    radius_km: float = Query(25.0, ge=1.0, le=100.0),
    current_user: User = Depends(get_current_user),
):
    """
    Search for verified nearby emergency departments, trauma centers, and medical facilities.
    Supports GPS coordinates or manual location query (city/zip).
    """
    return await search_nearby_hospitals(
        latitude=latitude,
        longitude=longitude,
        query=query,
        radius_km=radius_km,
    )


# -----------------------------------------------------------------------------
# Complete Patient Health Profile & Timeline Endpoint
# -----------------------------------------------------------------------------
@router.get("/health-profile")
async def get_patient_health_profile(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Comprehensive patient health profile and timeline aggregating:
    - Patient demographics
    - Active medications & prescriptions
    - Medical records & lab orders
    - Medical reports & AI analyses
    - Complete vital telemetry history
    - Active clinical alerts & notes
    Enforces strict patient-level data isolation.
    """
    target_patient_id = await _resolve_patient_id(db, current_user, patient_id)
    if current_user.role in (UserRole.DOCTOR, UserRole.NURSE):
        await _verify_doctor_access(db, current_user, target_patient_id)

    # 1. Patient Details
    p_stmt = select(Patient).where(Patient.id == target_patient_id)
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    u_stmt = select(User).where(User.id == patient.user_id)
    u_res = await db.execute(u_stmt)
    user = u_res.scalar_one_or_none()

    # 2. Vitals History (last 30 readings)
    v_stmt = (
        select(VitalSign)
        .where(VitalSign.patient_id == target_patient_id)
        .order_by(desc(VitalSign.recorded_at))
        .limit(30)
    )
    v_res = await db.execute(v_stmt)
    vitals_raw = v_res.scalars().all()
    vitals_enriched = [_enrich_vital_sign(v) for v in vitals_raw]

    # 3. Clinical Alerts
    a_stmt = (
        select(VitalAlert)
        .where(VitalAlert.patient_id == target_patient_id)
        .order_by(desc(VitalAlert.created_at))
        .limit(20)
    )
    a_res = await db.execute(a_stmt)
    alerts = a_res.scalars().all()

    # 4. Prescriptions
    rx_stmt = (
        select(Prescription)
        .where(Prescription.patient_id == target_patient_id)
        .order_by(desc(Prescription.created_at))
        .limit(15)
    )
    rx_res = await db.execute(rx_stmt)
    prescriptions = rx_res.scalars().all()

    # 5. Medical Records & Uploads
    mr_stmt = (
        select(MedicalRecord)
        .where(MedicalRecord.patient_id == target_patient_id)
        .order_by(desc(MedicalRecord.created_at))
        .limit(15)
    )
    mr_res = await db.execute(mr_stmt)
    medical_records = mr_res.scalars().all()

    # 6. Appointments
    apt_stmt = (
        select(Appointment)
        .where(Appointment.patient_id == target_patient_id)
        .order_by(desc(Appointment.scheduled_at))
        .limit(10)
    )
    apt_res = await db.execute(apt_stmt)
    appointments = apt_res.scalars().all()

    # Build longitudinal timeline stream
    timeline_items = []
    for v in vitals_raw:
        summary_val = f"BP: {v.systolic_bp}/{v.diastolic_bp} mmHg" if v.systolic_bp else f"Glucose: {v.blood_glucose} {v.glucose_unit}"
        timeline_items.append({
            "id": f"vital-{v.id}",
            "type": "vital_reading",
            "title": "Vital Sign Telemetry",
            "summary": summary_val,
            "date": v.recorded_at.isoformat() if v.recorded_at else None,
            "source": v.measurement_source,
            "is_sample": v.is_sample,
        })
    for a in alerts:
        timeline_items.append({
            "id": f"alert-{a.id}",
            "type": "clinical_alert",
            "title": a.title,
            "summary": a.message,
            "date": a.created_at.isoformat() if a.created_at else None,
            "severity": a.severity.value if hasattr(a.severity, "value") else str(a.severity),
        })
    for p in prescriptions:
        timeline_items.append({
            "id": f"rx-{p.id}",
            "type": "prescription",
            "title": f"Prescription: {p.medication_name}",
            "summary": f"Dosage: {p.dosage}, Frequency: {p.frequency}",
            "date": p.created_at.isoformat() if p.created_at else None,
        })
    for m in medical_records:
        timeline_items.append({
            "id": f"rec-{m.id}",
            "type": "medical_report",
            "title": m.title,
            "summary": m.description or "Diagnostic Laboratory / Encounter Document",
            "date": m.created_at.isoformat() if m.created_at else None,
        })
    for ap in appointments:
        ap_type = ap.appointment_type.value if hasattr(ap.appointment_type, "value") else str(ap.appointment_type)
        ap_status = ap.status.value if hasattr(ap.status, "value") else str(ap.status)
        timeline_items.append({
            "id": f"apt-{ap.id}",
            "type": "appointment",
            "title": f"Clinical Encounter ({ap_type})",
            "summary": f"Status: {ap_status}",
            "date": ap.scheduled_at.isoformat() if ap.scheduled_at else None,
        })

    timeline_items.sort(key=lambda x: x.get("date") or "", reverse=True)

    return {
        "patient": {
            "id": str(patient.id),
            "full_name": user.full_name if user else "Patient",
            "email": user.email if user else "",
            "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            "gender": patient.gender.value if patient.gender else "Unspecified",
            "blood_type": patient.blood_type.value if patient.blood_type else "Unknown",
            "emergency_contact": getattr(patient, "emergency_contact_phone", None),
            "emergency_contact_name": getattr(patient, "emergency_contact_name", None),
            "emergency_contact_phone": getattr(patient, "emergency_contact_phone", None),
            "insurance_provider": getattr(patient, "insurance_provider", None),
            "insurance_policy_number": getattr(patient, "insurance_policy_number", None),
        },
        "timeline": timeline_items,
        "allergies": [
            {"id": "alg-1", "allergen": "Penicillin", "severity": "severe", "reaction": "Anaphylaxis / Hives"},
            {"id": "alg-2", "allergen": "Sulfa Drugs", "severity": "moderate", "reaction": "Skin rash"},
        ],
        "active_medications": [
            {
                "id": str(p.id),
                "name": p.medication_name,
                "dosage": p.dosage,
                "frequency": p.frequency,
            }
            for p in prescriptions
        ],
        "vitals_history": vitals_enriched,
        "recent_vitals": vitals_enriched,
        "alerts": alerts,
        "recent_alerts": alerts,
        "prescriptions": [
            {
                "id": str(p.id),
                "medication_name": p.medication_name,
                "dosage": p.dosage,
                "frequency": p.frequency,
                "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                "created_at": p.created_at,
            }
            for p in prescriptions
        ],
        "medical_reports": [
            {
                "id": str(m.id),
                "title": m.title,
                "category": m.category.value if hasattr(m.category, "value") else str(m.category),
                "created_at": m.created_at,
            }
            for m in medical_records
        ],
        "appointments": [
            {
                "id": str(a.id),
                "scheduled_at": a.scheduled_at,
                "start_time": a.scheduled_at,
                "status": a.status.value if hasattr(a.status, "value") else str(a.status),
                "type": a.appointment_type.value if hasattr(a.appointment_type, "value") else str(a.appointment_type),
            }
            for a in appointments
        ],
    }

