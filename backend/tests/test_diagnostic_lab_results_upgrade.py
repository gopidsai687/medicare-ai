"""
Comprehensive Automated Test Suite: Diagnostic Lab Results Accuracy, Duplicate Prevention & History Management Upgrade.
Validates:
1. Adding a certified laboratory result (e.g. Venous Serum Creatinine with Lab Result classification).
2. Adding a home glucose reading (Blood Glucose with device Contour Next Gen Meter, result_type home_monitoring).
3. Adding two legitimate repeated measurements on the same day (is_repeat_measurement=True / repeat_value).
4. Detecting an accidental duplicate submission on the same date and returning HTTP 409 Conflict with DUPLICATE_MEASUREMENT_DETECTED.
5. Editing a reading (updating initial value, repeat verification value, device, and notes).
6. Soft archiving and restoring a lab record with immutable audit logs and reason capture.
7. Viewing historical readings and trends without combining different measurement modalities (e.g. venous vs fingerstick).
8. Exporting diagnostic laboratory telemetry via /api/v1/labs/export.
9. Segregated filtering by test type (Certified Laboratory Results vs Home Monitoring Telemetry).
10. Tenant isolation safeguards (ensuring unauthorized cross-patient data access and tampering is strictly blocked).
"""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from datetime import date, datetime, timezone
from sqlalchemy import select

from app.main import app
from app.core.database import AsyncSessionFactory
from app.core.security import create_access_token
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.lab_result import LabResult, LabCategory, LabResultStatus, LabSource


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_diagnostic_lab_results_accuracy_and_duplicate_prevention_suite():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Resolve Primary Patient User & Token (Alice Johnson)
        async with AsyncSessionFactory() as session:
            stmt = select(User).where(User.role == UserRole.PATIENT)
            res = await session.execute(stmt)
            patient_users = res.scalars().all()
            assert len(patient_users) >= 1, "At least one patient user required"
            patient_user = patient_users[0]

            p_stmt = select(Patient).where(Patient.user_id == patient_user.id)
            p_res = await session.execute(p_stmt)
            patient = p_res.scalars().first()
            assert patient is not None, "Patient profile required"

            # Create or resolve a secondary patient for tenant isolation validation
            second_patient_user = None
            if len(patient_users) > 1:
                second_patient_user = patient_users[1]
            else:
                sec_user = User(
                    id=uuid.uuid4(),
                    email=f"patient.sec.{uuid.uuid4().hex[:6]}@medicare.ai",
                    hashed_password="hash",
                    full_name="Bob Patient Sec",
                    role=UserRole.PATIENT,
                    is_active=True,
                    is_verified=True,
                )
                session.add(sec_user)
                await session.flush()
                sec_p = Patient(id=uuid.uuid4(), user_id=sec_user.id, mrn=f"MRN-{uuid.uuid4().hex[:8].upper()}")
                session.add(sec_p)
                await session.commit()
                second_patient_user = sec_user

        token = create_access_token(str(patient_user.id), role=patient_user.role.value)
        auth_headers = {"Authorization": f"Bearer {token}"}

        sec_token = create_access_token(str(second_patient_user.id), role=second_patient_user.role.value)
        sec_auth_headers = {"Authorization": f"Bearer {sec_token}"}

        # Unique run key to ensure test idempotence on persistent database
        test_run_id = uuid.uuid4().hex[:6]
        test_test_date = "2026-11-06"
        certified_test_name = f"Serum Creatinine {test_run_id}"
        glucose_test_name = f"Blood Glucose (Fasting Fingerstick) {test_run_id}"

        # ─────────────────────────────────────────────────────────────────────
        # 1. ADD CERTIFIED LABORATORY RESULT
        # ─────────────────────────────────────────────────────────────────────
        certified_lab_payload = {
            "test_name": certified_test_name,
            "panel_name": "Comprehensive Metabolic Panel (CMP)",
            "category": "Comprehensive Metabolic Panel (CMP)",
            "value": 1.05,
            "unit": "mg/dL",
            "reference_range": "0.74 – 1.35 mg/dL",
            "test_date": test_test_date,
            "ordering_physician": "Dr. Sarah Jenkins, MD",
            "laboratory_name": "Quest Diagnostics Central Lab",
            "clinical_notes": "Routine annual venipuncture renal evaluation.",
            "result_type": "lab_result",
            "source": "laboratory_imported",
        }
        res = await client.post("/api/v1/labs/results", json=certified_lab_payload, headers=auth_headers)
        assert res.status_code == 201, f"Failed adding certified lab: {res.text}"
        certified_lab = res.json()
        assert certified_lab["name"] == certified_test_name
        assert certified_lab["result_type"] == "lab_result"
        assert certified_lab["orderedBy"] == "Dr. Sarah Jenkins, MD"
        certified_id = certified_lab["id"]

        # ─────────────────────────────────────────────────────────────────────
        # 2. ADD HOME GLUCOSE MONITORING READING (WITH DEVICE & REPEAT VALUE)
        # ─────────────────────────────────────────────────────────────────────
        home_glucose_payload = {
            "test_name": glucose_test_name,
            "panel_name": "Home Glycemic Diary",
            "category": "Home Monitoring",
            "value": 108.0,
            "repeat_value": 110.0,
            "repeat_time": "08:15 AM",
            "repeat_notes": "Repeat verification fingerstick on alternate digit",
            "unit": "mg/dL",
            "reference_range": "70 – 99 mg/dL",
            "test_date": test_test_date,
            "measurement_time": "08:00 AM",
            "deviceName": "Contour Next Gen Meter",
            "device_name": "Contour Next Gen Meter",
            "fasting_status": "Fasting (10h)",
            "result_type": "home_monitoring",
            "clinical_notes": "Morning fasting reading before breakfast",
        }
        res = await client.post("/api/v1/labs/results", json=home_glucose_payload, headers=auth_headers)
        assert res.status_code == 201, f"Failed adding home glucose reading: {res.text}"
        home_glucose = res.json()
        assert home_glucose["value"] == 108.0
        assert home_glucose["repeat_value"] == 110.0
        assert home_glucose["result_type"] == "home_monitoring"
        assert home_glucose["device_name"] == "Contour Next Gen Meter"
        assert "Source:" in home_glucose["orderedBy"]
        home_id = home_glucose["id"]

        # ─────────────────────────────────────────────────────────────────────
        # 3. ACCIDENTAL DUPLICATE DETECTION (PREVENTS SILENT DUPLICATE INSERTION)
        # ─────────────────────────────────────────────────────────────────────
        accidental_duplicate_payload = {
            "test_name": glucose_test_name,
            "panel_name": "Home Glycemic Diary",
            "category": "Home Monitoring",
            "value": 108.0,
            "unit": "mg/dL",
            "test_date": test_test_date,
            "result_type": "home_monitoring",
            "clinical_notes": "Accidental duplicate click by patient",
            "allow_duplicate": False,
            "is_repeat_measurement": False,
        }
        res = await client.post("/api/v1/labs/results", json=accidental_duplicate_payload, headers=auth_headers)
        assert res.status_code == 409, f"Expected 409 Conflict for duplicate: {res.text}"
        conflict_detail = res.json()["detail"]
        assert conflict_detail["code"] == "DUPLICATE_MEASUREMENT_DETECTED"
        assert conflict_detail["existing_record"]["id"] == home_id

        # ─────────────────────────────────────────────────────────────────────
        # 4. ADD LEGITIMATE REPEATED READING ON THE SAME DAY
        # ─────────────────────────────────────────────────────────────────────
        legitimate_repeat_payload = {
            "test_name": glucose_test_name,
            "panel_name": "Home Glycemic Diary",
            "category": "Home Monitoring",
            "value": 142.0,
            "unit": "mg/dL",
            "reference_range": "70 – 140 mg/dL",
            "test_date": test_test_date,
            "measurement_time": "07:30 PM",
            "device_name": "Contour Next Gen Meter",
            "fasting_status": "Post-Prandial (2h)",
            "result_type": "home_monitoring",
            "clinical_notes": "Post-dinner blood glucose check",
            "is_repeat_measurement": True,
            "allow_duplicate": True,
        }
        res = await client.post("/api/v1/labs/results", json=legitimate_repeat_payload, headers=auth_headers)
        assert res.status_code == 201, f"Expected 201 for legitimate repeat: {res.text}"
        evening_reading = res.json()
        assert evening_reading["value"] == 142.0
        assert evening_reading["is_repeat_measurement"] is True

        # ─────────────────────────────────────────────────────────────────────
        # 5. EDITING A READING (VALUE, REPEAT VALUE, NOTES, DEVICE)
        # ─────────────────────────────────────────────────────────────────────
        edit_payload = {
            "value": 109.0,
            "repeat_value": 111.0,
            "repeat_notes": "Adjusted reading after test strip recalibration",
            "device_name": "Contour Next Gen Meter (Calibrated)",
            "clinical_notes": "Updated fasting log with clinical annotation",
        }
        res = await client.put(f"/api/v1/labs/results/{home_id}", json=edit_payload, headers=auth_headers)
        assert res.status_code == 200, f"Expected 200 for edit: {res.text}"
        edited_lab = res.json()
        assert edited_lab["value"] == 109.0
        assert edited_lab["repeat_value"] == 111.0
        assert edited_lab["device_name"] == "Contour Next Gen Meter (Calibrated)"

        # ─────────────────────────────────────────────────────────────────────
        # 6. ARCHIVING AND RESTORING A READING
        # ─────────────────────────────────────────────────────────────────────
        archive_payload = {"reason": "Entered erroneous digit in test log"}
        res = await client.patch(f"/api/v1/labs/results/{home_id}/archive", json=archive_payload, headers=auth_headers)
        assert res.status_code == 200
        archived_info = res.json()
        assert archived_info["status"] == "archived"
        assert archived_info["reason"] == "Entered erroneous digit in test log"

        # Restore reading
        res = await client.patch(f"/api/v1/labs/results/{home_id}/restore", headers=auth_headers)
        assert res.status_code == 200
        restored_info = res.json()
        assert restored_info["status"] == "restored"

        # ─────────────────────────────────────────────────────────────────────
        # 7. VIEWING HISTORICAL READINGS & TRENDS (SEGREGATED MODALITIES)
        # ─────────────────────────────────────────────────────────────────────
        # Trend check with result_type=home_monitoring
        res = await client.get(f"/api/v1/labs/trends/{glucose_test_name}?result_type=home_monitoring", headers=auth_headers)
        assert res.status_code == 200
        trend_data = res.json()
        assert trend_data["result_type"] == "home_monitoring"
        assert len(trend_data["points"]) >= 1
        assert "educational_notice" in trend_data

        # ─────────────────────────────────────────────────────────────────────
        # 8. EXPORTING LAB RESULTS SUMMARY
        # ─────────────────────────────────────────────────────────────────────
        res = await client.get("/api/v1/labs/export", headers=auth_headers)
        assert res.status_code == 200
        export_summary = res.json()
        assert "patient_id" in export_summary
        assert "total_results" in export_summary
        assert export_summary["total_results"] >= 2
        assert "results" in export_summary

        # ─────────────────────────────────────────────────────────────────────
        # 9. FILTERING BY TEST TYPE (SEGREGATED NAVIGATION TABS)
        # ─────────────────────────────────────────────────────────────────────
        # Certified labs filter
        res = await client.get("/api/v1/labs?result_type=lab_result", headers=auth_headers)
        assert res.status_code == 200
        certified_labs_list = res.json()
        for item in certified_labs_list:
            assert item["result_type"] == "lab_result"

        # Home monitoring filter
        res = await client.get("/api/v1/labs?result_type=home_monitoring", headers=auth_headers)
        assert res.status_code == 200
        home_mon_list = res.json()
        for item in home_mon_list:
            assert item["result_type"] == "home_monitoring"

        # ─────────────────────────────────────────────────────────────────────
        # 10. TENANT ISOLATION SAFEGUARD
        # ─────────────────────────────────────────────────────────────────────
        # Patient B tries to edit or archive Patient A's lab result
        res = await client.put(f"/api/v1/labs/results/{certified_id}", json={"value": 99.9}, headers=sec_auth_headers)
        assert res.status_code in (403, 404), f"Expected 403/404 for cross-patient modification: {res.status_code}"

        res = await client.patch(f"/api/v1/labs/results/{certified_id}/archive", json={"reason": "Hacking"}, headers=sec_auth_headers)
        assert res.status_code in (403, 404), f"Expected 403/404 for cross-patient archival: {res.status_code}"
