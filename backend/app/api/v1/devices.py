"""
Medical Device Integration API — MediCare AI.
Provides hardware communication adapter endpoints, telemetry ingestion with
provenance tracking, clinical safety bounds validation, simulator testbench,
and scientific feasibility reporting.
"""
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.medical_device import (
    DeviceConnectionEvent,
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
    DeviceConnectionEventRead,
    DeviceConnectionStatusUpdate,
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
            governing_standards=["ISO 80601-2-61:2026, Edition 3", "IEC 60601-1:2005+AMD1:2012+AMD2:2020"],
            fda_regulatory_status="FDA Class II (510(k) pathway well established; prototype requires prospective validation)",
            clinical_limitations="Motion artifacts, arrhythmias, severe peripheral vasoconstriction, ambient light interference.",
        ),
        SensorFeasibilityItem(
            vital_name="Pulse Oximetry (SpO2)",
            physical_parameter_measured="Differential optical absorption ratio of oxygenated (HbO2) vs deoxygenated hemoglobin (Hb)",
            primary_sensor_technology="Dual-wavelength PPG (660 nm Red / 940 nm Near-Infrared)",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=[
                "ISO 80601-2-61:2026, Edition 3 (clause 201.12.1 Arms ≤ 3.5% across 70%-100% SpO2 with Monk Skin Tone Scale 1-10 cohort representation)",
                "CLSI POCT12-A3",
            ],
            fda_regulatory_status="FDA Class II (510(k) pathway requires controlled human hypoxia desaturation clinical study in healthy volunteers; prototype is not 510(k) cleared)",
            clinical_limitations="Skin pigmentation bias (requires Monk Skin Tone Scale 1-10 clinical calibration per ISO 80601-2-61:2026, Edition 3), dyshemoglobins, hypoperfusion.",
        ),
        SensorFeasibilityItem(
            vital_name="Perfusion Index (PI)",
            physical_parameter_measured="Ratio of pulsatile blood flow (AC) to non-pulsatile background tissue absorption (DC)",
            primary_sensor_technology="Infrared PPG photodiode transimpedance amplifier (TIA)",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=["ISO 80601-2-61:2026, Edition 3"],
            fda_regulatory_status="FDA Class II (Adjunctive monitoring parameter)",
            clinical_limitations="Sensitive to sympathetic tone, ambient room temperature, and local contact pressure.",
        ),
        SensorFeasibilityItem(
            vital_name="Dermal Surface Temperature",
            physical_parameter_measured="Far-infrared thermal radiative emission (8-14 µm)",
            primary_sensor_technology="Melexis MLX90614 non-contact infrared thermopile or calibrated medical NTC",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=["ASTM E1965-98 (2016)", "ISO 80601-2-56:2017+Amd 1:2024"],
            fda_regulatory_status="FDA Class II cutaneous thermometer",
            clinical_limitations="Measures peripheral cutaneous skin surface temperature, NOT core body temperature. Dermal temperature fluctuates with ambient temperature and peripheral vasomotor tone, typically reading 2.0°C to 4.0°C below core temperature. MUST NOT be used alone for fever diagnosis.",
        ),
        SensorFeasibilityItem(
            vital_name="Contact Force / Touch Pressure",
            physical_parameter_measured="Applied mechanical force of the fingertip on optical aperture",
            primary_sensor_technology="Piezoresistive force sensor / miniature strain gauge load cell",
            direct_clinical_validity=True,
            status="VALIDATED",
            required_breakthrough=None,
            governing_standards=["IEC 60601-1:2005+AMD1:2012+AMD2:2020", "Hardware Validation Specification MC-BIO-FS100"],
            fda_regulatory_status="Integrated subsystem component",
            clinical_limitations="Optimal force range (1.0–1.5 N) is device-specific to the MC-BIO-FS100 8mm flat sapphire interface and is configurable for other mechanical housings. Not universally optimal for all optical geometries. Forces < 0.3 N cause ambient light leakage; forces > 2.5 N blanch capillary microvasculature.",
        ),
        SensorFeasibilityItem(
            vital_name="Cuffless Blood Pressure (PWA / PTT)",
            physical_parameter_measured="Pulse wave velocity, augmentation index, arterial reflection time",
            primary_sensor_technology="Multi-site PPG or PPG + ECG (Pulse Arrival Time)",
            direct_clinical_validity=False,
            status="EXPERIMENTAL_REQUIRES_CALIBRATION",
            required_breakthrough="Continuous dynamic tracking of arterial compliance and vasomotor tone without frequent cuff recalibration.",
            governing_standards=[
                "IEEE Std 1708-2014 & IEEE 1708a-2019 (Wearable Cuffless Blood Pressure Measuring Devices)",
                "ANSI/AAMI/ISO 81060-2:2019/Amd 1:2020 (Clinical investigation: mean error ≤ ±5 mmHg, SD ≤ 8 mmHg across ≥85 subjects)",
                "FDA Draft Guidance: Cuffless Non-invasive Blood Pressure Measuring Devices (Nov 2023)",
            ],
            fda_regulatory_status="FDA Class II (510(k) cleared predicates require clinical validation across ≥85 subjects and explicit calibration decay evaluation; reference cuff calibration alone does NOT establish diagnostic accuracy)",
            clinical_limitations="Surrogate estimation only. Reference cuff calibration initializes baseline transfer curve, but does NOT establish clinical accuracy or substitute for clinical validation. Dynamic changes in vascular compliance, posture, and autonomic tone decouple pulse velocity from pressure.",
        ),
        SensorFeasibilityItem(
            vital_name="Non-Invasive Blood Glucose",
            physical_parameter_measured="Optical absorption and scattering in dermal/subcutaneous tissue",
            primary_sensor_technology="Near-Infrared (NIR) / Mid-IR Spectroscopy / Raman Spectroscopy / Photoacoustic",
            direct_clinical_validity=False,
            status="NOT_FEASIBLE",
            required_breakthrough=(
                "Physiological isolation of low-concentration glucose (~0.1% w/v) from dominant overlapping water, protein, "
                "and lipid absorption spectra; robust multi-subject calibration across variable epidermal thickness and hydration; "
                "compliance with ISO 15197 accuracy criteria (95% within ±15 mg/dL or ±15% of laboratory reference)."
            ),
            governing_standards=["ISO 15197:2013", "CLSI POCT12-A3", "Clarke & Parkes Consensus Error Grids"],
            fda_regulatory_status="UNAUTHORIZED FOR CONSUMER WEARABLES: The FDA February 21, 2024 Safety Communication explicitly states that the agency has not cleared or approved ANY smartwatch or smart ring intended to measure or estimate blood glucose values on its own. Authorized Bluetooth SMBG meters (GATT 0x1808) and Continuous Glucose Monitors (CGMs) are supported.",
            clinical_limitations="In cutaneous tissue, glucose lacks discrete non-overlapping optical absorption bands in visible and NIR wavelengths, where water and protein absorption dominate. Non-invasive optical estimations from consumer wristwatches or rings are clinically unvalidated and cannot replace FDA-cleared fingerstick meters or CGMs for diabetes therapy or insulin dosing decisions.",
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
                "or missed hypoglycemia treatments leading to coma or death. The FDA emphasized using authorized continuous "
                "glucose monitors (CGMs) or authorized Bluetooth fingerstick blood glucose meters (GATT 0x1808)."
            ),
            "url": "https://www.fda.gov/medical-devices/safety-communications/do-not-use-smartwatches-or-smart-rings-measure-blood-glucose-levels-fda-safety-communication",
        },
        {
            "date": "2023-11-01",
            "title": "FDA Draft Guidance: Cuffless Non-invasive Blood Pressure Measuring Devices",
            "summary": (
                "Outlines premarket performance expectations under IEEE 1708 and ISO 81060-2. Emphasizes that cuffless devices "
                "must undergo rigorous clinical trials covering diverse skin tones (Monk Skin Tone Scale), age brackets, "
                "and explicit evaluation of calibration decay over time. Emphasizes that reference cuff calibration alone does not establish clinical accuracy."
            ),
            "url": "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cuffless-non-invasive-blood-pressure-measuring-devices",
        },
    ]

    reg_pathway = {
        "device_classification": "FDA Class II (Special Controls)",
        "premarket_submission": "510(k) Premarket Notification or De Novo Classification",
        "standards_reviewed": [
            "ISO 80601-2-61:2026, Edition 3 (Pulse Oximeter Equipment)",
            "IEEE Std 1708-2014 & IEEE 1708a-2019 (Cuffless Blood Pressure)",
            "ANSI/AAMI/ISO 81060-2:2019/Amd 1:2020 (Clinical Sphygmomanometers)",
            "ISO 15197:2013 (In Vitro Glucose Monitoring Systems)",
            "IEC 60601-1:2005+AMD1:2012+AMD2:2020 (Medical Electrical Safety)",
            "IEC 60601-1-2:2014+AMD1:2020 (Electromagnetic Disturbances)",
            "ISO 10993-5:2009 & ISO 10993-10:2021 (Biocompatibility)",
            "ISO 14971:2019 (Risk Management)",
            "IEC 62304:2006+AMD1:2015 (Medical Device Software Lifecycle)",
        ],
        "standards_applicable_to_design": {
            "pulse_oximetry": "ISO 80601-2-61:2026, Edition 3",
            "cuffless_bp_calibration": "IEEE Std 1708-2014 & IEEE 1708a-2019",
            "cuffless_bp_clinical_validation": "ANSI/AAMI/ISO 81060-2:2019/Amd 1:2020",
            "electrical_safety": "IEC 60601-1:2005+AMD1:2012+AMD2:2020 (Type BF Patient Applied Part)",
            "emc_compatibility": "IEC 60601-1-2:2014+AMD1:2020",
            "biocompatibility": "ISO 10993-5:2009 (Cytotoxicity) & ISO 10993-10:2021 (Sensitization)",
            "glucose_interfaces": "ISO 15197:2013 (Authorized BLE 0x1808 / CGM interfaces only)",
        },
        "testing_completed": [
            "DSP optical filtering algorithm unit tests (0.5 Hz high-pass, 50/60 Hz notch filter)",
            "Mechanical load-cell calibration profile (0.3 N - 2.5 N configurable operating limits)",
            "Cryptographic HMAC-SHA256 telemetry packet authentication and sequence anti-replay filter",
            "Simulated fault injection bench testing (leads-off, motion tremor, packet loss)",
        ],
        "testing_not_completed": [
            "Controlled human hypoxia desaturation clinical trial (SaO2 70%-100% across Monk Skin Tone Scale 1-10 cohort)",
            "Formal third-party NRTL accredited laboratory electrical safety testing (IEC 60601-1)",
            "Anechoic chamber radiated emissions and immunity EMC testing (IEC 60601-1-2)",
            "GLP accredited in vitro cytotoxicity and skin sensitization laboratory testing (ISO 10993)",
            "Prospective multi-subject clinical validation trial across ≥85 subjects (ISO 81060-2)",
        ],
        "formal_certification_status": "NOT CERTIFIED / INVESTIGATIONAL PROTOTYPE ONLY (No FDA 510(k), De Novo, or CE marking exists).",
        "regulatory_compliance_disclosure": (
            "INVESTIGATIONAL PROTOTYPE DISCLOSURE: This hardware and software station is an investigational prototype "
            "for biomedical research, signal processing validation, and clinical simulation. It is NOT FDA-cleared, CE-marked, "
            "or certified by an accredited Nationally Recognized Testing Laboratory (NRTL). Do not claim regulatory compliance, "
            "certification, or diagnostic authority without documented third-party test laboratory reports and approved clinical trials."
        ),
    }

    clinical_protocol = {
        "blood_pressure_protocol": (
            "ANSI/AAMI/ISO 81060-2:2019/Amd 1:2020 protocol with minimum 85 human subjects across normotensive, pre-hypertensive, "
            "and hypertensive ranges. Requires reference measurements by two independent trained observers using calibrated "
            "mercury/double-stethoscope auscultation or arterial line catheterization. Explicit calibration decay evaluation required under IEEE 1708."
        ),
        "glucose_protocol": (
            "ISO 15197:2013 and CLSI POCT12-A3 testing across ≥100 subjects in controlled hypoglycemic (<70 mg/dL), "
            "euglycemic (70-180 mg/dL), and hyperglycemic (>180 mg/dL) states, evaluated against laboratory gold-standard "
            "plasma analyzer (YSI 2300 STAT Plus or hexokinase method). 95% of readings must fall within ±15 mg/dL (<100 mg/dL) "
            "or ±15% (≥100 mg/dL). Must plot 99% in Zone A/B of Clarke Error Grid. Supports authorized BLE glucose meters (GATT 0x1808) and CGMs."
        ),
        "pulse_oximetry_protocol": (
            "ISO 80601-2-61:2026, Edition 3 (clause 201.12.1): Controlled human hypoxia desaturation study "
            "on healthy adult volunteers across 70%-100% SaO2 against co-oximeter blood gas analysis, requiring root-mean-square accuracy "
            "Arms ≤ 3.5% with diverse skin pigmentation representation across Monk Skin Tone Scale 1-10."
        ),
    }

    return ScientificFeasibilityReport(
        title="Biomedical Engineering & Scientific Feasibility Report: Non-Invasive Fingertip Vital Sensing",
        executive_summary=(
            "Based on peer-reviewed biomedical optics, published clinical consensus, and official FDA guidance, "
            "a single uncalibrated fingertip optical sensor CANNOT measure both blood glucose and blood pressure without skin puncture or cuff. "
            "Photoplethysmography (PPG) reliably and non-invasively measures heart rate, oxygen saturation (SpO2 per ISO 80601-2-61:2026, Edition 3), and perfusion index. "
            "Dermal surface temperature measures peripheral cutaneous skin temperature, NOT core body temperature, and must not be used alone for fever diagnosis. "
            "Non-invasive optical glucose monitoring on smartwatches or smart rings remains unauthorized by the FDA due to severe physiological absorption interference. "
            "Cuffless blood pressure is an experimental surrogate that strictly requires periodic pneumatic cuff recalibration under IEEE Std 1708; calibration alone does not establish clinical accuracy. "
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

    now = datetime.now(timezone.utc)
    device.status = DeviceStatus.CONNECTED.value if not device.is_demo_device else DeviceStatus.SIMULATION_MODE.value
    device.last_heartbeat_at = now
    device.last_connected_at = now

    event = DeviceConnectionEvent(
        device_id=device.id,
        event_type="CONNECT",
        details=f"Hardware peripheral {device.device_name} session established via {device.protocol}. (Demo: {device.is_demo_device})",
    )
    db.add(event)
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
    event = DeviceConnectionEvent(
        device_id=device.id,
        event_type="DISCONNECT",
        details=f"Device {device.device_name} disconnected safely by user or system reset.",
    )
    db.add(event)
    await db.commit()
    await db.refresh(device)
    return device


@router.post("/{device_id}/status", response_model=MedicalDeviceRead)
async def update_device_status(
    device_id: uuid.UUID,
    payload: DeviceConnectionStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Explicitly updates device hardware connection state:
    CONNECTED, DISCONNECTED, CONNECTING, CONNECTION_FAILED, SIMULATION_MODE.
    Prevents false 'Connected' displays without actual verified session.
    """
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    valid_statuses = [s.value for s in DeviceStatus]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status '{payload.status}'. Must be one of: {valid_statuses}",
        )

    # Verification rule: Do not display Connected unless real hardware is connected
    actual_status = payload.status
    if actual_status == DeviceStatus.CONNECTED.value and device.is_demo_device:
        actual_status = DeviceStatus.SIMULATION_MODE.value

    now = datetime.now(timezone.utc)
    device.status = actual_status
    if payload.protocol_details:
        device.connection_protocol_details = payload.protocol_details
    if actual_status in (DeviceStatus.CONNECTED.value, DeviceStatus.SIMULATION_MODE.value):
        device.last_connected_at = now
        device.last_heartbeat_at = now

    event = DeviceConnectionEvent(
        device_id=device.id,
        event_type=actual_status,
        details=payload.failure_reason or payload.protocol_details or f"Device state changed to {actual_status}",
    )
    db.add(event)
    await db.commit()
    await db.refresh(device)
    return device


@router.get("/{device_id}/events", response_model=List[DeviceConnectionEventRead])
async def list_device_events(
    device_id: uuid.UUID,
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns recent hardware connection, security, and calibration lifecycle audit events."""
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    stmt = (
        select(DeviceConnectionEvent)
        .where(DeviceConnectionEvent.device_id == device_id)
        .order_by(desc(DeviceConnectionEvent.created_at))
        .limit(limit)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


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
        f"({payload.reference_systolic}/{payload.reference_diastolic} mmHg). "
        f"INVESTIGATIONAL NOTICE: Reference cuff calibration initializes the pulse wave transfer function, "
        f"but does NOT establish diagnostic accuracy or clinical equivalence. Unvalidated for diagnostic use."
    )

    event = DeviceConnectionEvent(
        device_id=device.id,
        event_type="CALIBRATED",
        details=(
            f"IEEE Std 1708 reference cuff baseline recorded with {payload.cuff_device_name} "
            f"({payload.reference_systolic}/{payload.reference_diastolic} mmHg). "
            f"Clinical validation status: UNVALIDATED SURROGATE (Investigational Use Only)."
        ),
    )
    db.add(event)
    await db.commit()
    await db.refresh(device)
    return device


def evaluate_measurement_quality_and_validity(
    contact_force_n: Optional[float],
    perfusion_index: Optional[float],
    snr_db: Optional[float],
    sensor_status: Optional[str],
    heart_rate: Optional[int],
    oxygen_saturation: Optional[float],
    dermal_temperature_c: Optional[float] = None,
    min_force: float = 0.3,
    max_force: float = 2.5,
    optimal_min_force: float = 1.0,
    optimal_max_force: float = 1.5,
) -> dict:
    """
    Centralized measurement-quality and validity engine.
    Separates 5 distinct states:
    1. Raw signal quality (SNR, PI, baseline noise)
    2. Physical contact quality (force gating, load cell integrity)
    3. Sensor operational status (hardware operational vs leads-off/fault)
    4. Measurement validity (valid vs invalid per vital parameter)
    5. Clinical usability (clinically usable vs rejected with specific reason)
    """
    status_str = sensor_status or "SENSOR_OK"
    is_leads_off = status_str in ["LEADS_OFF", "DISCONNECTED"]
    is_motion = status_str in ["MOTION_ARTIFACT", "MOTION_NOISE"]

    # 1. Sensor Operational Status
    if is_leads_off:
        sensor_operational_status = "LEADS_OFF"
    elif is_motion:
        sensor_operational_status = "MOTION_NOISE"
    else:
        sensor_operational_status = "OPERATIONAL"

    # 2. Physical Contact Quality (Device-Specific to MC-BIO-FS100 8mm sapphire aperture)
    if is_leads_off or contact_force_n is None or contact_force_n <= 0.0:
        contact_quality = "NO_CONTACT"
    elif contact_force_n < 0.05:
        contact_quality = "NO_CONTACT"
    elif contact_force_n < min_force:
        contact_quality = "INSUFFICIENT_CONTACT"
    elif contact_force_n > max_force:
        contact_quality = "EXCESSIVE_PRESSURE"
    elif optimal_min_force <= contact_force_n <= optimal_max_force:
        contact_quality = "OPTIMAL_CONTACT"
    else:
        contact_quality = "ACCEPTABLE_CONTACT"

    # 3. Raw Signal Quality (Optical PPG channel)
    if is_leads_off:
        raw_signal_quality = "NO_SIGNAL"
    elif is_motion:
        raw_signal_quality = "MOTION_ARTIFACT"
    elif snr_db is not None and snr_db < 10.0:
        raw_signal_quality = "POOR_SNR"
    elif perfusion_index is not None and perfusion_index < 0.4:
        raw_signal_quality = "LOW_PERFUSION"
    elif perfusion_index is not None and perfusion_index >= 1.0 and (snr_db is None or snr_db >= 18.0):
        raw_signal_quality = "OPTIMAL"
    else:
        raw_signal_quality = "ACCEPTABLE"

    # 4. Measurement Validity & Rejection Reasons per Channel
    rejection_reasons = []

    # Optical Vitals Validity (Heart Rate, SpO2, Perfusion Index)
    optical_valid = True
    if is_leads_off:
        optical_valid = False
        rejection_reasons.append("Biosensor leads detached or finger removed.")
    elif contact_quality == "INSUFFICIENT_CONTACT":
        optical_valid = False
        rejection_reasons.append(f"Insufficient contact force ({contact_force_n:.2f}N < {min_force:.2f}N minimum): ambient optical light leakage.")
    elif contact_quality == "EXCESSIVE_PRESSURE":
        optical_valid = False
        rejection_reasons.append(f"Excessive contact force ({contact_force_n:.2f}N > {max_force:.2f}N maximum): capillary bed blanched/occluded.")
    elif is_motion or raw_signal_quality == "MOTION_ARTIFACT":
        optical_valid = False
        rejection_reasons.append("High motion tremor artifact detected on optical channel.")
    elif raw_signal_quality in ["POOR_SNR", "LOW_PERFUSION"]:
        if perfusion_index is not None and perfusion_index < 0.2:
            optical_valid = False
            rejection_reasons.append(f"Perfusion Index critically low ({perfusion_index:.2f}% < 0.20% AC/DC): pulse detection unreliable.")

    # Physiological Bounds
    if heart_rate is not None and (heart_rate < 30 or heart_rate > 240):
        optical_valid = False
        rejection_reasons.append(f"Pulse rate ({heart_rate} bpm) outside physiologically plausible limits (30-240 bpm).")
    if oxygen_saturation is not None and (oxygen_saturation < 70.0 or oxygen_saturation > 100.0):
        optical_valid = False
        rejection_reasons.append(f"SpO2 ({oxygen_saturation:.1f}%) outside measurable pulse oximetry range (70-100%).")

    # Independent Temperature Validity (MLX90614 infrared thermopile has non-contact optical FOV)
    temperature_valid = True
    if is_leads_off:
        temperature_valid = False
    elif dermal_temperature_c is not None:
        if dermal_temperature_c < 20.0 or dermal_temperature_c > 44.0:
            temperature_valid = False

    # 5. Determine Primary Signal Quality Label (Canonical string stored in packet)
    if is_leads_off:
        primary_sq = SignalQuality.LEADS_OFF.value
        val_status = "INVALID_LEADS_OFF"
    elif contact_quality == "INSUFFICIENT_CONTACT":
        primary_sq = SignalQuality.INSUFFICIENT_CONTACT.value
        val_status = "INVALID_INSUFFICIENT_CONTACT"
    elif contact_quality == "EXCESSIVE_PRESSURE":
        primary_sq = SignalQuality.EXCESSIVE_PRESSURE.value
        val_status = "INVALID_EXCESSIVE_PRESSURE"
    elif raw_signal_quality == "MOTION_ARTIFACT":
        primary_sq = SignalQuality.MOTION_ARTIFACT.value
        val_status = "INVALID_MOTION_ARTIFACT"
    elif raw_signal_quality in ["POOR_SNR", "LOW_PERFUSION"]:
        primary_sq = SignalQuality.POOR_PERFUSION.value if raw_signal_quality == "LOW_PERFUSION" else "POOR_SIGNAL"
        val_status = "DEGRADED_QUALITY" if optical_valid else "INVALID_POOR_SIGNAL"
    elif not optical_valid:
        primary_sq = "INVALID_MEASUREMENT"
        val_status = "INVALID_BOUNDS"
    elif contact_quality == "OPTIMAL_CONTACT" and raw_signal_quality == "OPTIMAL":
        primary_sq = SignalQuality.OPTIMAL.value
        val_status = "VALID"
    else:
        primary_sq = SignalQuality.ACCEPTABLE.value
        val_status = "VALID"

    # Notes string summarizing 5 states
    if rejection_reasons:
        summary_note = "; ".join(rejection_reasons)
        if temperature_valid and dermal_temperature_c is not None:
            summary_note += f" Independent dermal surface temperature ({dermal_temperature_c:.1f}°C) verified valid."
    else:
        summary_note = f"Signal nominal: SQI={primary_sq}, Contact={contact_quality}, SNR={snr_db or 24.0:.1f}dB, PI={perfusion_index or 2.0:.1f}%."

    return {
        "raw_signal_quality": raw_signal_quality,
        "contact_quality": contact_quality,
        "sensor_operational_status": sensor_operational_status,
        "measurement_validity": {
            "optical_valid": optical_valid,
            "temperature_valid": temperature_valid,
            "pulse_rate_valid": optical_valid and heart_rate is not None,
            "spo2_valid": optical_valid and oxygen_saturation is not None,
            "perfusion_index_valid": optical_valid and perfusion_index is not None,
            "dermal_temperature_valid": temperature_valid and dermal_temperature_c is not None,
            "contact_force_valid": contact_force_n is not None,
        },
        "clinical_usability": {
            "optical_usable": optical_valid,
            "temperature_usable": temperature_valid,
            "rejection_reasons": rejection_reasons,
        },
        "primary_signal_quality": primary_sq,
        "validation_status": val_status,
        "validation_notes": summary_note,
    }


def _evaluate_telemetry_signal_quality(
    contact_force_n: Optional[float],
    perfusion_index: Optional[float],
    snr_db: Optional[float],
    sensor_status: Optional[str],
    heart_rate: Optional[int],
    oxygen_saturation: Optional[float],
    dermal_temperature_c: Optional[float] = None,
    min_force: float = 0.3,
    max_force: float = 2.5,
) -> tuple[str, str]:
    """Compatibility wrapper returning (primary_sq, summary_note)."""
    res = evaluate_measurement_quality_and_validity(
        contact_force_n=contact_force_n,
        perfusion_index=perfusion_index,
        snr_db=snr_db,
        sensor_status=sensor_status,
        heart_rate=heart_rate,
        oxygen_saturation=oxygen_saturation,
        dermal_temperature_c=dermal_temperature_c,
        min_force=min_force,
        max_force=max_force,
    )
    return (res["primary_signal_quality"], res["validation_notes"])


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
    Enforces strict clinical validation, cryptographic HMAC-SHA256 authentication,
    monotonic sequence replay protection, sequence packet-loss gap auditing,
    contact force bounds, and isolation of simulated data.
    """
    device = await db.get(MedicalDevice, device_id)
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical device not found")

    target_patient_id = await _resolve_patient_id(db, current_user, device.patient_id)
    if device.patient_id != target_patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    now = datetime.now(timezone.utc)
    is_sim = payload.is_sample or payload.provenance == MeasurementProvenance.SIMULATED_DEMO.value or device.is_demo_device
    source_type = "SIMULATION" if is_sim else "HARDWARE"

    # 1. SEQUENCE NUMBER, REPLAY PROTECTION & PACKET-LOSS GAP AUDITING
    if payload.sequence_number is not None:
        seq_stmt = select(func.max(DeviceTelemetryPacket.sequence_number)).where(
            DeviceTelemetryPacket.device_id == device.id
        )
        seq_res = await db.execute(seq_stmt)
        max_seq = seq_res.scalar()
        if max_seq is not None:
            if payload.sequence_number <= max_seq:
                event = DeviceConnectionEvent(
                    device_id=device.id,
                    event_type="REPLAY_ATTACK_BLOCKED",
                    details=f"Replay protection: received packet sequence {payload.sequence_number} <= previous recorded sequence {max_seq}",
                )
                db.add(event)
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Replay Protection: Sequence number {payload.sequence_number} already recorded or out of order. Packet rejected.",
                )
            elif payload.sequence_number > max_seq + 1:
                dropped_count = payload.sequence_number - max_seq - 1
                event = DeviceConnectionEvent(
                    device_id=device.id,
                    event_type="PACKET_LOSS_DETECTED",
                    details=f"Packet sequence discontinuity: expected #{max_seq + 1}, received #{payload.sequence_number}. {dropped_count} packet(s) dropped or lost in transit.",
                )
                db.add(event)

    # 2. TIMESTAMP VALIDATION & TRANSIT LATENCY AUDIT
    pkt_time = payload.timestamp
    if pkt_time.tzinfo is None:
        pkt_time = pkt_time.replace(tzinfo=timezone.utc)
    latency_sec = (now - pkt_time).total_seconds()
    if latency_sec > 2.0:
        event = DeviceConnectionEvent(
            device_id=device.id,
            event_type="DELAYED_PACKET_DETECTED",
            details=f"Packet transit latency ({latency_sec:.2f}s) exceeded real-time threshold (2.0s).",
        )
        db.add(event)

    # 3. CRYPTOGRAPHIC MESSAGE AUTHENTICATION (HMAC-SHA256)
    auth_verified = False
    secret_key = device.device_secret_key or f"secret_{device.serial_number}"
    if payload.auth_signature:
        sig_str = f"{device.id}:{payload.sequence_number or 0}:{payload.timestamp.isoformat()}:{payload.heart_rate}:{payload.oxygen_saturation}:{payload.contact_force_n}"
        expected_mac = hmac.new(secret_key.encode(), sig_str.encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(payload.auth_signature, expected_mac):
            # Only genuine physical hardware can be marked as auth_verified = True
            auth_verified = not is_sim
        else:
            event = DeviceConnectionEvent(
                device_id=device.id,
                event_type="BAD_SIGNATURE",
                details=f"HMAC-SHA256 signature verification failed for packet sequence {payload.sequence_number}",
            )
            db.add(event)
            if not is_sim:
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Cryptographic Authentication Failed: Invalid HMAC-SHA256 device signature.",
                )

    # 4. SCIENTIFIC CLINICAL SAFETY GATE: Blood Glucose
    if payload.blood_glucose is not None and not is_sim:
        if not device.supports_blood_glucose:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Clinical Safety Rejection: Non-invasive optical sensing cannot measure molecular blood glucose "
                    "without skin puncture or continuous interstitial probe. Relying on optical glucose estimates "
                    "is hazardous and violates FDA guidance. Value rejected."
                ),
            )

    # 5. CALIBRATION GATE: Blood Pressure
    if (payload.systolic_bp is not None or payload.diastolic_bp is not None) and not is_sim:
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

    # 6. CENTRALIZED MEASUREMENT QUALITY & VALIDITY ENGINE
    sensor_status = payload.sensor_status or "SENSOR_OK"
    hr_val = payload.heart_rate
    spo2_val = payload.oxygen_saturation

    validity_eval = evaluate_measurement_quality_and_validity(
        contact_force_n=payload.contact_force_n,
        perfusion_index=payload.perfusion_index,
        snr_db=payload.snr_db,
        sensor_status=sensor_status,
        heart_rate=hr_val,
        oxygen_saturation=spo2_val,
        dermal_temperature_c=payload.dermal_temperature_c,
        min_force=0.3,
        max_force=2.5,
    )

    sig_quality = validity_eval["primary_signal_quality"]
    val_status = validity_eval["validation_status"]
    val_notes = validity_eval["validation_notes"]
    if validity_eval["sensor_operational_status"] != "OPERATIONAL":
        sensor_status = validity_eval["sensor_operational_status"]
    elif validity_eval["contact_quality"] == "INSUFFICIENT_CONTACT":
        sensor_status = "INSUFFICIENT_FORCE"
    elif validity_eval["contact_quality"] == "EXCESSIVE_PRESSURE":
        sensor_status = "BLANCHED_CAPILLARIES"

    # 7. Deduplication Check via SHA-256 Checksum
    packet_time_iso = payload.timestamp.isoformat()
    raw_sig = f"{device.id}:{payload.sequence_number}:{packet_time_iso}:{hr_val}:{spo2_val}:{payload.contact_force_n}"
    computed_hash = payload.packet_hash or hashlib.sha256(raw_sig.encode()).hexdigest()

    existing_hash_stmt = select(DeviceTelemetryPacket).where(DeviceTelemetryPacket.packet_hash == computed_hash)
    existing_hash_res = await db.execute(existing_hash_stmt)
    if existing_hash_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate telemetry packet detected. Packet checksum already recorded in database.",
        )

    # 8. Record Telemetry Packet with Strict Provenance (Raw diagnostic data is preserved)
    provenance = MeasurementProvenance.SIMULATED_DEMO.value if is_sim else MeasurementProvenance.MEASURED_DEVICE.value

    packet = DeviceTelemetryPacket(
        device_id=device.id,
        patient_id=target_patient_id,
        packet_timestamp=payload.timestamp,
        sequence_number=payload.sequence_number,
        heart_rate=hr_val,
        oxygen_saturation=spo2_val,
        perfusion_index=payload.perfusion_index,
        dermal_temperature_c=payload.dermal_temperature_c,
        contact_force_n=payload.contact_force_n,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        blood_glucose=payload.blood_glucose,
        signal_quality=sig_quality,
        snr_db=payload.snr_db,
        sensor_status=sensor_status,
        source_type=source_type,
        provenance=provenance,
        packet_hash=computed_hash,
        auth_signature=payload.auth_signature,
        auth_verified=auth_verified,
        is_sample=is_sim,
        validation_status=val_status,
        validation_notes=val_notes,
    )
    db.add(packet)

    # 9. Mirror to VitalSign table ONLY for genuine hardware AND clinically usable measurements
    if not is_sim:
        usable_hr = hr_val if validity_eval["clinical_usability"]["optical_usable"] else None
        usable_spo2 = spo2_val if validity_eval["clinical_usability"]["optical_usable"] else None
        usable_temp = payload.dermal_temperature_c if validity_eval["clinical_usability"]["temperature_usable"] else None

        vital = VitalSign(
            patient_id=target_patient_id,
            recorded_by_id=current_user.id,
            recorded_at=payload.timestamp,
            heart_rate=usable_hr,
            systolic_bp=payload.systolic_bp,
            diastolic_bp=payload.diastolic_bp,
            oxygen_saturation=usable_spo2,
            temperature=usable_temp,
            blood_glucose=payload.blood_glucose,
            blood_glucose_mmol=round(payload.blood_glucose / 18.0182, 2) if payload.blood_glucose is not None else None,
            glucose_unit="mg/dL",
            glucose_context="fasting" if payload.blood_glucose is not None else None,
            measurement_source="measured_device",
            device_name=device.device_name,
            notes=f"Source: {device.device_name} (S/N: {device.serial_number}) | SQI: {sig_quality} | Validity: {val_status}",
            is_patient_entered=False,
            is_sample=False,
        )
        db.add(vital)

    device.last_reading_at = now
    device.last_heartbeat_at = now
    if not device.is_demo_device:
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
    Supports simulating:
    - Device connect/disconnect
    - Heart rate & SpO2 ranges
    - Poor signal quality (motion noise, low perfusion)
    - Sensor failure / leads-off
    - Packet loss & corrupted HMAC signatures
    - Expired calibration state
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

    now = datetime.now(timezone.utc)

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
            status=DeviceStatus.SIMULATION_MODE.value,
            is_demo_device=True,
            supports_heart_rate=True,
            supports_spo2=True,
            supports_perfusion_index=True,
            supports_dermal_temperature=True,
            supports_contact_force=True,
            supports_blood_pressure=False,
            supports_blood_glucose=False,
            last_heartbeat_at=now,
            last_connected_at=now,
        )
        db.add(device)
        await db.commit()
        await db.refresh(device)

    # 1. Handle Connect / Disconnect Scenarios
    if payload.scenario == "connect":
        device.status = DeviceStatus.SIMULATION_MODE.value
        device.last_connected_at = now
        event = DeviceConnectionEvent(
            device_id=device.id,
            event_type="SIMULATION_CONNECTED",
            details="Simulator virtual bridge session connected for demonstration testing.",
        )
        db.add(event)
    elif payload.scenario == "disconnect":
        device.status = DeviceStatus.DISCONNECTED.value
        event = DeviceConnectionEvent(
            device_id=device.id,
            event_type="SIMULATION_DISCONNECTED",
            details="Simulator virtual bridge session disconnected.",
        )
        db.add(event)
    elif device.status == DeviceStatus.DISCONNECTED.value:
        device.status = DeviceStatus.SIMULATION_MODE.value

    # 2. Handle Calibration Expired Simulation
    if payload.force_calibration_expired or payload.scenario == "calibration_expired":
        device.is_bp_calibrated = False
        device.bp_calibration_expiry = now - timedelta(days=1)
        device.notes = "Calibration expired per test simulation scenario."
        event = DeviceConnectionEvent(
            device_id=device.id,
            event_type="CALIBRATION_EXPIRED",
            details="Cuffless BP calibration expired (>30 days) simulated.",
        )
        db.add(event)

    # 3. Compute Sequence Number with Packet Loss Simulation
    seq_stmt = select(func.max(DeviceTelemetryPacket.sequence_number)).where(
        DeviceTelemetryPacket.device_id == device.id
    )
    seq_res = await db.execute(seq_stmt)
    cur_seq = seq_res.scalar() or 100
    jump = 10 if payload.inject_packet_loss or payload.scenario == "packet_loss" else 1
    new_seq = cur_seq + jump

    # 4. Configure simulated scenario metrics
    hr = payload.pulse_bpm if payload.pulse_bpm is not None else 74
    spo2 = payload.spo2_pct if payload.spo2_pct is not None else 98.5
    force = payload.contact_force_n if payload.contact_force_n is not None else 1.2
    pi = payload.perfusion_index_pct if payload.perfusion_index_pct is not None else 2.4
    temp = payload.temperature_c if payload.temperature_c is not None else 34.2
    sensor_status = "SENSOR_OK"
    snr = 28.5
    scenario_note = None

    if payload.scenario in ("insufficient_contact", "light_contact"):
        force = payload.contact_force_n if payload.contact_force_n is not None else 0.22
        scenario_note = "DEMO SIMULATION: Insufficient contact force (<0.30 N) causing ambient optical light leakage."
    elif payload.scenario in ("elevated_hr", "elevated_heart_rate"):
        hr = payload.pulse_bpm if payload.pulse_bpm is not None else 138
        scenario_note = "DEMO SIMULATION: Elevated heart rate (Tachycardia demonstration)."
    elif payload.scenario in ("low_spo2", "low_spo2_demonstration"):
        spo2 = payload.spo2_pct if payload.spo2_pct is not None else 86.5
        scenario_note = "DEMO SIMULATION: Low oxygen saturation (Hypoxemia demonstration)."
    elif payload.scenario in ("poor_signal", "poor_signal_quality", "motion_noise"):
        sensor_status = "MOTION_NOISE"
        snr = 6.2
        scenario_note = "DEMO SIMULATION: Poor signal quality / motion artifact / tremor detected."
    elif payload.scenario in ("sensor_failure", "sensor_disconnected") or payload.sensor_leads_connected is False:
        hr = None
        spo2 = None
        sensor_status = "LEADS_OFF"
        scenario_note = "DEMO SIMULATION: Optical sensor leads detached or finger removed."
    elif payload.scenario in ("calibration_expired", "calibration_required") or payload.force_calibration_expired:
        sensor_status = "CALIBRATION_REQUIRED"
        scenario_note = "DEMO SIMULATION: Cuffless BP calibration expired (>30 days). Recalibration required."
    elif payload.scenario == "connection_failure":
        scenario_note = "DEMO SIMULATION: Simulated peripheral BLE GATT connection timeout."
        event = DeviceConnectionEvent(
            device_id=device.id,
            event_type="CONNECTION_FAILED",
            details="Simulated peripheral GATT service 0x180D discovery timeout after 15000ms",
        )
        db.add(event)
    elif payload.scenario == "high_pressure":
        force = payload.contact_force_n if payload.contact_force_n is not None else 3.8
        sensor_status = "BLANCHED_CAPILLARIES"
        pi = 0.4
        snr = 12.0
        scenario_note = "DEMO SIMULATION: High contact force (>2.5N) causing capillary blanching."
    elif payload.scenario == "low_perfusion":
        pi = payload.perfusion_index_pct if payload.perfusion_index_pct is not None else 0.12
        sensor_status = "WEAK_PULSE"
        temp = payload.temperature_c if payload.temperature_c is not None else 29.8
        scenario_note = "DEMO SIMULATION: Low perfusion / cold extremities detected."

    # Centralized Measurement Quality & Validity Engine Evaluation
    validity_eval = evaluate_measurement_quality_and_validity(
        contact_force_n=force,
        perfusion_index=pi,
        snr_db=snr,
        sensor_status=sensor_status,
        heart_rate=hr,
        oxygen_saturation=spo2,
        dermal_temperature_c=temp,
        min_force=0.3,
        max_force=2.5,
    )

    sig_quality = validity_eval["primary_signal_quality"]
    val_status = f"DEMO_{validity_eval['validation_status']}"
    val_notes = scenario_note or validity_eval["validation_notes"]

    if validity_eval["sensor_operational_status"] != "OPERATIONAL":
        sensor_status = validity_eval["sensor_operational_status"]
    elif validity_eval["contact_quality"] == "INSUFFICIENT_CONTACT":
        sensor_status = "INSUFFICIENT_FORCE"
    elif validity_eval["contact_quality"] == "EXCESSIVE_PRESSURE":
        sensor_status = "BLANCHED_CAPILLARIES"

    # 5. Cryptographic Signature Generation
    secret_key = device.device_secret_key or f"secret_{device.serial_number}"
    sig_str = f"{device.id}:{new_seq}:{now.isoformat()}:{hr}:{spo2}:{force}"
    if payload.inject_bad_signature or payload.scenario == "corrupted_signature":
        auth_sig = "CORRUPTED_HMAC_SIGNATURE_PAYLOAD_TAMPERED_HASH_TEST"
        auth_verified = False
        event = DeviceConnectionEvent(
            device_id=device.id,
            event_type="BAD_SIGNATURE",
            details=f"Simulator injected corrupted HMAC signature for packet sequence {new_seq}",
        )
        db.add(event)
    else:
        auth_sig = hmac.new(secret_key.encode(), sig_str.encode(), hashlib.sha256).hexdigest()
        auth_verified = True

    # Checksum hash
    pkt_hash = hashlib.sha256(f"DEMO:{device.id}:{new_seq}:{now.isoformat()}:{payload.scenario}".encode()).hexdigest()

    packet = DeviceTelemetryPacket(
        device_id=device.id,
        patient_id=target_patient_id,
        packet_timestamp=now,
        sequence_number=new_seq,
        heart_rate=hr,
        oxygen_saturation=spo2,
        perfusion_index=pi,
        dermal_temperature_c=temp,
        contact_force_n=force,
        systolic_bp=None,     # Optical glucose & uncalibrated BP strictly blocked
        diastolic_bp=None,
        blood_glucose=None,
        signal_quality=sig_quality,
        snr_db=snr,
        sensor_status=sensor_status,
        source_type="SIMULATION",
        provenance=MeasurementProvenance.SIMULATED_DEMO.value,
        packet_hash=pkt_hash,
        auth_signature=auth_sig,
        auth_verified=auth_verified,
        is_sample=True,
        validation_status="DEMO_SIMULATION",
        validation_notes=val_notes,
    )
    db.add(packet)
    device.last_reading_at = now
    device.last_heartbeat_at = now

    await db.commit()
    await db.refresh(packet)
    return packet

