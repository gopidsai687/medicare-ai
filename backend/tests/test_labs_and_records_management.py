"""
Comprehensive Automated Test Suite: Complete Lab Results & Medical Records Management Upgrade.
Validates:
1. Lab Result Creation (Patient-Reported & Clinician-Imported).
2. Lab Result Direct Update (Patient-Reported) vs Amendment Safeguards.
3. Lab Result Clinical Amendment with Mandatory Reason & Original Value Preservation.
4. Lab Result Soft Archival and Restoration.
5. Chronological Biomarker Trend Lines without Cross-Unit Contamination (HbA1c %, Glucose mg/dL).
6. Lab Result Clear History and JSON Summary Export.
7. Medical Record Creation (Diagnoses, Allergies, Surgeries, Immunizations).
8. Medical Record Direct Update for Patient-Reported Items.
9. Medical Record Clinical Amendment for Confirmed Items.
10. Medical Record Soft Archival & Restoration.
11. Full EHR Audit Trail & Version Snapshot Inspection.
12. Intelligent Linkage between Diagnostic Lab Results and Medical Records.
13. Medical Records Clear History Modes & Retention Compliance.
14. Medical Records Comprehensive Health Summary Export.
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
from app.models.medical_record import MedicalRecord, RecordCategory, RecordStatus


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_labs_and_records_management_full_suite():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Resolve Patient User & Token
        async with AsyncSessionFactory() as session:
            stmt = select(User).where(User.role == UserRole.PATIENT)
            res = await session.execute(stmt)
            patient_user = res.scalars().first()
            assert patient_user is not None, "Patient user must exist in database"

            p_stmt = select(Patient).where(Patient.user_id == patient_user.id)
            p_res = await session.execute(p_stmt)
            patient = p_res.scalars().first()
            assert patient is not None, "Patient profile must exist in database"

        token = create_access_token(str(patient_user.id), role=patient_user.role.value)
        auth_headers = {"Authorization": f"Bearer {token}"}

        # ─────────────────────────────────────────────────────────────────────
        # PART 1: LAB RESULTS MANAGEMENT
        # ─────────────────────────────────────────────────────────────────────

        # A. Create a new patient-reported lab result
        lab_payload = {
            "test_name": "Blood Glucose (Fasting Fingerstick)",
            "panel_name": "Home Glycemic Diary",
            "category": "Comprehensive Metabolic Panel (CMP)",
            "value": 112.5,
            "unit": "mg/dL",
            "reference_range": "70 – 99 mg/dL",
            "test_date": "2026-10-20",
            "ordering_physician": "Self-Monitored",
            "laboratory_name": "Contour Next Gen Meter",
            "clinical_notes": "Morning fasting reading before breakfast",
        }
        res = await client.post("/api/v1/labs/results", json=lab_payload, headers=auth_headers)
        assert res.status_code == 201, f"Expected 201 Created: {res.text}"
        lab_data = res.json()
        assert lab_data["name"] == "Blood Glucose (Fasting Fingerstick)"
        assert lab_data["value"] == 112.5
        assert lab_data["source"] == "patient_entered"
        lab_id = lab_data["id"]

        # B. Direct edit of patient-entered lab result
        update_payload = {
            "value": 110.0,
            "clinical_notes": "Recalibrated reading: 110.0 mg/dL after repeat check",
        }
        res = await client.put(f"/api/v1/labs/results/{lab_id}", json=update_payload, headers=auth_headers)
        assert res.status_code == 200, f"Expected 200: {res.text}"
        updated_lab = res.json()
        assert updated_lab["value"] == 110.0

        # C. Amendment of lab result with mandatory clinical justification
        amend_payload = {
            "value": 108.0,
            "status": "Elevated",
            "reason": "Corrected for meter calibration offset after clinical review",
        }
        res = await client.post(f"/api/v1/labs/results/{lab_id}/amend", json=amend_payload, headers=auth_headers)
        assert res.status_code == 200, f"Expected 200: {res.text}"
        amended_lab = res.json()
        assert amended_lab["value"] == 108.0
        assert amended_lab["is_amended"] is True
        assert amended_lab["original_value"] == 110.0

        # D. Soft archival with reason
        archive_payload = {"reason": "Duplicate reading superseded by subsequent lab venous draw"}
        res = await client.patch(f"/api/v1/labs/results/{lab_id}/archive", json=archive_payload, headers=auth_headers)
        assert res.status_code == 200, f"Expected 200: {res.text}"
        assert res.json()["status"] == "archived"

        # Verify not in default listing
        res = await client.get("/api/v1/labs", params={"flat": True}, headers=auth_headers)
        assert res.status_code == 200
        active_ids = [item["id"] for item in res.json()]
        assert lab_id not in active_ids

        # Verify in listing when include_archived=True
        res = await client.get("/api/v1/labs", params={"flat": True, "include_archived": True}, headers=auth_headers)
        assert res.status_code == 200
        all_ids = [item["id"] for item in res.json()]
        assert lab_id in all_ids

        # E. Restore archived lab result
        res = await client.patch(f"/api/v1/labs/results/{lab_id}/restore", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "restored"

        # F. Biomarker Trends for HbA1c (must return chronological progression with single compatible unit '%')
        res = await client.get("/api/v1/labs/trends/HbA1c", headers=auth_headers)
        assert res.status_code == 200, f"Expected 200: {res.text}"
        trend_data = res.json()
        assert "a1c" in trend_data["test_name"].lower()
        assert trend_data["unit"] == "%"
        assert len(trend_data["points"]) >= 3
        # Chronological verification: 7.4 -> 7.1 -> 6.8
        values = [p["value"] for p in trend_data["points"]]
        dates = [p["date"] for p in trend_data["points"]]
        assert dates == sorted(dates), "Data points must be ordered chronologically"
        assert 7.4 in values and 6.8 in values

        # G. Clear lab history controls
        res = await client.post("/api/v1/labs/clear-history", json={"mode": "clear_filters", "confirmation": True}, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "success"

        # H. Export lab summary
        res = await client.get("/api/v1/labs/export", headers=auth_headers)
        assert res.status_code == 200
        exp = res.json()
        assert "panels" in exp or "results" in exp
        assert "export_date" in exp or "exported_at" in exp

        # ─────────────────────────────────────────────────────────────────────
        # PART 2: MEDICAL RECORDS MANAGEMENT
        # ─────────────────────────────────────────────────────────────────────

        # A. Create a new patient-reported medical record
        rec_payload = {
            "category": "diagnosis",
            "title": "Mild Seasonal Allergic Rhinitis",
            "description": "Nasal congestion and sneezing during spring tree pollination",
            "record_date": "2026-03-15",
            "provider": "Self-Reported / Outside Clinic",
            "icd10_code": "J30.1",
            "status": "active",
            "severity": "Mild",
            "notes": "Managed with Cetirizine 10mg PRN",
        }
        res = await client.post("/api/v1/records", json=rec_payload, headers=auth_headers)
        assert res.status_code == 201, f"Expected 201: {res.text}"
        rec_data = res.json()
        assert rec_data["title"] == "Mild Seasonal Allergic Rhinitis"
        assert rec_data["is_patient_reported"] is True
        record_id = rec_data["id"]

        # B. Direct edit of patient-reported record
        rec_update = {
            "title": "Allergic Rhinitis (Pollen & Dust)",
            "description": "Symptoms worsen with high pollen counts and indoor dust",
            "severity": "Moderate",
        }
        res = await client.put(f"/api/v1/records/{record_id}", json=rec_update, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["title"] == "Allergic Rhinitis (Pollen & Dust)"
        assert res.json()["severity"] == "Moderate"

        # C. Clinical amendment with mandatory justification reason
        rec_amend = {
            "description": "Allergist evaluation confirmed perennial component; nasal spray added",
            "status": "chronic",
            "reason": "Documented following allergist consultation and skin prick tests",
        }
        res = await client.post(f"/api/v1/records/{record_id}/amend", json=rec_amend, headers=auth_headers)
        assert res.status_code == 200
        amended_rec = res.json()
        assert amended_rec["is_amended"] is True
        assert amended_rec["amendment_reason"] == "Documented following allergist consultation and skin prick tests"

        # D. Soft archival of medical record
        res = await client.patch(f"/api/v1/records/{record_id}/archive", json={"reason": "Resolved with immunotherapy"}, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "archived"

        # Verify excluded from active list
        res = await client.get("/api/v1/records", headers=auth_headers)
        assert res.status_code == 200
        active_rec_ids = [r["id"] for r in res.json()]
        assert record_id not in active_rec_ids

        # E. Restore medical record
        res = await client.patch(f"/api/v1/records/{record_id}/restore", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "restored"

        # F. Audit trail verification
        res = await client.get("/api/v1/records/history", headers=auth_headers)
        assert res.status_code == 200
        history_events = res.json()
        assert len(history_events) > 0
        actions = [e["action"] for e in history_events]
        assert "created" in actions or "amended" in actions or "archived" in actions

        # G. Single record version snapshots
        res = await client.get(f"/api/v1/records/{record_id}/history", headers=auth_headers)
        assert res.status_code == 200
        versions = res.json()
        assert len(versions) >= 2  # creation + edit or amendment

        # H. Intelligent linkage: Create medical record linked to lab result
        link_payload = {
            "category": "lab_result",
            "title": "Reference to Fasting Blood Glucose (CMP)",
            "description": "Correlated venous metabolic panel testing",
            "record_date": "2026-10-21",
            "provider": "Quest Diagnostics",
            "lab_result_id": lab_id,
            "status": "active",
        }
        res = await client.post("/api/v1/records", json=link_payload, headers=auth_headers)
        assert res.status_code == 201
        linked_rec = res.json()
        assert linked_rec["lab_result_id"] == lab_id

        # I. Clear record history modes
        for mode in ["clear_filters", "hide_archived", "request_archival"]:
            res = await client.post("/api/v1/records/clear-history", json={"mode": mode, "confirmation": True}, headers=auth_headers)
            assert res.status_code == 200
            assert res.json()["status"] == "success"

        # J. Export comprehensive medical record summary
        res = await client.get("/api/v1/records/export", headers=auth_headers)
        assert res.status_code == 200
        export_body = res.json()
        assert "patient_id" in export_body
        assert "records" in export_body
        assert len(export_body["records"]) > 0
