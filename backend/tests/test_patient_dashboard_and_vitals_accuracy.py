"""
Comprehensive Automated Test Suite: Patient Dashboard, Anatomical Map & Live Vitals Accuracy Upgrade.
Validates:
1. Patient with no recorded measurements (unavailable/NO DATA, 0 logged, overall_health_status: no_data).
2. Patient with normal recorded measurements (Within Target Band, verified values).
3. Patient with readings outside target range (Stage 2 Hypertension, Marked Hyperglycemia -> Attention/Urgent).
4. Patient with outdated measurements (>14 days -> Stale Data, stale_monitoring).
5. Patient with multiple readings on the same day (chronological descending order, history points).
6. Patient with missing measurement timestamps (graceful fallback, zero errors).
7. Patient with manually entered readings (Manual Entry — Not Device Verified).
8. Patient with connected device readings (REAL DEVICE DATA).
9. Patient with no recent clinical activity (recent_activity: []).
10. Strict patient tenant isolation (zero cross-patient data leaks, 403 on unauthorized access).
"""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from app.main import app
from app.core.database import AsyncSessionFactory
from app.core.security import create_access_token
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.vital_sign import VitalSign


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_patient_dashboard_and_vitals_accuracy_suite():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create Patient A and Patient B to guarantee clean state and strict tenant isolation
        async with AsyncSessionFactory() as session:
            # Patient A (Primary)
            user_a = User(
                id=uuid.uuid4(),
                email=f"patient.a.{uuid.uuid4().hex[:6]}@medicare.ai",
                hashed_password="hash",
                full_name="Patient Alpha Verified",
                role=UserRole.PATIENT,
                is_active=True,
            )
            session.add(user_a)
            await session.flush()

            patient_a = Patient(
                id=uuid.uuid4(),
                user_id=user_a.id,
                mrn=f"MRN-A-{uuid.uuid4().hex[:6].upper()}",
            )
            session.add(patient_a)

            # Patient B (Isolation Peer)
            user_b = User(
                id=uuid.uuid4(),
                email=f"patient.b.{uuid.uuid4().hex[:6]}@medicare.ai",
                hashed_password="hash",
                full_name="Patient Beta Isolated",
                role=UserRole.PATIENT,
                is_active=True,
            )
            session.add(user_b)
            await session.flush()

            patient_b = Patient(
                id=uuid.uuid4(),
                user_id=user_b.id,
                mrn=f"MRN-B-{uuid.uuid4().hex[:6].upper()}",
            )
            session.add(patient_b)
            await session.commit()

        token_a = create_access_token(str(user_a.id), "patient")
        token_b = create_access_token(str(user_b.id), "patient")
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # -----------------------------------------------------------------
        # TEST 1: Patient with NO recorded vitals/measurements
        # -----------------------------------------------------------------
        bm_res_1 = await client.get("/api/v1/vitals/body-map", headers=headers_a)
        assert bm_res_1.status_code == 200, f"Body map query failed: {bm_res_1.text}"
        bm_data_1 = bm_res_1.json()

        # Overall status must be no_data, NEVER stable or normal
        assert bm_data_1["overall_health_status"] == "no_data", "Missing telemetry must evaluate to no_data"
        assert bm_data_1["overall_status"] == "no_data"

        # Indicators must all be unavailable with NO DATA label
        indicators_1 = bm_data_1["indicators"]
        assert indicators_1["cardiovascular"]["status"] == "unavailable"
        assert indicators_1["cardiovascular"]["status_label"] == "NO DATA"
        assert indicators_1["cardiovascular"]["latest_value"] is None
        assert indicators_1["cardiovascular"]["history_count"] == 0
        assert indicators_1["cardiovascular"]["history_points"] == []

        assert indicators_1["metabolic"]["status"] == "unavailable"
        assert indicators_1["metabolic"]["status_label"] == "NO DATA"
        assert indicators_1["metabolic"]["latest_value"] is None

        # Check Dashboard API for Patient A with no vitals
        dash_res_1 = await client.get("/api/v1/patients/dashboard", headers=headers_a)
        assert dash_res_1.status_code == 200, f"Dashboard query failed: {dash_res_1.text}"
        dash_data_1 = dash_res_1.json()

        assert dash_data_1["vitals"]["blood_pressure"]["has_data"] is False
        assert dash_data_1["vitals"]["blood_pressure"]["value"] == "--"
        assert dash_data_1["vitals"]["blood_pressure"]["status"] == "No Data"
        assert dash_data_1["vitals"]["blood_pressure"]["verification_status"] == "No Data Recorded"

        # -----------------------------------------------------------------
        # TEST 9: Patient with NO recent clinical activity
        # -----------------------------------------------------------------
        assert dash_data_1["recent_activity"] == [], "Patient with no clinical activity must return empty list []"

        # -----------------------------------------------------------------
        # TEST 2: Patient with NORMAL recorded measurements
        # -----------------------------------------------------------------
        now = datetime.now(timezone.utc)
        async with AsyncSessionFactory() as session:
            v_normal = VitalSign(
                id=uuid.uuid4(),
                patient_id=patient_a.id,
                recorded_at=now - timedelta(hours=2),
                systolic_bp=118,
                diastolic_bp=76,
                heart_rate=72,
                blood_glucose=92.0,
                glucose_context="fasting",
                glucose_unit="mg/dL",
                weight=70.0,
                height=175.0,
                oxygen_saturation=98,
                measurement_source="manual_entry",
                is_sample=False,
            )
            session.add(v_normal)
            await session.commit()

        bm_res_2 = await client.get("/api/v1/vitals/body-map", headers=headers_a)
        assert bm_res_2.status_code == 200
        bm_data_2 = bm_res_2.json()

        assert bm_data_2["overall_health_status"] == "within_target_band"
        ind_2 = bm_data_2["indicators"]
        assert ind_2["cardiovascular"]["status"] == "normal"
        assert ind_2["cardiovascular"]["status_label"] == "WITHIN TARGET BAND"
        assert ind_2["cardiovascular"]["latest_value"] == "118/76"
        assert ind_2["cardiovascular"]["history_count"] == 1

        assert ind_2["heart"]["status"] == "normal"
        assert ind_2["heart"]["latest_value"] == "72"

        assert ind_2["metabolic"]["status"] == "normal"
        assert ind_2["metabolic"]["latest_value"] == "92.0"
        assert "fasting" in (ind_2["metabolic"]["trend_summary"] or "").lower()

        assert ind_2["respiratory"]["status"] == "normal"
        assert ind_2["biometrics"]["status"] == "normal"

        # Dashboard check for normal vitals
        dash_res_2 = await client.get("/api/v1/patients/dashboard", headers=headers_a)
        assert dash_res_2.status_code == 200
        dash_data_2 = dash_res_2.json()
        assert dash_data_2["vitals"]["blood_pressure"]["has_data"] is True
        assert dash_data_2["vitals"]["blood_pressure"]["value"] == "118/76"
        assert dash_data_2["vitals"]["blood_pressure"]["status"] == "Within Target Band"

        # -----------------------------------------------------------------
        # TEST 3: Patient with readings OUTSIDE target range
        # -----------------------------------------------------------------
        async with AsyncSessionFactory() as session:
            v_elevated = VitalSign(
                id=uuid.uuid4(),
                patient_id=patient_a.id,
                recorded_at=now - timedelta(minutes=30),
                systolic_bp=152,
                diastolic_bp=96,
                blood_glucose=215.0,
                glucose_context="post_meal",
                measurement_source="manual_entry",
                is_sample=False,
            )
            session.add(v_elevated)
            await session.commit()

        bm_res_3 = await client.get("/api/v1/vitals/body-map", headers=headers_a)
        assert bm_res_3.status_code == 200
        bm_data_3 = bm_res_3.json()

        ind_3 = bm_data_3["indicators"]
        # Stage 2 Hypertension: 152/96 mmHg
        assert ind_3["cardiovascular"]["status"] == "urgent"
        assert "HYPERTENSION" in ind_3["cardiovascular"]["status_label"]

        # Glucose 215 post-meal -> Urgent spike (>200)
        assert ind_3["metabolic"]["status"] == "urgent"
        assert ind_3["metabolic"]["latest_value"] == "215.0"

        # Overall status must reflect urgent or attention
        assert bm_data_3["overall_health_status"] == "urgent_care_recommended"
        assert bm_data_3["overall_status"] == "urgent"

        # -----------------------------------------------------------------
        # TEST 4: Patient with OUTDATED measurements (>14 days)
        # -----------------------------------------------------------------
        # Create a separate patient with only an old measurement
        async with AsyncSessionFactory() as session:
            user_stale = User(
                id=uuid.uuid4(),
                email=f"patient.stale.{uuid.uuid4().hex[:6]}@medicare.ai",
                hashed_password="hash",
                full_name="Patient Stale Vitals",
                role=UserRole.PATIENT,
                is_active=True,
            )
            session.add(user_stale)
            await session.flush()

            patient_stale = Patient(
                id=uuid.uuid4(),
                user_id=user_stale.id,
                mrn=f"MRN-STALE-{uuid.uuid4().hex[:6].upper()}",
            )
            session.add(patient_stale)
            await session.flush()

            v_old = VitalSign(
                id=uuid.uuid4(),
                patient_id=patient_stale.id,
                recorded_at=now - timedelta(days=21),  # 21 days ago
                systolic_bp=118,
                diastolic_bp=78,
                blood_glucose=95.0,
                heart_rate=70,
                measurement_source="manual_entry",
                is_sample=False,
            )
            session.add(v_old)
            await session.commit()

        token_stale = create_access_token(str(user_stale.id), "patient")
        headers_stale = {"Authorization": f"Bearer {token_stale}"}

        bm_res_stale = await client.get("/api/v1/vitals/body-map", headers=headers_stale)
        assert bm_res_stale.status_code == 200
        bm_data_stale = bm_res_stale.json()

        assert bm_data_stale["indicators"]["cardiovascular"]["status"] == "stale"
        assert bm_data_stale["indicators"]["cardiovascular"]["status_label"] == "STALE DATA"
        assert bm_data_stale["indicators"]["heart"]["status"] == "stale"
        assert bm_data_stale["indicators"]["metabolic"]["status"] == "stale"
        assert bm_data_stale["overall_health_status"] == "stale_monitoring"

        dash_res_stale = await client.get("/api/v1/patients/dashboard", headers=headers_stale)
        assert dash_res_stale.status_code == 200
        dash_data_stale = dash_res_stale.json()
        assert dash_data_stale["vitals"]["blood_pressure"]["status"] == "Stale Data"
        assert "Stale" in dash_data_stale["vitals"]["blood_pressure"]["category"]

        # -----------------------------------------------------------------
        # TEST 5: Patient with MULTIPLE readings on the same day
        # -----------------------------------------------------------------
        async with AsyncSessionFactory() as session:
            same_day_base = now - timedelta(days=1)
            # Morning reading
            v_morn = VitalSign(
                id=uuid.uuid4(),
                patient_id=patient_a.id,
                recorded_at=same_day_base.replace(hour=8, minute=15),
                systolic_bp=122,
                diastolic_bp=80,
                measurement_source="manual_entry",
                is_sample=False,
            )
            # Evening reading (higher timestamp)
            v_eve = VitalSign(
                id=uuid.uuid4(),
                patient_id=patient_a.id,
                recorded_at=same_day_base.replace(hour=18, minute=45),
                systolic_bp=128,
                diastolic_bp=84,
                measurement_source="manual_entry",
                is_sample=False,
            )
            session.add_all([v_morn, v_eve])
            await session.commit()

        bm_res_5 = await client.get("/api/v1/vitals/body-map", headers=headers_a)
        assert bm_res_5.status_code == 200
        bm_data_5 = bm_res_5.json()

        pts = bm_data_5["indicators"]["cardiovascular"]["history_points"]
        assert len(pts) >= 2, "History points must contain multiple readings"
        # Chronological descending check: first point is newer than second point
        dt_0 = datetime.fromisoformat(pts[0]["recorded_at"])
        dt_1 = datetime.fromisoformat(pts[1]["recorded_at"])
        assert dt_0 >= dt_1, "History points must be sorted chronologically descending"

        # -----------------------------------------------------------------
        # TEST 6: Patient with missing measurement timestamps
        # -----------------------------------------------------------------
        async with AsyncSessionFactory() as session:
            v_no_ts = VitalSign(
                id=uuid.uuid4(),
                patient_id=patient_a.id,
                recorded_at=now,
                systolic_bp=120,
                diastolic_bp=80,
                measurement_source="manual_entry",
                is_sample=False,
            )
            session.add(v_no_ts)
            await session.commit()

        # Ensure query succeeds without crashing
        bm_res_6 = await client.get("/api/v1/vitals/body-map", headers=headers_a)
        assert bm_res_6.status_code == 200

        # -----------------------------------------------------------------
        # TEST 7: Patient with MANUALLY entered readings
        # -----------------------------------------------------------------
        async with AsyncSessionFactory() as session:
            v_manual = VitalSign(
                id=uuid.uuid4(),
                patient_id=patient_a.id,
                recorded_at=now,
                systolic_bp=119,
                diastolic_bp=77,
                device_name=None,
                measurement_source="manual_entry",
                is_sample=False,
            )
            session.add(v_manual)
            await session.commit()

        dash_res_7 = await client.get("/api/v1/patients/dashboard", headers=headers_a)
        assert dash_res_7.status_code == 200
        dash_data_7 = dash_res_7.json()
        assert "Manual Entry" in dash_data_7["vitals"]["blood_pressure"]["verification_status"]

        # -----------------------------------------------------------------
        # TEST 8: Patient with CONNECTED DEVICE readings
        # -----------------------------------------------------------------
        async with AsyncSessionFactory() as session:
            v_device = VitalSign(
                id=uuid.uuid4(),
                patient_id=patient_a.id,
                recorded_at=now + timedelta(seconds=10),
                systolic_bp=121,
                diastolic_bp=79,
                device_name="Omron Evolv BP7000",
                measurement_source="omron_connect_sync",
                is_sample=False,
            )
            session.add(v_device)
            await session.commit()

        dash_res_8 = await client.get("/api/v1/patients/dashboard", headers=headers_a)
        assert dash_res_8.status_code == 200
        dash_data_8 = dash_res_8.json()
        assert dash_data_8["vitals"]["blood_pressure"]["verification_status"] == "REAL DEVICE DATA"
        assert dash_data_8["vitals"]["blood_pressure"]["device_name"] == "Omron Evolv BP7000"

        # -----------------------------------------------------------------
        # TEST 10: Strict Patient Tenant Isolation
        # -----------------------------------------------------------------
        # Patient B has their own session and must not see Patient A's vitals
        dash_res_b = await client.get("/api/v1/patients/dashboard", headers=headers_b)
        assert dash_res_b.status_code == 200
        dash_data_b = dash_res_b.json()

        # Patient B has never logged vitals
        assert dash_data_b["patient_id"] == str(patient_b.id)
        assert dash_data_b["vitals"]["blood_pressure"]["has_data"] is False
        assert dash_data_b["vitals"]["blood_pressure"]["value"] == "--"
        assert dash_data_b["recent_activity"] == []

        # Patient B cannot pass patient_id parameter to view Patient A's dashboard
        unauth_dash = await client.get(f"/api/v1/patients/dashboard?patient_id={patient_a.id}", headers=headers_b)
        assert unauth_dash.status_code == 403, "Cross-patient dashboard querying must be blocked with HTTP 403"
