"""
Device Station & VitalSense Ecosystem API Router.
Handles Apple Health (Apple Watch), Android Health Connect (Galaxy Watch & Wear OS),
MediCare Mobile Companion, and VitalSense Overview telemetry.
"""
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.connected_device import (
    ConnectedDevice,
    ConnectedDeviceType,
    ConnectedDeviceStatus,
    MeasurementCategory,
    HealthMeasurement,
    DeviceSyncHistory,
    HealthPermission,
    HealthNotification,
)
from app.models.vital_sign import VitalSign, VitalAlert, AlertSeverity, AlertStatus

router = APIRouter(prefix="/device-station", tags=["Device Station & VitalSense"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PermissionItem(BaseModel):
    category: str
    label: str
    description: str
    is_granted: bool
    granted_at: Optional[datetime] = None


class EcosystemStatus(BaseModel):
    integration_type: str # "apple_health", "android_health_connect", "medicare_mobile_app"
    name: str
    brand: str
    status: str # "CONNECTED", "DISCONNECTED", "PENDING_AUTH"
    is_connected: bool
    last_synced_at: Optional[datetime] = None
    supported_devices: List[str]
    available_data_types: List[str]
    device_id: Optional[str] = None
    pairing_code: Optional[str] = None
    qr_code_payload: Optional[str] = None
    permissions: List[PermissionItem] = []


class DeviceStationSummaryResponse(BaseModel):
    patient_id: str
    patient_name: str
    ecosystems: List[EcosystemStatus]
    is_demo_mode: bool
    active_device_count: int
    last_overall_sync: Optional[datetime] = None


class ConnectEcosystemRequest(BaseModel):
    integration_type: str # "apple_health", "android_health_connect", "medicare_mobile_app"
    client_platform: Optional[str] = "Web"
    device_name: Optional[str] = None
    manufacturer: Optional[str] = None
    model_name: Optional[str] = None
    os_version: Optional[str] = None
    granted_categories: Optional[List[str]] = None


class DisconnectEcosystemRequest(BaseModel):
    integration_type: str
    revoke_permissions: bool = False


class UpdatePermissionRequest(BaseModel):
    integration_type: str
    permission_category: str
    is_granted: bool


class SingleMeasurementPayload(BaseModel):
    measurement_type: str # "heart_rate", "resting_heart_rate", "blood_pressure", "blood_glucose", "spo2", "steps", "sleep_duration", "respiratory_rate", "body_temperature"
    value_numeric: float
    secondary_value: Optional[float] = None # e.g. diastolic for BP
    unit: str
    measured_at: datetime
    source_device_type: str # "apple_watch", "galaxy_watch", "wear_os", "apple_health", "health_connect"
    source_device_name: str
    metadata_json: Optional[str] = None
    is_demo: bool = False


class BatchSyncRequest(BaseModel):
    integration_type: str
    client_info: Optional[str] = None
    measurements: List[SingleMeasurementPayload]


class BatchSyncResponse(BaseModel):
    sync_status: str
    records_received: int
    records_synced: int
    records_skipped_duplicate: int
    synced_at: datetime
    message: str


class SyncHistoryItem(BaseModel):
    id: str
    sync_source: str
    sync_status: str
    records_received: int
    records_synced: int
    records_skipped_duplicate: int
    error_message: Optional[str] = None
    sync_started_at: datetime
    sync_completed_at: Optional[datetime] = None
    client_info: Optional[str] = None


class TrendPoint(BaseModel):
    timestamp: str
    value: float
    secondary_value: Optional[float] = None
    source: str


class VitalOverviewCard(BaseModel):
    key: str # "heart_rate", "resting_heart_rate", etc.
    title: str
    latest_value: Optional[float] = None
    latest_secondary_value: Optional[float] = None
    unit: str
    formatted_value: str
    timestamp: Optional[datetime] = None
    formatted_timestamp: str
    source_device: str
    provenance: str
    status: str # "normal", "attention", "urgent", "no_data"
    has_data: bool
    trend: List[TrendPoint] = []
    clinical_note: Optional[str] = None


class VitalSenseOverviewResponse(BaseModel):
    title: str = "Your Connected Health Overview"
    connected_device_count: int
    connected_devices_list: List[str]
    synchronization_status: str
    last_updated_time: Optional[datetime] = None
    formatted_last_updated: str
    cards: List[VitalOverviewCard]
    is_demo_active: bool


# ── Permission Categories Definitions ─────────────────────────────────────────

DEFAULT_CATEGORIES = [
    {"category": "heart_rate", "label": "Heart Rate", "description": "Continuous and active heart rate (BPM)"},
    {"category": "resting_heart_rate", "label": "Resting Heart Rate", "description": "Resting cardiovascular baseline (BPM)"},
    {"category": "blood_pressure", "label": "Blood Pressure", "description": "Systolic and diastolic readings (mmHg)"},
    {"category": "blood_glucose", "label": "Blood Glucose", "description": "Capillary or CGM blood sugar readings (mg/dL)"},
    {"category": "spo2", "label": "Blood Oxygen (SpO2)", "description": "Peripheral capillary oxygen saturation (%)"},
    {"category": "steps", "label": "Daily Steps", "description": "Pedometry and active physical mobility count"},
    {"category": "sleep_duration", "label": "Sleep Duration", "description": "Sleep session tracking and sleep architecture (hours)"},
    {"category": "respiratory_rate", "label": "Respiratory Rate", "description": "Resting respiratory cycles (breaths/min)"},
    {"category": "body_temperature", "label": "Body Temperature", "description": "Wrist or dermal skin temperature (°C)"},
]


async def _resolve_patient_id(user: User, db: AsyncSession) -> uuid.UUID:
    """Resolve patient ID for current user or default demo patient."""
    res = await db.execute(select(Patient).where(Patient.user_id == user.id))
    patient = res.scalar_one_or_none()
    if patient:
        return patient.id

    # Fallback to first existing patient if doctor/admin testing or demo
    fallback_res = await db.execute(select(Patient).order_by(Patient.created_at.asc()).limit(1))
    fallback = fallback_res.scalar_one_or_none()
    if fallback:
        return fallback.id

    raise HTTPException(status_code=404, detail="No patient account found for current session")


def _generate_reading_hash(patient_id: uuid.UUID, measurement_type: str, measured_at: datetime, value: float) -> str:
    """Generate deterministic SHA-256 hash to prevent duplicate ingestion."""
    raw = f"{str(patient_id)}:{measurement_type}:{measured_at.isoformat()}:{round(value, 2)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status", response_model=DeviceStationSummaryResponse)
async def get_device_station_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns full status for Apple Health, Android Health Connect, and MediCare Mobile App.
    """
    patient_id = await _resolve_patient_id(current_user, db)
    patient_res = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = patient_res.scalar_one_or_none()

    # Query registered connected devices
    dev_res = await db.execute(
        select(ConnectedDevice).where(ConnectedDevice.patient_id == patient_id)
    )
    devices = dev_res.scalars().all()
    device_map = {d.device_type: d for d in devices}

    # Query health permissions
    perm_res = await db.execute(
        select(HealthPermission).where(HealthPermission.patient_id == patient_id)
    )
    all_perms = perm_res.scalars().all()
    perm_map = {(p.integration_type, p.permission_category): p.is_granted for p in all_perms}

    # Helper to build permission list
    def build_perms(integration: str) -> List[PermissionItem]:
        items = []
        for c in DEFAULT_CATEGORIES:
            cat = c["category"]
            granted = perm_map.get((integration, cat), True) # Default granted upon connection
            items.append(
                PermissionItem(
                    category=cat,
                    label=c["label"],
                    description=c["description"],
                    is_granted=granted,
                )
            )
        return items

    # Check for demo data
    demo_check = await db.execute(
        select(func.count(HealthMeasurement.id)).where(
            and_(HealthMeasurement.patient_id == patient_id, HealthMeasurement.is_demo == True)
        )
    )
    is_demo_active = (demo_check.scalar() or 0) > 0

    # 1. Apple Ecosystem
    apple_dev = device_map.get("apple_health") or device_map.get("apple_watch")
    apple_status = EcosystemStatus(
        integration_type="apple_health",
        name="Apple Health & Apple Watch",
        brand="Apple HealthKit",
        status=apple_dev.status if apple_dev else "DISCONNECTED",
        is_connected=apple_dev.is_connected if apple_dev else False,
        last_synced_at=apple_dev.last_synced_at if apple_dev else None,
        supported_devices=["Apple Watch Ultra 2", "Apple Watch Series 9", "Apple Watch Series 8", "Apple Watch SE", "iPhone Health App"],
        available_data_types=["Heart Rate", "Resting Heart Rate", "Blood Oxygen (SpO2)", "Daily Steps", "Sleep Stages", "Respiratory Rate", "Wrist Temperature"],
        device_id=str(apple_dev.id) if apple_dev else None,
        pairing_code=apple_dev.pairing_identifier if apple_dev else None,
        permissions=build_perms("apple_health"),
    )

    # 2. Android Ecosystem
    android_dev = device_map.get("android_health_connect") or device_map.get("samsung_galaxy_watch")
    android_status = EcosystemStatus(
        integration_type="android_health_connect",
        name="Android Health Connect & Galaxy Watch",
        brand="Google & Samsung Health",
        status=android_dev.status if android_dev else "DISCONNECTED",
        is_connected=android_dev.is_connected if android_dev else False,
        last_synced_at=android_dev.last_synced_at if android_dev else None,
        supported_devices=["Samsung Galaxy Watch 6 / 5", "Google Pixel Watch 2", "OnePlus Watch 2", "Wear OS 4 Devices", "Android Health Connect"],
        available_data_types=["Heart Rate", "Resting Heart Rate", "Blood Pressure (Calibrated)", "Blood Oxygen (SpO2)", "Daily Steps", "Sleep Duration", "Body Temperature"],
        device_id=str(android_dev.id) if android_dev else None,
        pairing_code=android_dev.pairing_identifier if android_dev else None,
        permissions=build_perms("android_health_connect"),
    )

    # 3. MediCare Mobile App
    mobile_dev = device_map.get("medicare_mobile_app")
    pairing_code = f"MC-{str(patient_id)[:8].upper()}"
    qr_payload = json.dumps({
        "issuer": "MediCare AI",
        "patient_id": str(patient_id),
        "endpoint": "https://medicare-ai-iv31.onrender.com/api/v1/device-station",
        "pairing_code": pairing_code,
    })
    mobile_status = EcosystemStatus(
        integration_type="medicare_mobile_app",
        name="MediCare Mobile Companion",
        brand="MediCare AI Mobile (iOS & Android)",
        status=mobile_dev.status if mobile_dev else ("CONNECTED" if (apple_dev or android_dev) else "DISCONNECTED"),
        is_connected=mobile_dev.is_connected if mobile_dev else bool(apple_dev or android_dev),
        last_synced_at=mobile_dev.last_synced_at if mobile_dev else (apple_dev.last_synced_at if apple_dev else (android_dev.last_synced_at if android_dev else None)),
        supported_devices=["iOS 16+ (iPhone)", "Android 10+ (Smartphones)", "Expo Native Bridge"],
        available_data_types=["Realtime Sync", "Push Health Alerts", "AI Symptom Checker", "VitalSense Dashboard", "Prescription Reminders"],
        device_id=str(mobile_dev.id) if mobile_dev else None,
        pairing_code=pairing_code,
        qr_code_payload=qr_payload,
        permissions=[],
    )

    active_count = sum(1 for e in [apple_status, android_status, mobile_status] if e.is_connected)
    timestamps = [e.last_synced_at for e in [apple_status, android_status, mobile_status] if e.last_synced_at]
    latest_sync = max(timestamps) if timestamps else None

    return DeviceStationSummaryResponse(
        patient_id=str(patient_id),
        patient_name=current_user.full_name or "Authorized Patient",
        ecosystems=[apple_status, android_status, mobile_status],
        is_demo_mode=is_demo_active,
        active_device_count=active_count,
        last_overall_sync=latest_sync,
    )


@router.post("/connect", response_model=EcosystemStatus)
async def connect_ecosystem(
    req: ConnectEcosystemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Connects or registers an ecosystem integration for the patient.
    """
    patient_id = await _resolve_patient_id(current_user, db)
    
    # Check if already registered
    res = await db.execute(
        select(ConnectedDevice).where(
            and_(ConnectedDevice.patient_id == patient_id, ConnectedDevice.device_type == req.integration_type)
        )
    )
    device = res.scalar_one_or_none()

    display_name = req.device_name
    manufacturer = req.manufacturer
    if not display_name:
        if req.integration_type == "apple_health":
            display_name = "Apple Health (Apple Watch Series 9)"
            manufacturer = "Apple Inc."
        elif req.integration_type == "android_health_connect":
            display_name = "Android Health Connect (Samsung Galaxy Watch 6)"
            manufacturer = "Samsung / Google"
        else:
            display_name = "MediCare Mobile App (iOS / Android)"
            manufacturer = "MediCare AI"

    if not device:
        device = ConnectedDevice(
            patient_id=patient_id,
            device_type=req.integration_type,
            device_name=display_name,
            manufacturer=manufacturer,
            model_name=req.model_name or "Standard Edition",
            os_version=req.os_version or "Latest OS",
            status=ConnectedDeviceStatus.CONNECTED.value,
            is_connected=True,
            last_synced_at=datetime.now(timezone.utc),
            client_platform=req.client_platform,
            pairing_identifier=f"PAIR-{uuid.uuid4().hex[:12].upper()}",
        )
        db.add(device)
    else:
        device.status = ConnectedDeviceStatus.CONNECTED.value
        device.is_connected = True
        device.last_synced_at = datetime.now(timezone.utc)
        device.device_name = display_name
        device.client_platform = req.client_platform

    # Initialize granted permissions if provided
    categories = req.granted_categories or [c["category"] for c in DEFAULT_CATEGORIES]
    for cat in categories:
        perm_res = await db.execute(
            select(HealthPermission).where(
                and_(
                    HealthPermission.patient_id == patient_id,
                    HealthPermission.integration_type == req.integration_type,
                    HealthPermission.permission_category == cat,
                )
            )
        )
        existing_perm = perm_res.scalar_one_or_none()
        if existing_perm:
            existing_perm.is_granted = True
            existing_perm.revoked_at = None
        else:
            new_perm = HealthPermission(
                patient_id=patient_id,
                connected_device_id=device.id,
                integration_type=req.integration_type,
                permission_category=cat,
                is_granted=True,
            )
            db.add(new_perm)

    # Dispatch notification
    notif = HealthNotification(
        patient_id=patient_id,
        title=f"{display_name} Connected",
        message=f"Successfully authorized {display_name}. Authorized biometric and telemetry channels are now synchronized.",
        notification_type="DEVICE_CONNECTED",
        severity="INFO",
    )
    db.add(notif)
    await db.commit()
    await db.refresh(device)

    return EcosystemStatus(
        integration_type=device.device_type,
        name=device.device_name,
        brand=device.manufacturer or "Health Ecosystem",
        status=device.status,
        is_connected=device.is_connected,
        last_synced_at=device.last_synced_at,
        supported_devices=["Apple Watch Series 9", "Galaxy Watch 6", "Wear OS", "Mobile App"],
        available_data_types=["Heart Rate", "Resting HR", "SpO2", "Steps", "Sleep", "Temperature"],
        device_id=str(device.id),
        pairing_code=device.pairing_identifier,
        permissions=[],
    )


@router.post("/disconnect")
async def disconnect_ecosystem(
    req: DisconnectEcosystemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Disconnects integration and optionally revokes active permissions.
    """
    patient_id = await _resolve_patient_id(current_user, db)
    res = await db.execute(
        select(ConnectedDevice).where(
            and_(ConnectedDevice.patient_id == patient_id, ConnectedDevice.device_type == req.integration_type)
        )
    )
    device = res.scalar_one_or_none()
    if device:
        device.status = ConnectedDeviceStatus.DISCONNECTED.value
        device.is_connected = False
        device.updated_at = datetime.now(timezone.utc)

    if req.revoke_permissions:
        perms_res = await db.execute(
            select(HealthPermission).where(
                and_(HealthPermission.patient_id == patient_id, HealthPermission.integration_type == req.integration_type)
            )
        )
        for p in perms_res.scalars().all():
            p.is_granted = False
            p.revoked_at = datetime.now(timezone.utc)

    notif = HealthNotification(
        patient_id=patient_id,
        title=f"Integration Disconnected",
        message=f"You have disconnected {req.integration_type.replace('_', ' ').title()}. Data synchronization has been paused.",
        notification_type="DEVICE_DISCONNECTED",
        severity="WARNING",
    )
    db.add(notif)
    await db.commit()
    return {"status": "success", "message": f"{req.integration_type} successfully disconnected"}


@router.post("/permissions")
async def update_health_permission(
    req: UpdatePermissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Toggles consent for a specific vital category.
    """
    patient_id = await _resolve_patient_id(current_user, db)
    perm_res = await db.execute(
        select(HealthPermission).where(
            and_(
                HealthPermission.patient_id == patient_id,
                HealthPermission.integration_type == req.integration_type,
                HealthPermission.permission_category == req.permission_category,
            )
        )
    )
    perm = perm_res.scalar_one_or_none()
    if perm:
        perm.is_granted = req.is_granted
        perm.revoked_at = None if req.is_granted else datetime.now(timezone.utc)
    else:
        perm = HealthPermission(
            patient_id=patient_id,
            integration_type=req.integration_type,
            permission_category=req.permission_category,
            is_granted=req.is_granted,
            revoked_at=None if req.is_granted else datetime.now(timezone.utc),
        )
        db.add(perm)

    await db.commit()
    return {"status": "success", "permission_category": req.permission_category, "is_granted": req.is_granted}


@router.post("/sync", response_model=BatchSyncResponse)
async def batch_sync_measurements(
    req: BatchSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Batch idempotent ingest endpoint for Apple Health, Android Health Connect, and Mobile companion.
    Uses SHA-256 reading hashes to automatically detect and discard duplicates.
    """
    patient_id = await _resolve_patient_id(current_user, db)
    
    # Locate or create parent connected device
    dev_res = await db.execute(
        select(ConnectedDevice).where(
            and_(ConnectedDevice.patient_id == patient_id, ConnectedDevice.device_type == req.integration_type)
        )
    )
    connected_dev = dev_res.scalar_one_or_none()
    if not connected_dev:
        connected_dev = ConnectedDevice(
            patient_id=patient_id,
            device_type=req.integration_type,
            device_name=f"{req.integration_type.replace('_', ' ').title()} Ingestion",
            status=ConnectedDeviceStatus.CONNECTED.value,
            is_connected=True,
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(connected_dev)
        await db.flush()

    synced_count = 0
    duplicate_count = 0
    now_utc = datetime.now(timezone.utc)
    seen_hashes = set()

    for m in req.measurements:
        r_hash = _generate_reading_hash(patient_id, m.measurement_type, m.measured_at, m.value_numeric)
        
        # Check intra-batch and database duplicate
        if r_hash in seen_hashes:
            duplicate_count += 1
            continue

        dup_check = await db.execute(
            select(HealthMeasurement.id).where(HealthMeasurement.reading_hash == r_hash)
        )
        if dup_check.scalar_one_or_none():
            duplicate_count += 1
            seen_hashes.add(r_hash)
            continue

        seen_hashes.add(r_hash)
        reading = HealthMeasurement(
            patient_id=patient_id,
            connected_device_id=connected_dev.id,
            measurement_type=m.measurement_type,
            value_numeric=m.value_numeric,
            secondary_value=m.secondary_value,
            unit=m.unit,
            measured_at=m.measured_at,
            source_device_type=m.source_device_type,
            source_device_name=m.source_device_name,
            provenance="SIMULATED_DEMO" if m.is_demo else "IMPORT_EXTERNAL",
            reading_hash=r_hash,
            is_demo=m.is_demo,
            metadata_json=m.metadata_json,
        )
        db.add(reading)
        synced_count += 1

    # Update device last sync time
    connected_dev.last_synced_at = now_utc
    connected_dev.is_connected = True
    connected_dev.status = ConnectedDeviceStatus.CONNECTED.value

    # Record sync history log
    history = DeviceSyncHistory(
        patient_id=patient_id,
        connected_device_id=connected_dev.id,
        sync_source=req.integration_type,
        sync_status="SUCCESS" if synced_count > 0 or duplicate_count > 0 else "PARTIAL",
        records_received=len(req.measurements),
        records_synced=synced_count,
        records_skipped_duplicate=duplicate_count,
        sync_started_at=now_utc,
        sync_completed_at=datetime.now(timezone.utc),
        client_info=req.client_info or "MediCare Health Ingestion Engine",
    )
    db.add(history)
    await db.commit()

    return BatchSyncResponse(
        sync_status="SUCCESS",
        records_received=len(req.measurements),
        records_synced=synced_count,
        records_skipped_duplicate=duplicate_count,
        synced_at=now_utc,
        message=f"Synchronized {synced_count} new measurements ({duplicate_count} duplicates skipped).",
    )


@router.get("/sync-history", response_model=List[SyncHistoryItem])
async def get_sync_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns synchronization audit trail for the authenticated patient.
    """
    patient_id = await _resolve_patient_id(current_user, db)
    res = await db.execute(
        select(DeviceSyncHistory)
        .where(DeviceSyncHistory.patient_id == patient_id)
        .order_by(desc(DeviceSyncHistory.sync_started_at))
        .limit(limit)
    )
    logs = res.scalars().all()
    return [
        SyncHistoryItem(
            id=str(l.id),
            sync_source=l.sync_source,
            sync_status=l.sync_status,
            records_received=l.records_received,
            records_synced=l.records_synced,
            records_skipped_duplicate=l.records_skipped_duplicate,
            error_message=l.error_message,
            sync_started_at=l.sync_started_at,
            sync_completed_at=l.sync_completed_at,
            client_info=l.client_info,
        )
        for l in logs
    ]


@router.post("/demo-seed")
async def seed_demo_wearable_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Clearly labeled synthetic demo generator for testing Apple Watch & Galaxy Watch
    measurements across all 9 VitalSense metrics without requiring physical hardware.
    """
    patient_id = await _resolve_patient_id(current_user, db)
    now = datetime.now(timezone.utc)

    # 1. Ensure Demo Apple Watch and Galaxy Watch are connected
    for dev_type, dev_name, mfg in [
        ("apple_health", "Apple Watch Series 9 (Demo Testbench)", "Apple Inc."),
        ("android_health_connect", "Samsung Galaxy Watch 6 (Demo Testbench)", "Samsung Electronics"),
        ("medicare_mobile_app", "MediCare Mobile App (Demo Simulator)", "MediCare AI"),
    ]:
        dev_res = await db.execute(
            select(ConnectedDevice).where(
                and_(ConnectedDevice.patient_id == patient_id, ConnectedDevice.device_type == dev_type)
            )
        )
        dev = dev_res.scalar_one_or_none()
        if not dev:
            dev = ConnectedDevice(
                patient_id=patient_id,
                device_type=dev_type,
                device_name=dev_name,
                manufacturer=mfg,
                status=ConnectedDeviceStatus.CONNECTED.value,
                is_connected=True,
                last_synced_at=now,
                is_demo_integration=True,
                pairing_identifier=f"DEMO-{uuid.uuid4().hex[:8].upper()}",
            )
            db.add(dev)
        else:
            dev.is_connected = True
            dev.status = ConnectedDeviceStatus.CONNECTED.value
            dev.last_synced_at = now
            dev.is_demo_integration = True

    # 2. Generate 7-day realistic trends for all 9 metrics
    measurements_to_add = []
    
    # Base profiles
    # Heart Rate (72-78 bpm)
    # Resting HR (61-64 bpm)
    # Blood Pressure (118/76 - 124/80 mmHg)
    # Blood Glucose (92 - 105 mg/dL)
    # SpO2 (98 - 99 %)
    # Steps (7,200 - 11,400 steps/day)
    # Sleep (7.2 - 8.1 hours)
    # Respiratory Rate (14 - 16 breaths/min)
    # Body Temp (36.4 - 36.8 °C)
    
    demo_specs = [
        ("heart_rate", [72, 75, 78, 71, 74, 76, 73], None, "bpm", "apple_watch", "Apple Watch Series 9 (Demo)"),
        ("resting_heart_rate", [62, 63, 61, 64, 62, 61, 62], None, "bpm", "apple_watch", "Apple Watch Series 9 (Demo)"),
        ("blood_pressure", [120, 118, 122, 119, 124, 121, 120], [78, 76, 80, 77, 82, 79, 78], "mmHg", "galaxy_watch", "Samsung Galaxy Watch 6 (Demo Cuff Calibrated)"),
        ("blood_glucose", [95.0, 92.0, 102.0, 98.0, 104.0, 96.0, 94.0], None, "mg/dL", "health_connect", "Continuous Health Connect Monitor (Demo)"),
        ("spo2", [98.5, 99.0, 98.0, 98.2, 99.1, 98.7, 98.9], None, "%", "apple_watch", "Apple Watch Series 9 (Demo)"),
        ("steps", [8420, 9150, 7800, 10240, 11300, 8900, 9650], None, "steps", "apple_watch", "Apple Watch Series 9 (Demo)"),
        ("sleep_duration", [7.4, 7.8, 6.9, 8.2, 7.5, 7.9, 7.6], None, "hours", "galaxy_watch", "Samsung Galaxy Watch 6 (Demo Sleep Stages)"),
        ("respiratory_rate", [15, 14, 16, 15, 14, 15, 15], None, "breaths/min", "apple_watch", "Apple Watch Series 9 (Demo)"),
        ("body_temperature", [36.6, 36.5, 36.7, 36.6, 36.8, 36.5, 36.6], None, "°C", "apple_watch", "Apple Watch Wrist Temperature (Demo)"),
    ]

    for metric_type, values, secondary_vals, unit, source_type, source_name in demo_specs:
        for idx, val in enumerate(values):
            reading_time = now - timedelta(days=(len(values) - 1 - idx), hours=idx * 2)
            sec_val = secondary_vals[idx] if secondary_vals else None
            r_hash = _generate_reading_hash(patient_id, metric_type, reading_time, float(val))

            # Check if hash already exists
            dup = await db.execute(select(HealthMeasurement.id).where(HealthMeasurement.reading_hash == r_hash))
            if not dup.scalar_one_or_none():
                measurements_to_add.append(
                    HealthMeasurement(
                        patient_id=patient_id,
                        measurement_type=metric_type,
                        value_numeric=float(val),
                        secondary_value=float(sec_val) if sec_val is not None else None,
                        unit=unit,
                        measured_at=reading_time,
                        source_device_type=source_type,
                        source_device_name=source_name,
                        provenance="SIMULATED_DEMO",
                        reading_hash=r_hash,
                        is_demo=True,
                    )
                )

    if measurements_to_add:
        db.add_all(measurements_to_add)

    # Add sync history record
    db.add(
        DeviceSyncHistory(
            patient_id=patient_id,
            sync_source="demo_simulator",
            sync_status="SUCCESS",
            records_received=len(measurements_to_add),
            records_synced=len(measurements_to_add),
            records_skipped_duplicate=0,
            sync_started_at=now,
            sync_completed_at=datetime.now(timezone.utc),
            client_info="Demo Hardware Simulator (Synthetic Ingestion)",
        )
    )

    await db.commit()
    return {
        "status": "success",
        "message": f"Generated {len(measurements_to_add)} synthetic wearable measurements across 9 metrics.",
        "metrics_seeded": [m[0] for m in demo_specs],
    }


@router.delete("/demo-seed")
async def clear_demo_wearable_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cleans up all synthetic demo measurements for the current patient.
    """
    patient_id = await _resolve_patient_id(current_user, db)
    await db.execute(
        delete(HealthMeasurement).where(
            and_(HealthMeasurement.patient_id == patient_id, HealthMeasurement.is_demo == True)
        )
    )
    # Also disconnect demo devices
    await db.execute(
        delete(ConnectedDevice).where(
            and_(ConnectedDevice.patient_id == patient_id, ConnectedDevice.is_demo_integration == True)
        )
    )
    await db.commit()
    return {"status": "success", "message": "Demo data successfully removed."}


@router.get("/vitalsense-overview", response_model=VitalSenseOverviewResponse)
async def get_vitalsense_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the complete "Your Connected Health Overview" payload for VitalSense:
    Connected devices, sync status, and 9 dedicated measurement cards with historical trends.
    """
    patient_id = await _resolve_patient_id(current_user, db)

    # 1. Fetch connected devices
    dev_res = await db.execute(
        select(ConnectedDevice).where(
            and_(ConnectedDevice.patient_id == patient_id, ConnectedDevice.is_connected == True)
        )
    )
    active_devices = dev_res.scalars().all()
    device_names = [d.device_name for d in active_devices]
    latest_sync_times = [d.last_synced_at for d in active_devices if d.last_synced_at]
    last_updated = max(latest_sync_times) if latest_sync_times else None

    # Check demo state
    demo_count = await db.execute(
        select(func.count(HealthMeasurement.id)).where(
            and_(HealthMeasurement.patient_id == patient_id, HealthMeasurement.is_demo == True)
        )
    )
    is_demo_active = (demo_count.scalar() or 0) > 0

    # 2. Fetch latest reading and 14-day trends for each of the 9 metrics
    card_configs = [
        {"key": "heart_rate", "title": "Heart Rate", "unit": "BPM", "fallback_table": "vital_signs", "normal_range": (60, 100)},
        {"key": "resting_heart_rate", "title": "Resting Heart Rate", "unit": "BPM", "fallback_table": None, "normal_range": (50, 80)},
        {"key": "blood_pressure", "title": "Blood Pressure", "unit": "mmHg", "fallback_table": "blood_pressure_measurements", "normal_range": (90, 120)},
        {"key": "blood_glucose", "title": "Blood Glucose", "unit": "mg/dL", "fallback_table": "glucose_measurements", "normal_range": (70, 140)},
        {"key": "spo2", "title": "Blood Oxygen (SpO2)", "unit": "%", "fallback_table": "vital_signs", "normal_range": (95, 100)},
        {"key": "steps", "title": "Daily Steps", "unit": "steps", "fallback_table": None, "normal_range": (5000, 20000)},
        {"key": "sleep_duration", "title": "Sleep Duration", "unit": "hours", "fallback_table": None, "normal_range": (7, 9)},
        {"key": "respiratory_rate", "title": "Respiratory Rate", "unit": "breaths/min", "fallback_table": "vital_signs", "normal_range": (12, 20)},
        {"key": "body_temperature", "title": "Body Temperature", "unit": "°C", "fallback_table": "vital_signs", "normal_range": (36.1, 37.2)},
    ]

    cards: List[VitalOverviewCard] = []

    for cfg in card_configs:
        metric_key = cfg["key"]
        
        # Query HealthMeasurement table for this metric
        q = (
            select(HealthMeasurement)
            .where(
                and_(
                    HealthMeasurement.patient_id == patient_id,
                    HealthMeasurement.measurement_type == metric_key,
                )
            )
            .order_by(desc(HealthMeasurement.measured_at))
            .limit(14)
        )
        res = await db.execute(q)
        readings = res.scalars().all()

        if readings:
            latest = readings[0]
            
            # Format display value
            if metric_key == "blood_pressure" and latest.secondary_value is not None:
                formatted_val = f"{int(latest.value_numeric)}/{int(latest.secondary_value)}"
            elif metric_key == "steps":
                formatted_val = f"{int(latest.value_numeric):,}"
            elif metric_key in ["heart_rate", "resting_heart_rate", "respiratory_rate"]:
                formatted_val = f"{int(latest.value_numeric)}"
            else:
                formatted_val = f"{latest.value_numeric:.1f}"

            # Evaluate status
            low, high = cfg["normal_range"]
            val_check = latest.value_numeric
            if val_check < low * 0.85 or val_check > high * 1.15:
                status_flag = "urgent"
            elif val_check < low or val_check > high:
                status_flag = "attention"
            else:
                status_flag = "normal"

            # Trend line (chronological order)
            trend_points = [
                TrendPoint(
                    timestamp=r.measured_at.strftime("%b %d"),
                    value=r.value_numeric,
                    secondary_value=r.secondary_value,
                    source=r.source_device_name,
                )
                for r in reversed(readings)
            ]

            cards.append(
                VitalOverviewCard(
                    key=metric_key,
                    title=cfg["title"],
                    latest_value=latest.value_numeric,
                    latest_secondary_value=latest.secondary_value,
                    unit=cfg["unit"],
                    formatted_value=formatted_val,
                    timestamp=latest.measured_at,
                    formatted_timestamp=latest.measured_at.strftime("%b %d, %Y at %I:%M %p"),
                    source_device=latest.source_device_name,
                    provenance=latest.provenance,
                    status=status_flag,
                    has_data=True,
                    trend=trend_points,
                    clinical_note=latest.notes,
                )
            )
        else:
            # Fallback to legacy tables (vital_signs, bp, glucose) if available
            legacy_card = await _check_legacy_vitals(patient_id, metric_key, cfg, db)
            if legacy_card:
                cards.append(legacy_card)
            else:
                # No data available
                cards.append(
                    VitalOverviewCard(
                        key=metric_key,
                        title=cfg["title"],
                        latest_value=None,
                        latest_secondary_value=None,
                        unit=cfg["unit"],
                        formatted_value="No data available",
                        timestamp=None,
                        formatted_timestamp="Awaiting device synchronization",
                        source_device="No device connected",
                        provenance="UNAVAILABLE",
                        status="no_data",
                        has_data=False,
                        trend=[],
                        clinical_note=None,
                    )
                )

    sync_status_label = "Synchronized & Active" if active_devices else "Awaiting Connection"
    if is_demo_active:
        sync_status_label = "Active (Demo Mode)"

    return VitalSenseOverviewResponse(
        title="Your Connected Health Overview",
        connected_device_count=len(active_devices),
        connected_devices_list=device_names,
        synchronization_status=sync_status_label,
        last_updated_time=last_updated,
        formatted_last_updated=last_updated.strftime("%b %d, %Y at %I:%M %p") if last_updated else "Never",
        cards=cards,
        is_demo_active=is_demo_active,
    )


async def _check_legacy_vitals(
    patient_id: uuid.UUID,
    metric_key: str,
    cfg: Dict[str, Any],
    db: AsyncSession,
) -> Optional[VitalOverviewCard]:
    """Helper to pull legacy vital sign records if wearable telemetry is not yet ingested."""
    fallback = cfg.get("fallback_table")
    if not fallback:
        return None

    if fallback == "vital_signs":
        field = None
        if metric_key == "heart_rate":
            field = VitalSign.heart_rate
        elif metric_key == "spo2":
            field = VitalSign.oxygen_saturation
        elif metric_key == "respiratory_rate":
            field = VitalSign.respiratory_rate
        elif metric_key == "body_temperature":
            field = VitalSign.temperature

        if field is not None:
            res = await db.execute(
                select(VitalSign)
                .where(and_(VitalSign.patient_id == patient_id, field != None))
                .order_by(desc(VitalSign.recorded_at))
                .limit(7)
            )
            vitals = res.scalars().all()
            if vitals:
                v = vitals[0]
                val = getattr(v, field.key)
                if val is not None:
                    trend = [
                        TrendPoint(
                            timestamp=rec.recorded_at.strftime("%b %d"),
                            value=float(getattr(rec, field.key)),
                            source=rec.device_name or "Clinical Check",
                        )
                        for rec in reversed(vitals)
                        if getattr(rec, field.key) is not None
                    ]
                    return VitalOverviewCard(
                        key=metric_key,
                        title=cfg["title"],
                        latest_value=float(val),
                        unit=cfg["unit"],
                        formatted_value=f"{val:.1f}" if isinstance(val, float) else f"{int(val)}",
                        timestamp=v.recorded_at,
                        formatted_timestamp=v.recorded_at.strftime("%b %d, %Y at %I:%M %p"),
                        source_device=v.device_name or "VitalSense Medical Log",
                        provenance=v.measurement_source,
                        status="normal",
                        has_data=True,
                        trend=trend,
                    )

    return None
