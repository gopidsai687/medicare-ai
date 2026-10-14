"""
MediCare Clinical Alert Engine
Evaluates telemetry against documented clinical thresholds (AHA/ACC 2017 & ADA 2024 standards).
Provides deterministic evaluation, transparent clinical rules, actionable patient guidance,
and emergency contact advisories without automated prescribing or diagnostic delays.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vital_sign import AlertSeverity, AlertStatus, VitalAlert, VitalSign


async def evaluate_vital_reading(
    db: AsyncSession,
    patient_id: uuid.UUID,
    vital: VitalSign,
) -> List[VitalAlert]:
    """
    Evaluates a newly logged or imported vital sign against documented clinical rules.
    Returns any newly generated VitalAlert records.
    """
    alerts_to_create: List[VitalAlert] = []

    # 1. Blood Pressure Rules (AHA/ACC 2017)
    sbp = vital.systolic_bp
    dbp = vital.diastolic_bp

    if sbp is not None and dbp is not None:
        # Hypertensive Crisis: >180 and/or >120
        if sbp > 180 or dbp > 120:
            alerts_to_create.append(
                VitalAlert(
                    patient_id=patient_id,
                    vital_id=vital.id,
                    alert_type="HYPERTENSIVE_CRISIS",
                    severity=AlertSeverity.URGENT.value,
                    title="Critical Alert: Hypertensive Crisis Reading",
                    message=f"Blood pressure reading of {sbp}/{dbp} mmHg exceeds critical clinical safety thresholds.",
                    clinical_guidance=(
                        "Potentially urgent medical event. If accompanied by chest pain, shortness of breath, "
                        "back pain, numbness, weakness, or difficulty speaking, seek emergency medical attention "
                        "immediately (Call 911). Do not wait for AI evaluation."
                    ),
                    status=AlertStatus.ACTIVE.value,
                )
            )
        # Stage 2 Hypertension: >=140 and/or >=90
        elif sbp >= 140 or dbp >= 90:
            alerts_to_create.append(
                VitalAlert(
                    patient_id=patient_id,
                    vital_id=vital.id,
                    alert_type="HIGH_BP_STAGE2",
                    severity=AlertSeverity.ATTENTION.value,
                    title="High Blood Pressure Alert (Hypertension Stage 2)",
                    message=f"Blood pressure of {sbp}/{dbp} mmHg is elevated in Stage 2 range.",
                    clinical_guidance=(
                        "Rest quietly for 5 minutes in a seated position with back supported and repeat the measurement. "
                        "If consecutive measurements remain in this range, contact your healthcare provider for evaluation."
                    ),
                    status=AlertStatus.ACTIVE.value,
                )
            )
        # Hypotension: <90 or <60
        elif sbp < 90 or dbp < 60:
            alerts_to_create.append(
                VitalAlert(
                    patient_id=patient_id,
                    vital_id=vital.id,
                    alert_type="LOW_BP",
                    severity=AlertSeverity.ATTENTION.value,
                    title="Low Blood Pressure Alert (Hypotension)",
                    message=f"Blood pressure of {sbp}/{dbp} mmHg is below the standard normal range.",
                    clinical_guidance=(
                        "If experiencing dizziness, lightheadedness, or blurred vision, sit or lie down with legs elevated. "
                        "Drink fluids and consult your healthcare professional if symptoms persist."
                    ),
                    status=AlertStatus.ACTIVE.value,
                )
            )

    # 2. Blood Glucose Rules (ADA 2024 Standards)
    gluc = vital.blood_glucose
    gluc_mmol = vital.blood_glucose_mmol or (round(gluc / 18.0182, 2) if gluc else None)

    if gluc is not None:
        # Severe Hypoglycemia: <54 mg/dL (<3.0 mmol/L)
        if gluc < 54:
            alerts_to_create.append(
                VitalAlert(
                    patient_id=patient_id,
                    vital_id=vital.id,
                    alert_type="SEVERE_HYPOGLYCEMIA",
                    severity=AlertSeverity.URGENT.value,
                    title="Critical Alert: Severe Hypoglycemia (<54 mg/dL)",
                    message=f"Blood glucose of {gluc} mg/dL ({gluc_mmol} mmol/L) is critically low.",
                    clinical_guidance=(
                        "Follow Rule of 15 immediately: consume 15 grams of fast-acting carbohydrate (e.g., 4 oz fruit juice, "
                        "half can regular soda, 3-4 glucose tablets). Retest in 15 minutes. If confusion, disorientation, or "
                        "inability to swallow occurs, call emergency services (911) immediately."
                    ),
                    status=AlertStatus.ACTIVE.value,
                )
            )
        # Mild/Moderate Hypoglycemia: 54-69 mg/dL
        elif gluc < 70:
            alerts_to_create.append(
                VitalAlert(
                    patient_id=patient_id,
                    vital_id=vital.id,
                    alert_type="HYPOGLYCEMIA",
                    severity=AlertSeverity.ATTENTION.value,
                    title="Low Blood Sugar Alert (<70 mg/dL)",
                    message=f"Blood glucose of {gluc} mg/dL ({gluc_mmol} mmol/L) is below normal fasting limits.",
                    clinical_guidance=(
                        "Consume 15g fast-acting carbohydrates and recheck glucose in 15 minutes. If symptoms like shakiness, "
                        "sweating, or palpitations continue, contact your clinician."
                    ),
                    status=AlertStatus.ACTIVE.value,
                )
            )
        # Severe Hyperglycemia: >250 mg/dL (>13.9 mmol/L)
        elif gluc > 250:
            alerts_to_create.append(
                VitalAlert(
                    patient_id=patient_id,
                    vital_id=vital.id,
                    alert_type="SEVERE_HYPERGLYCEMIA",
                    severity=AlertSeverity.ATTENTION.value,
                    title="Elevated Glucose Alert (>250 mg/dL)",
                    message=f"Blood glucose of {gluc} mg/dL ({gluc_mmol} mmol/L) is significantly elevated.",
                    clinical_guidance=(
                        "Stay hydrated with water. Follow your provider's care plan (such as checking urine ketones if instructed). "
                        "Contact your physician or care team if levels remain elevated across multiple checks."
                    ),
                    status=AlertStatus.ACTIVE.value,
                )
            )

    # 3. Heart Rate Rules
    hr = vital.heart_rate
    if hr is not None:
        if hr > 120:
            alerts_to_create.append(
                VitalAlert(
                    patient_id=patient_id,
                    vital_id=vital.id,
                    alert_type="TACHYCARDIA",
                    severity=AlertSeverity.ATTENTION.value,
                    title="High Resting Pulse Alert (>120 BPM)",
                    message=f"Resting pulse rate of {hr} BPM is elevated.",
                    clinical_guidance=(
                        "Rest quietly for 5 minutes and repeat measurement. If accompanied by shortness of breath, "
                        "chest tightness, or fainting, seek urgent medical evaluation."
                    ),
                    status=AlertStatus.ACTIVE.value,
                )
            )
        elif hr < 45:
            alerts_to_create.append(
                VitalAlert(
                    patient_id=patient_id,
                    vital_id=vital.id,
                    alert_type="BRADYCARDIA",
                    severity=AlertSeverity.ATTENTION.value,
                    title="Low Resting Pulse Alert (<45 BPM)",
                    message=f"Heart rate of {hr} BPM is below standard resting limits.",
                    clinical_guidance=(
                        "Unless you are a well-conditioned endurance athlete, a low resting pulse accompanied by dizziness "
                        "or fatigue should be evaluated by a healthcare professional."
                    ),
                    status=AlertStatus.ACTIVE.value,
                )
            )

    # 4. Repeated Abnormal Telemetry Detection (last 48 hours)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    history_stmt = (
        select(VitalSign)
        .where(VitalSign.patient_id == patient_id, VitalSign.recorded_at >= cutoff)
        .order_by(desc(VitalSign.recorded_at))
        .limit(5)
    )
    history_res = await db.execute(history_stmt)
    recent_vitals = history_res.scalars().all()

    # Check if 2+ consecutive recent readings have high BP
    high_bp_count = sum(1 for v in recent_vitals if (v.systolic_bp and v.systolic_bp >= 140) or (v.diastolic_bp and v.diastolic_bp >= 90))
    if high_bp_count >= 2 and not any(a.alert_type == "HYPERTENSIVE_CRISIS" for a in alerts_to_create):
        # Only add repeated alert if not already in crisis
        alerts_to_create.append(
            VitalAlert(
                patient_id=patient_id,
                vital_id=vital.id,
                alert_type="REPEATED_ABNORMAL",
                severity=AlertSeverity.ATTENTION.value,
                title="Pattern Alert: Repeated Elevated Blood Pressure",
                message=f"Detected {high_bp_count} readings with elevated blood pressure within the last 48 hours.",
                clinical_guidance=(
                    "A sustained pattern of elevated readings is more clinically meaningful than a single reading. "
                    "Share this 48-hour trend with your healthcare provider for clinical review."
                ),
                status=AlertStatus.ACTIVE.value,
            )
        )

    for alert in alerts_to_create:
        db.add(alert)

    return alerts_to_create


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def check_stale_measurements(
    db: AsyncSession,
    patient_id: uuid.UUID,
    days_threshold: int = 7,
) -> Optional[VitalAlert]:
    """
    Checks if a patient hasn't logged vital signs in `days_threshold` days.
    Generates an informational stale reading reminder alert if needed.
    """
    # Check if an active stale reading alert already exists
    existing_stale_stmt = (
        select(VitalAlert)
        .where(
            VitalAlert.patient_id == patient_id,
            VitalAlert.alert_type == "STALE_READINGS",
            VitalAlert.status == AlertStatus.ACTIVE.value,
        )
        .limit(1)
    )
    existing_stale = (await db.execute(existing_stale_stmt)).scalar_one_or_none()
    if existing_stale:
        return None

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days_threshold)
    latest_stmt = (
        select(VitalSign)
        .where(VitalSign.patient_id == patient_id)
        .order_by(desc(VitalSign.recorded_at))
        .limit(1)
    )
    res = await db.execute(latest_stmt)
    latest = res.scalar_one_or_none()

    rec_at = _to_utc(latest.recorded_at) if latest else None

    if not latest or (rec_at and rec_at < cutoff):
        days_ago = (now - rec_at).days if rec_at else "several"
        alert = VitalAlert(
            patient_id=patient_id,
            vital_id=latest.id if latest else None,
            alert_type="STALE_READINGS",
            severity=AlertSeverity.INFO.value,
            title="Monitoring Notice: Telemetry Stale or Missing",
            message=f"No vital signs recorded in the past {days_ago} days. Regular logging supports optimal clinical monitoring.",
            clinical_guidance="Log your blood pressure and glucose readings to maintain consistent trend visibility for your care team.",
            status=AlertStatus.ACTIVE.value,
        )
        db.add(alert)
        return alert

    return None

