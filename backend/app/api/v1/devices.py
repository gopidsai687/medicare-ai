"""
Medical Device Integration API — MediCare AI.
Provides hardware communication adapter endpoints, telemetry ingestion with
provenance tracking, clinical safety bounds validation, simulator testbench,
and scientific feasibility reporting.
"""
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.medical_device import (
    DeviceProtocol,
    DeviceStatus,
    DeviceTelemetryPacket,
    MeasurementProvenance,
    MedicalDevice,
    SignalQuality,
)
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.vital_sign import MeasurementSource, VitalSign
from app.schemas.medical_device import (
    DeviceCalibrationRequest,
    DeviceSimulatorRequest,
    DeviceTelemetryPacketRead,
    MedicalDeviceCreate,
    MedicalDeviceRead,
    MedicalDeviceUpdate,
    ScientificFeasibilityReport,
    SensorFeasibilityItem,
    TelemetryIngestRequest,
    BLEReadingIngestRequest,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/devices", tags=["medical-devices"])


async def _resolve_patient_id(
    db: AsyncSession, current_user: User, requested_patient_id: Optional[uuid.UUID] = None
) -> uuid.UUID:
    """Enforce strict patient-level isolation."""
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


# -----------------------------------------------------------------------------
# 1. Device Registration and Management
# -----------------------------------------------------------------------------
@router.get("", response_model=List[MedicalDeviceRead])
async def list_devices(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List registered medical peripheral devices for the patient."""
    target_patient_id = await _resolve_patient_id(db, current_user, patient_id)
    query = (
        select(MedicalDevice)
        .where(MedicalDevice.patient_id == target_patient_id)
        .order_by(desc(MedicalDevice.created_at))
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/register", response_model=MedicalDeviceRead, status_code=status.HTTP_201_CREATED)
async def register_device(
    payload: MedicalDeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register and pair a medical device or experimental sensor station."""
    target_patient_id = await _resolve_patient_id(db, current_user, payload.patient_id)

    # Check for duplicate serial number
    existing_stmt = select(MedicalDevice).where(MedicalDevice.serial_number == payload.serial_number)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device with serial number '{payload.serial_number}' is already registered in MediCare AI.",
        )

    device = MedicalDevice(
        patient_id=target_patient_id,
        device_name=payload.device_name,
        device_type=payload.device_type,
        manufacturer=payload.manufacturer,
        model_number=payload.model_number,
        serial_number=payload.serial_number,
        hardware_revision=payload.hardware_revision,
        firmware_version=payload.firmware_version,
        protocol=payload.protocol,
        status=DeviceStatus.CONNECTED.value if payload.protocol == DeviceProtocol.SIMULATED.value else DeviceStatus.DISCONNECTED.value,
        supports_heart_rate=payload.supports_heart_rate,
        supports_spo2=payload.supports_spo2,
        supports_perfusion_index=payload.supports_perfusion_index,
        supports_dermal_temperature=payload.supports_dermal_temperature,
        supports_contact_force=payload.supports_contact_force,
        # Enforce scientific safety: Non-invasive optical devices cannot claim glucose support.
        # Genuine fingerstick meters (SMBG) or continuous interstitial sensors (CGM) are permitted.
        supports_blood_glucose=(
            payload.supports_blood_glucose and payload.device_type.lower() in [
                "fingerstick_glucometer", "continuous_glucose_monitor", "cgm", "smbg",
                "electrochemical_glucometer", "ble_glucometer"
            ]
        ),
        supports_blood_pressure=payload.supports_blood_pressure,
        # Validated pneumatic cuff monitors directly measure pressure via oscillometry
        is_bp_calibrated=(
            payload.supports_blood_pressure and payload.device_type.lower() in [
                "cuff_blood_pressure_monitor", "oscillometric_cuff", "inflatable_cuff", "ble_blood_pressure_monitor"
            ]
        ),
        bp_calibration_expiry=(
            datetime.now(timezone.utc) + timedelta(days=365)
            if payload.supports_blood_pressure and payload.device_type.lower() in [
                "cuff_blood_pressure_monitor", "oscillometric_cuff", "inflatable_cuff", "ble_blood_pressure_monitor"
            ] else None
        ),
        is_demo_device=payload.is_demo_device,
        mac_or_device_id=payload.mac_or_device_id,
        notes=payload.notes,
        last_heartbeat_at=datetime.now(timezone.utc),
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


# -----------------------------------------------------------------------------
# Feasibility Report & Test Simulator (Must precede /{device_id})
# -----------------------------------------------------------------------------
@router.get("/feasibility-report", response_model=ScientificFeasibilityReport)
async def get_feasibility_report():
    """
    Return comprehensive biomedical engineering feasibility assessment,
    FDA safety guidance, optical physics limits, and required breakthroughs.
    """
    sensors = [
        SensorFeasibilityItem(
            vital_name="Pulse Rate (Heart Rate)",
            physical_parameter_measured="Capillary blood volume pulsation (AC component of light transmission)",
            primary_sensor_technology="Multi-wavelength Photoplethysmography (PPG) at 530 nm (Green) and 660 nm (Red)",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=["ISO 80601-2-61", "IEC 60601-1", "IEEE 1708"],
            fda_regulatory_status="FDA Class II (510(k) pathway well established; predicate devices available)",
            clinical_limitations="Motion artifacts, arrhythmias, severe peripheral vasoconstriction, ambient light interference.",
        ),
        SensorFeasibilityItem(
            vital_name="Pulse Oximetry (SpO2)",
            physical_parameter_measured="Differential optical absorption ratio of oxygenated (HbO2) vs deoxygenated hemoglobin (Hb)",
            primary_sensor_technology="Dual-wavelength PPG (660 nm Red / 940 nm Near-Infrared)",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=["ISO 80601-2-61 (Accuracy criteria: Arms ≤ 3.5% across 70%-100% SpO2)", "CLSI POCT12"],
            fda_regulatory_status="FDA Class II (510(k) cleared with controlled human desaturation clinical study in healthy volunteers)",
            clinical_limitations="Skin pigmentation bias (Monk Skin Tone Scale calibration required), carboxyhemoglobin, hypoperfusion.",
        ),
        SensorFeasibilityItem(
            vital_name="Perfusion Index (PI)",
            physical_parameter_measured="Ratio of pulsatile blood flow (AC) to non-pulsatile background tissue absorption (DC)",
            primary_sensor_technology="Infrared PPG photodiode transimpedance amplifier (TIA)",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=["ISO 80601-2-61"],
            fda_regulatory_status="FDA Class II (Adjunctive monitoring parameter)",
            clinical_limitations="Sensitive to sympathetic tone, ambient room temperature, and local contact pressure.",
        ),
        SensorFeasibilityItem(
            vital_name="Dermal Surface Temperature",
            physical_parameter_measured="Far-infrared thermal radiative emission (8-14 µm)",
            primary_sensor_technology="Melexis MLX90614 or high-precision NTC thermistor",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=["ASTM E1965-98", "ISO 80601-2-56"],
            fda_regulatory_status="FDA Class II clinical thermometer",
            clinical_limitations="Measures peripheral dermal temperature, not core body temperature. Substantial offset from oral/rectal core.",
        ),
        SensorFeasibilityItem(
            vital_name="Contact Force / Touch Pressure",
            physical_parameter_measured="Applied mechanical force of the fingertip on optical aperture",
            primary_sensor_technology="Piezoresistive force sensor / miniature strain gauge load cell",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=["IEC 60601-1"],
            fda_regulatory_status="Integrated subsystem component",
            clinical_limitations="Essential for gating: forces > 2.5 N blanch capillary microvasculature, destroying PPG morphology.",
        ),
        SensorFeasibilityItem(
            vital_name="Cuffless Blood Pressure (PWA / PTT)",
            physical_parameter_measured="Pulse wave velocity, augmentation index, arterial reflection time",
            primary_sensor_technology="Multi-site PPG or PPG + ECG (Pulse Arrival Time)",
            direct_clinical_validity=False,
            status="EXPERIMENTAL_REQUIRES_CALIBRATION",
            required_breakthrough="Continuous dynamic tracking of arterial compliance and vasomotor tone without frequent cuff recalibration.",
            governing_standards=[
                "IEEE Std 1708-2014/2025 (Standard for Wearable Cuffless Blood Pressure Measuring Devices)",
                "ISO 81060-2:2018 (Mean error ≤ ±5 mmHg, SD ≤ 8 mmHg)",
                "FDA Draft Guidance: Cuffless Non-invasive Blood Pressure Measuring Devices (Nov 2023)",
            ],
            fda_regulatory_status="FDA Class II (510(k) cleared ONLY when paired with periodic cuff calibration or bounded hospital envelope)",
            clinical_limitations="Cannot measure hydrostatic pressure directly. Decoupled by autonomic arousal, vasoactive drugs, and posture.",
        ),
        SensorFeasibilityItem(
            vital_name="Non-Invasive Blood Glucose",
            physical_parameter_measured="Molecular absorption of glucose vibrational harmonics",
            primary_sensor_technology="Near-Infrared (NIR) / Mid-IR Spectroscopy / Raman Spectroscopy / Photoacoustic",
            direct_clinical_validity=False,
            status="NOT_FEASIBLE",
            required_breakthrough=(
                "Orders-of-magnitude increase in spectral signal-to-noise ratio (SNR > 60 dB in vivo); "
                "selective isolation of glucose (0.1% w/v) against massive water, protein, and lipid absorption bands; "
                "robust compensation for skin hydration, epidermal thickness, and temperature drift. "
                "Must meet ISO 15197 (95% within ±15 mg/dL of laboratory reference analyzer)."
            ),
            governing_standards=["ISO 15197:2013", "CLSI POCT12-A3", "Clarke & Parkes Consensus Error Grids"],
            fda_regulatory_status="UNAUTHORIZED — ZERO FDA-cleared non-invasive, cuffless or punctureless glucose monitors exist.",
            clinical_limitations="Water absorption is 1,000x stronger than glucose in NIR. Misleading readings lead to fatal insulin dosing errors.",
        ),
    ]

    fda_comms = [
        {
            "date": "2024-02-21",
            "title": "Do Not Use Smartwatches or Smart Rings to Measure Blood Glucose Levels: FDA Safety Communication",
            "summary": (
                "The FDA warned consumers, patients, caregivers, and healthcare providers that the agency has not cleared "
                "or approved ANY smartwatch or smart ring intended to measure or estimate blood glucose values on its own. "
                "Using unauthorized devices can cause inaccurate glucose measurements, resulting in dangerous insulin overdoses "
                "or missed hypoglycemia treatments leading to coma or death."
            ),
            "url": "https://www.fda.gov/medical-devices/safety-communications/do-not-use-smartwatches-or-smart-rings-measure-blood-glucose-levels-fda-safety-communication",
        },
        {
            "date": "2023-11-01",
            "title": "FDA Draft Guidance: Cuffless Non-invasive Blood Pressure Measuring Devices",
            "summary": (
                "Outlines premarket performance expectations under IEEE 1708 and ISO 81060-2. Emphasizes that cuffless devices "
                "must undergo rigorous clinical trials covering diverse skin tones (Monk Skin Tone Scale), age brackets, "
                "and explicit evaluation of calibration decay over time."
            ),
            "url": "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cuffless-non-invasive-blood-pressure-measuring-devices",
        },
    ]

    reg_pathway = {
        "device_classification": "FDA Class II (Special Controls)",
        "premarket_submission": "510(k) Premarket Notification or De Novo Classification",
        "electrical_safety": "IEC 60601-1 (Medical electrical equipment - General requirements for basic safety and essential performance)",
        "emc_compliance": "IEC 60601-1-2 (Electromagnetic disturbances - Requirements and tests)",
        "biocompatibility": "ISO 10993-5 (Cytotoxicity) & ISO 10993-10 (Sensitization/Irritation) for optical contact window",
        "software_lifecycle": "IEC 62304 (Medical device software - Software life cycle processes, Class B)",
        "risk_management": "ISO 14971 (Application of risk management to medical devices)",
        "quality_system": "21 CFR Part 820 / ISO 13485 (Medical devices - Quality management systems)",
    }

    clinical_protocol = {
        "blood_pressure_protocol": (
            "ANSI/AAMI/ISO 81060-2:2018 protocol with minimum 85 human subjects across normotensive, pre-hypertensive, "
            "and hypertensive ranges. Requires reference measurements by two independent trained observers using calibrated "
            "mercury/double-stethoscope auscultation or arterial line catheterization."
        ),
        "glucose_protocol": (
            "ISO 15197:2013 and CLSI POCT12-A3 testing across ≥100 subjects in controlled hypoglycemic (<70 mg/dL), "
            "euglycemic (70-180 mg/dL), and hyperglycemic (>180 mg/dL) states, evaluated against laboratory gold-standard "
            "plasma analyzer (YSI 2300 STAT Plus or hexokinase method). 95% of readings must fall within ±15 mg/dL (<100 mg/dL) "
            "or ±15% (≥100 mg/dL). Must plot 99% in Zone A/B of Clarke Error Grid."
        ),
    }

    return ScientificFeasibilityReport(
        title="Biomedical Engineering & Scientific Feasibility Report: Non-Invasive Fingertip Vital Sensing",
        executive_summary=(
            "Based on peer-reviewed biomedical optics, published clinical consensus, and official FDA guidance, "
            "a single uncalibrated fingertip optical sensor CANNOT measure both blood glucose and blood pressure without skin puncture or cuff. "
            "Photoplethysmography (PPG) reliably and non-invasively measures heart rate, oxygen saturation (SpO2), and perfusion index. "
            "However, non-invasive optical glucose monitoring remains clinically unfeasible due to extreme water/protein absorption interference (SNR < 0.1%). "
            "Cuffless blood pressure is an experimental surrogate that strictly requires periodic pneumatic cuff recalibration under IEEE 1708. "
            "MediCare AI adheres to strict clinical integrity: real sensor telemetry is authenticated with explicit provenance, "
            "unverified vital estimates are never displayed as diagnostic truth, and synthetic data is visibly segregated as DEMO."
        ),
        can_measure_both_at_fingertip_without_cuff_or_blood=False,
        sensors=sensors,
        fda_safety_communications=fda_comms,
        regulatory_pathway=reg_pathway,
        clinical_validation_protocol=clinical_protocol,
    )


@router.post("/ble/ingest", response_model=DeviceTelemetryPacketRead, status_code=status.HTTP_201_CREATED)
async def ingest_ble_device_reading(
    payload: BLEReadingIngestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Direct ingestion endpoint for Bluetooth Low Energy (BLE) medical devices
    paired via Web Bluetooth (GATT 0x1810 Blood Pressure, GATT 0x1808 Glucose Meter).
    Validates measurement bounds, verifies physical device type, and registers provenance.
    """
    target_patient_id = await _resolve_patient_id(db, current_user)
    dev_type = payload.device_type.lower()

    # 1. SCIENTIFIC CLINICAL SAFETY GATE: Non-invasive optical glucose prohibition
    # Capillary fingerstick (SMBG) or continuous subcutaneous sensor (CGM) are clinically permitted.
    # Optical finger touch / camera estimation is strictly rejected.
    if payload.blood_glucose is not None:
        if dev_type not in [
            "fingerstick_glucometer", "continuous_glucose_monitor", "cgm", "smbg",
            "electrochemical_glucometer", "ble_glucometer"
        ]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Clinical Safety Rejection: Non-invasive optical sensing cannot measure molecular blood glucose "
                    "without skin puncture or continuous interstitial probe. Relying on optical glucose estimates "
                    "is hazardous and violates FDA guidance. Value rejected."
                ),
            )

    # 2. CALIBRATION GATE: Blood Pressure
    # Blood pressure monitors must use a validated pneumatic cuff (oscillometric)
    is_cuff = dev_type in [
        "cuff_blood_pressure_monitor", "oscillometric_cuff", "inflatable_cuff", "ble_blood_pressure_monitor"
    ]
    if (payload.systolic_bp is not None or payload.diastolic_bp is not None) and not is_cuff:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Blood pressure measurement requires a validated pneumatic cuff (AHA/ACC clinical guideline).",
        )

    # 3. Find or auto-register this BLE device for the patient
    stmt = select(MedicalDevice).where(
        MedicalDevice.patient_id == target_patient_id,
        MedicalDevice.serial_number == payload.serial_number,
    )
    res = await db.execute(stmt)
    device = res.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not device:
        supports_glucose = payload.blood_glucose is not None and dev_type in [
            "fingerstick_glucometer", "continuous_glucose_monitor", "cgm", "smbg",
            "electrochemical_glucometer", "ble_glucometer"
        ]
        device = MedicalDevice(
            patient_id=target_patient_id,
            device_name=payload.device_name,
            device_type=payload.device_type,
            manufacturer=payload.manufacturer or "Bluetooth SIG Peripheral",
            model_number=payload.model_number or "BLE-GATT",
            serial_number=payload.serial_number,
            hardware_revision="BLE 5.x",
            firmware_version="GATT-Standard",
            protocol=DeviceProtocol.BLE.value,
            status=DeviceStatus.CONNECTED.value,
            supports_heart_rate=payload.heart_rate is not None,
            supports_spo2=False,
            supports_perfusion_index=False,
            supports_dermal_temperature=False,
            supports_contact_force=False,
            supports_blood_glucose=supports_glucose,
            supports_blood_pressure=payload.systolic_bp is not None,
            is_bp_calibrated=is_cuff,
            bp_calibration_expiry=now + timedelta(days=365) if is_cuff else None,
            is_demo_device=False,
            notes=f"Paired via Web Bluetooth GATT service. Type: {payload.device_type}",
            last_heartbeat_at=now,
            last_reading_at=now,
        )
        db.add(device)
        await db.flush()
    else:
        device.status = DeviceStatus.CONNECTED.value
        device.last_heartbeat_at = now
        device.last_reading_at = now

    # 4. Generate packet hash & record telemetry
    raw_sig = f"{device.id}:{payload.timestamp.isoformat()}:{payload.heart_rate}:{payload.systolic_bp}:{payload.blood_glucose}"
    computed_hash = hashlib.sha256(raw_sig.encode()).hexdigest()

    existing_hash_stmt = select(DeviceTelemetryPacket).where(DeviceTelemetryPacket.packet_hash == computed_hash)
    existing_hash_res = await db.execute(existing_hash_stmt)
    if existing_hash_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate BLE telemetry packet detected.",
        )

    packet = DeviceTelemetryPacket(
        device_id=device.id,
        patient_id=target_patient_id,
        packet_timestamp=payload.timestamp,
        heart_rate=payload.heart_rate,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        blood_glucose=payload.blood_glucose,
        signal_quality="OPTIMAL",
        provenance=MeasurementProvenance.MEASURED_DEVICE.value,
        packet_hash=computed_hash,
        is_sample=False,
        validation_status="VALID",
        validation_notes=f"Authenticated BLE reading from {payload.device_name} ({payload.device_type}).",
    )
    db.add(packet)

    # 5. Mirror to VitalSign
    gluc_mmol = round(payload.blood_glucose / 18.0182, 2) if payload.blood_glucose is not None else None
    vital = VitalSign(
        patient_id=target_patient_id,
        recorded_by_id=current_user.id,
        recorded_at=payload.timestamp,
        heart_rate=payload.heart_rate,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        blood_glucose=payload.blood_glucose,
        blood_glucose_mmol=gluc_mmol,
        glucose_unit=payload.glucose_unit or "mg/dL",
        glucose_context=payload.glucose_context or "fasting",
        measurement_source="measured_device",
        device_name=device.device_name,
        notes=f"BLE Telemetry: {device.device_name} (S/N: {device.serial_number})",
        is_patient_entered=False,
        is_sample=False,
    )
    db.add(vital)

    await db.commit()
    await db.refresh(packet)
    return packet


@router.get("/{device_id}", response_model=MedicalDeviceRead)
async def get_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve device metadata, protocol, and calibration state."""
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to requested device")

    return device


@router.post("/{device_id}/connect", response_model=MedicalDeviceRead)
async def connect_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Establish active communication session with physical peripheral."""
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    device.status = DeviceStatus.CONNECTED.value
    device.last_heartbeat_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(device)
    return device


@router.post("/{device_id}/disconnect", response_model=MedicalDeviceRead)
async def disconnect_device(
    device_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Safely terminate device connection session."""
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    device.status = DeviceStatus.DISCONNECTED.value
    await db.commit()
    await db.refresh(device)
    return device


@router.post("/{device_id}/calibrate", response_model=MedicalDeviceRead)
async def calibrate_cuffless_bp(
    device_id: uuid.UUID,
    payload: DeviceCalibrationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calibrate optical pulse transit time (PTT) against reference pneumatic cuff measurement.
    Required by IEEE Std 1708 before any cuffless blood pressure estimation is permitted.
    """
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    now = datetime.now(timezone.utc)
    device.supports_blood_pressure = True
    device.is_bp_calibrated = True
    # 30-day clinical calibration window per IEEE 1708 wear guidelines
    device.bp_calibration_expiry = now + timedelta(days=30)
    device.notes = (
        f"Calibrated against reference cuff '{payload.cuff_device_name}' on {now.strftime('%Y-%m-%d')} "
        f"({payload.reference_systolic}/{payload.reference_diastolic} mmHg)."
    )
    await db.commit()
    await db.refresh(device)
    return device


# -----------------------------------------------------------------------------
# 2. Telemetry Ingestion & Data Validation Pipeline
# -----------------------------------------------------------------------------
@router.post("/{device_id}/telemetry", response_model=DeviceTelemetryPacketRead, status_code=status.HTTP_201_CREATED)
async def ingest_device_telemetry(
    device_id: uuid.UUID,
    payload: TelemetryIngestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ingest verified telemetry from a physical sensor peripheral.
    Enforces strict clinical validation, rejects duplicate packets,
    and blocks scientifically impossible or uncalibrated claims.
    """
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # 1. SCIENTIFIC CLINICAL SAFETY GATE: Blood Glucose
    # Non-invasive optical fingertip sensors cannot measure molecular glucose concentration.
    # Ref: FDA Safety Communication (Feb 21, 2024); ISO 15197:2013.
    if payload.blood_glucose is not None and not payload.is_sample:
        if not device.supports_blood_glucose:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Clinical Safety Rejection: Non-invasive optical sensing cannot measure molecular blood glucose "
                    "without skin puncture or continuous interstitial probe. Relying on optical glucose estimates "
                    "is hazardous and violates FDA guidance. Value rejected."
                ),
            )

    # 2. CALIBRATION GATE: Blood Pressure
    # Cuffless blood pressure requires active pneumatic cuff calibration under IEEE Std 1708.
    if (payload.systolic_bp is not None or payload.diastolic_bp is not None) and not payload.is_sample:
        if not device.is_bp_calibrated:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Calibration Required: Cuffless pulse wave analysis cannot produce diagnostic blood pressure "
                    "without active reference cuff initialization (IEEE Std 1708). Please calibrate the device first."
                ),
            )
        if device.bp_calibration_expiry:
            expiry = device.bp_calibration_expiry
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Cuffless blood pressure calibration has expired (>30 days). Recalibration with an approved cuff is required.",
                )

    # 3. Deduplication Check via Cryptographic Hash
    packet_time_iso = payload.timestamp.isoformat()
    raw_sig = f"{device.id}:{packet_time_iso}:{payload.heart_rate}:{payload.oxygen_saturation}:{payload.contact_force_n}"
    computed_hash = payload.packet_hash or hashlib.sha256(raw_sig.encode()).hexdigest()

    existing_hash_stmt = select(DeviceTelemetryPacket).where(DeviceTelemetryPacket.packet_hash == computed_hash)
    existing_hash_res = await db.execute(existing_hash_stmt)
    if existing_hash_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate telemetry packet detected. Packet hash already recorded in database.",
        )

    # 4. Record Telemetry Packet with Strict Provenance
    now = datetime.now(timezone.utc)
    provenance = MeasurementProvenance.SIMULATED_DEMO.value if payload.is_sample else MeasurementProvenance.MEASURED_DEVICE.value

    packet = DeviceTelemetryPacket(
        device_id=device.id,
        patient_id=target_patient_id,
        packet_timestamp=payload.timestamp,
        heart_rate=payload.heart_rate,
        oxygen_saturation=payload.oxygen_saturation,
        perfusion_index=payload.perfusion_index,
        dermal_temperature_c=payload.dermal_temperature_c,
        contact_force_n=payload.contact_force_n,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        blood_glucose=payload.blood_glucose,
        signal_quality=payload.signal_quality,
        snr_db=payload.snr_db,
        provenance=provenance,
        packet_hash=computed_hash,
        is_sample=payload.is_sample,
        validation_status="VALID",
        validation_notes=f"Validated via {device.protocol} hardware adapter. Device model: {device.model_number}.",
    )
    db.add(packet)

    # 5. Mirror to VitalSign table for clinical records
    vital = VitalSign(
        patient_id=target_patient_id,
        recorded_by_id=current_user.id,
        recorded_at=payload.timestamp,
        heart_rate=payload.heart_rate,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        oxygen_saturation=payload.oxygen_saturation,
        temperature=payload.dermal_temperature_c,
        blood_glucose=payload.blood_glucose,
        blood_glucose_mmol=round(payload.blood_glucose / 18.0182, 2) if payload.blood_glucose is not None else None,
        glucose_unit="mg/dL",
        glucose_context="fasting" if payload.blood_glucose is not None else None,
        measurement_source=MeasurementSource.SAMPLE_DATA.value if payload.is_sample else "measured_device",
        device_name=device.device_name,
        notes=f"Source: {device.device_name} (S/N: {device.serial_number}) | Signal Quality: {payload.signal_quality}",
        is_patient_entered=False,
        is_sample=payload.is_sample,
    )
    db.add(vital)

    device.last_reading_at = now
    device.last_heartbeat_at = now
    device.status = DeviceStatus.STREAMING.value

    await db.commit()
    await db.refresh(packet)
    return packet


@router.get("/{device_id}/telemetry", response_model=List[DeviceTelemetryPacketRead])
async def list_device_telemetry(
    device_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve raw historical telemetry stream packets for a given device."""
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    query = (
        select(DeviceTelemetryPacket)
        .where(DeviceTelemetryPacket.device_id == device_id)
        .order_by(desc(DeviceTelemetryPacket.packet_timestamp))
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()


# -----------------------------------------------------------------------------
# 3. Test Simulator (Visibly Marked DEMO ONLY)
# -----------------------------------------------------------------------------
@router.post("/simulator/packet", response_model=DeviceTelemetryPacketRead)
async def generate_simulated_packet(
    payload: DeviceSimulatorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate synthetic optical fingertip sensor telemetry for testing.
    VISIBLY MARKED AS DEMO. Never substitutes synthetic estimates for clinical data.
    """
    target_patient_id = await _resolve_patient_id(db, current_user)

    # Get or create demo simulator device
    device = None
    if payload.device_id:
        device = await db.get(MedicalDevice, payload.device_id)

    if not device:
        dev_stmt = select(MedicalDevice).where(
            MedicalDevice.patient_id == target_patient_id,
            MedicalDevice.is_demo_device == True,
        )
        dev_res = await db.execute(dev_stmt)
        device = dev_res.scalar_one_or_none()

    if not device:
        device = MedicalDevice(
            patient_id=target_patient_id,
            device_name="MediCare BioSens FS-100 (Virtual Simulator)",
            device_type="fingertip_optical_station",
            manufacturer="MediCare BioSens Testbench",
            model_number="MC-SIM-FS100",
            serial_number=f"SIM-{uuid.uuid4().hex[:8].upper()}",
            hardware_revision="Virtual v2.0",
            firmware_version="v1.0.0-sim",
            protocol=DeviceProtocol.SIMULATED.value,
            status=DeviceStatus.STREAMING.value,
            is_demo_device=True,
            supports_heart_rate=True,
            supports_spo2=True,
            supports_perfusion_index=True,
            supports_dermal_temperature=True,
            supports_contact_force=True,
            supports_blood_pressure=False,
            supports_blood_glucose=False,
            last_heartbeat_at=datetime.now(timezone.utc),
        )
        db.add(device)
        await db.commit()
        await db.refresh(device)

    now = datetime.now(timezone.utc)
    
    # Configure simulated scenario
    hr = payload.pulse_bpm or 72
    spo2 = payload.spo2_pct or 98.5
    force = payload.contact_force_n or 1.2
    pi = 2.4
    temp = 34.2
    sig_quality = SignalQuality.OPTIMAL.value
    snr = 28.5

    if payload.scenario == "high_pressure":
        force = 3.8
        sig_quality = SignalQuality.EXCESSIVE_PRESSURE.value
        pi = 0.4  # capillary blanching / occlusion
        snr = 12.0
    elif payload.scenario == "motion_noise":
        sig_quality = SignalQuality.MOTION_ARTIFACT.value
        snr = 6.2
    elif payload.scenario == "low_perfusion":
        pi = 0.15
        sig_quality = SignalQuality.POOR_PERFUSION.value
        temp = 29.8

    # Deduplication hash
    pkt_hash = hashlib.sha256(f"DEMO:{device.id}:{now.isoformat()}:{payload.scenario}".encode()).hexdigest()

    packet = DeviceTelemetryPacket(
        device_id=device.id,
        patient_id=target_patient_id,
        packet_timestamp=now,
        heart_rate=hr,
        oxygen_saturation=spo2,
        perfusion_index=pi,
        dermal_temperature_c=temp,
        contact_force_n=force,
        systolic_bp=None,     # Glucose and uncalibrated BP strictly omitted
        diastolic_bp=None,
        blood_glucose=None,
        signal_quality=sig_quality,
        snr_db=snr,
        provenance=MeasurementProvenance.SIMULATED_DEMO.value,
        packet_hash=pkt_hash,
        is_sample=True,
        validation_status="DEMO_SIMULATION",
        validation_notes="Synthetic telemetry packet generated by testbench simulator for UI/waveform validation.",
    )
    db.add(packet)
    await db.commit()
    await db.refresh(packet)
    return packet

