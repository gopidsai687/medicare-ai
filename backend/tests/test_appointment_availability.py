"""
Comprehensive tests for MediCare AI Real-World Appointment Scheduling System.
Validates:
- Specialty and configured doctor retrieval
- Schedule-backed slot availability calculation
- Clinic timezone handling (America/New_York)
- Unconfigured doctor schedules (clean messaging, no hallucinated slots)
- Atomic double-booking prevention (HTTP 409 on concurrent slot reservation)
- Patient self-conflict prevention
- Future vs. past appointment filtering (October 15, 2026 reference date)
- Rescheduling workflow (releases old slot, claims new slot)
- Cancellation workflow (frees slot, records audit reason)
- Role-based access control (patient isolation, doctor access, admin visibility)
- Input validation (clinical reason length constraints)
"""
import os
import sys
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.core.database import AsyncSessionFactory, engine
from app.core.seed import seed_initial_data
from app.models.base import Base


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_appointment_full_workflow():
    # 1. Ensure seed data and database ready
    async with AsyncSessionFactory() as session:
        await seed_initial_data(session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Authenticate Alice (Patient), Sarah (Doctor), Bob (Patient 2), Vance (Admin)
        res_alice = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        assert res_alice.status_code == 200
        alice_token = res_alice.json()["access_token"]
        alice_headers = {"Authorization": f"Bearer {alice_token}"}

        res_bob = await client.post(
            "/api/v1/auth/login",
            json={"email": "bob.smith@medicare.ai", "password": "PatientPass123!"},
        )
        assert res_bob.status_code == 200
        bob_token = res_bob.json()["access_token"]
        bob_headers = {"Authorization": f"Bearer {bob_token}"}

        res_doc = await client.post(
            "/api/v1/auth/login",
            json={"email": "sarah.chen@medicare.ai", "password": "DoctorPass123!"},
        )
        assert res_doc.status_code == 200
        doc_token = res_doc.json()["access_token"]
        doc_headers = {"Authorization": f"Bearer {doc_token}"}

        res_adm = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@medicare.ai", "password": "AdminPass123!"},
        )
        assert res_adm.status_code == 200
        adm_token = res_adm.json()["access_token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        # ------------------------------------------------------------------
        # Step 1: Query Specialties and Configured Doctors
        # ------------------------------------------------------------------
        spec_resp = await client.get("/api/v1/appointments/specialties", headers=alice_headers)
        assert spec_resp.status_code == 200
        specialties = spec_resp.json()
        assert len(specialties) >= 3
        cardiology = next((s for s in specialties if "Cardiology" in s["name"]), None)
        assert cardiology is not None

        doc_resp = await client.get("/api/v1/appointments/doctors", headers=alice_headers)
        assert doc_resp.status_code == 200
        doctors = doc_resp.json()
        assert len(doctors) >= 4
        dr_chen = next((d for d in doctors if "Chen" in d["name"]), None)
        assert dr_chen is not None
        assert len(dr_chen["working_days"]) > 0
        assert dr_chen["specialty"] == "Cardiology"

        # ------------------------------------------------------------------
        # Step 2: Unconfigured Schedule Detection (No Hallucinated Slots)
        # Check Saturday (e.g. 2026-10-24)
        # ------------------------------------------------------------------
        unconfig_resp = await client.get(
            f"/api/v1/appointments/availability?doctor_id={dr_chen['id']}&date=2026-10-24",
            headers=alice_headers,
        )
        assert unconfig_resp.status_code == 200
        unconfig_data = unconfig_resp.json()
        assert unconfig_data["status"] == "unconfigured"
        assert "not configured" in unconfig_data["message"].lower()
        assert len(unconfig_data["slots"]) == 0

        # ------------------------------------------------------------------
        # Step 3: Configured Weekday Slot Calculation
        # Check a weekday: Tuesday 2026-10-27 (Dr. Chen shift 08:30 - 16:30)
        # ------------------------------------------------------------------
        avail_resp = await client.get(
            f"/api/v1/appointments/availability?doctor_id={dr_chen['id']}&date=2026-10-27",
            headers=alice_headers,
        )
        assert avail_resp.status_code == 200
        avail_data = avail_resp.json()
        assert avail_data["status"] == "available"
        assert avail_data["doctor_name"] == dr_chen["name"]
        assert avail_data["clinic_timezone"] == "America/New_York"
        slots = avail_data["slots"]
        assert len(slots) > 5
        # Verify first slot is 09:00 and availability exists
        assert slots[0]["start_time"] == "09:00"
        assert any(s["is_available"] for s in slots), "Must have available slots on configured weekday"

        # ------------------------------------------------------------------
        # Step 4: Validation Constraints (Reason Length >= 5 chars)
        # ------------------------------------------------------------------
        short_reason_resp = await client.post(
            "/api/v1/appointments",
            headers=alice_headers,
            json={
                "doctor_id": dr_chen["id"],
                "scheduled_at": slots[0]["iso_datetime"],
                "appointment_type": "in_person",
                "reason": "yy",  # Stray/invalid short text from screenshot bug!
            },
        )
        assert short_reason_resp.status_code == 422, "Reason < 5 chars must be rejected"

        # ------------------------------------------------------------------
        # Step 5: Successful Booking with Valid Clinical Reason
        # ------------------------------------------------------------------
        open_slots = [s for s in slots if s["is_available"]]
        assert len(open_slots) >= 2, "Need at least 2 open slots for booking and rescheduling tests"
        target_slot_utc = open_slots[0]["iso_datetime"]
        new_slot_utc = open_slots[1]["iso_datetime"]

        book_resp = await client.post(
            "/api/v1/appointments",
            headers=alice_headers,
            json={
                "doctor_id": dr_chen["id"],
                "scheduled_at": target_slot_utc,
                "appointment_type": "in_person",
                "reason": "Routine Cardiovascular Follow-up and Stress Test Review",
            },
        )
        assert book_resp.status_code == 201
        created_appt = book_resp.json()
        assert created_appt["booking_reference"].startswith("MC-")
        assert created_appt["status"] in ("scheduled", "confirmed")
        assert created_appt["doctor_name"] == dr_chen["name"]
        assert created_appt["patient_name"] == "Alice Johnson"
        assert created_appt["is_upcoming"] is True
        appt_id = created_appt["id"]

        # ------------------------------------------------------------------
        # Step 6: Atomic Double-Booking Prevention (Concurrent Conflict)
        # Bob attempts to book the exact same slot with Dr. Chen
        # ------------------------------------------------------------------
        conflict_resp = await client.post(
            "/api/v1/appointments",
            headers=bob_headers,
            json={
                "doctor_id": dr_chen["id"],
                "scheduled_at": target_slot_utc,
                "appointment_type": "telehealth",
                "reason": "Chest pain consultation request",
            },
        )
        assert conflict_resp.status_code == 409, "Double booking must return 409 Conflict"
        conflict_msg = conflict_resp.json()["detail"].lower()
        assert "no longer available" in conflict_msg or "already been booked" in conflict_msg or "another patient" in conflict_msg

        # Check availability again: the target slot must now be marked is_available = False
        recheck_avail = await client.get(
            f"/api/v1/appointments/availability?doctor_id={dr_chen['id']}&date=2026-10-27",
            headers=bob_headers,
        )
        slot_booked = next(s for s in recheck_avail.json()["slots"] if s["iso_datetime"] == target_slot_utc)
        assert slot_booked["is_available"] is False
        assert "booked" in (slot_booked["reason"] or "").lower() or "reserved" in (slot_booked["reason"] or "").lower()

        # ------------------------------------------------------------------
        # Step 7: Patient Self-Conflict Prevention
        # Alice cannot book another appointment at the exact same time
        # ------------------------------------------------------------------
        dr_kim = next((d for d in doctors if "Kim" in d["name"]), None)
        assert dr_kim is not None
        alice_double_resp = await client.post(
            "/api/v1/appointments",
            headers=alice_headers,
            json={
                "doctor_id": dr_kim["id"],
                "scheduled_at": target_slot_utc,
                "appointment_type": "in_person",
                "reason": "Second opinion consultation on endocrine panel",
            },
        )
        assert alice_double_resp.status_code == 409
        assert "active appointment" in alice_double_resp.json()["detail"].lower()

        # ------------------------------------------------------------------
        # Step 8: Upcoming vs Past Filtering (Fixes Screenshot Bug)
        # Ensure only future scheduled appointments are in time_frame=upcoming
        # ------------------------------------------------------------------
        upcoming_resp = await client.get("/api/v1/appointments?time_frame=upcoming", headers=alice_headers)
        assert upcoming_resp.status_code == 200
        upcoming_appts = upcoming_resp.json()
        assert len(upcoming_appts) >= 1
        now_iso = datetime.now(timezone.utc).isoformat()
        for a in upcoming_appts:
            assert a["scheduled_at"] >= now_iso, "Upcoming appointments must strictly be in the future"
            assert a["status"] in ("scheduled", "confirmed")

        # ------------------------------------------------------------------
        # Step 9: Rescheduling Workflow
        # Alice reschedules to new_slot_utc
        # ------------------------------------------------------------------
        resched_resp = await client.post(
            f"/api/v1/appointments/{appt_id}/reschedule",
            headers=alice_headers,
            json={
                "new_scheduled_at": new_slot_utc,
                "reason": "Schedule conflict with work morning meeting",
            },
        )
        assert resched_resp.status_code == 200
        new_appt = resched_resp.json()
        resched_dt = datetime.fromisoformat(new_appt["scheduled_at"])
        if not resched_dt.tzinfo:
            resched_dt = resched_dt.replace(tzinfo=timezone.utc)
        expected_dt = datetime.fromisoformat(new_slot_utc)
        assert resched_dt == expected_dt
        assert new_appt["status"] == "confirmed"

        # Verify old slot is freed and now available for Bob!
        recheck_freed = await client.get(
            f"/api/v1/appointments/availability?doctor_id={dr_chen['id']}&date=2026-10-27",
            headers=bob_headers,
        )
        slot_freed_after = next(s for s in recheck_freed.json()["slots"] if s["iso_datetime"] == target_slot_utc)
        assert slot_freed_after["is_available"] is True

        # ------------------------------------------------------------------
        # Step 10: Cancellation Workflow
        # Alice cancels the rescheduled appointment
        # ------------------------------------------------------------------
        cancel_resp = await client.post(
            f"/api/v1/appointments/{new_appt['id']}/cancel",
            headers=alice_headers,
            json={"cancellation_reason": "Condition improved and patient travelling abroad"},
        )
        assert cancel_resp.status_code == 200
        cancelled_appt = cancel_resp.json()
        assert cancelled_appt["status"] == "cancelled"
        assert cancelled_appt["cancellation_reason"] == "Condition improved and patient travelling abroad"

        # The newly booked slot is now also freed
        recheck_freed2 = await client.get(
            f"/api/v1/appointments/availability?doctor_id={dr_chen['id']}&date=2026-10-27",
            headers=bob_headers,
        )
        slot_0930_after = next(s for s in recheck_freed2.json()["slots"] if s["iso_datetime"] == new_slot_utc)
        assert slot_0930_after["is_available"] is True

        # ------------------------------------------------------------------
        # Step 11: Cross-Patient Isolation & Permissions
        # Bob cannot cancel or view Alice's private appointment details
        # ------------------------------------------------------------------
        bob_peek_resp = await client.get(f"/api/v1/appointments/{appt_id}", headers=bob_headers)
        assert bob_peek_resp.status_code in (403, 404), "Patient Bob must not access Alice's appointment"

        bob_tamper_cancel = await client.post(
            f"/api/v1/appointments/{appt_id}/cancel",
            headers=bob_headers,
            json={"cancellation_reason": "Malicious cancellation attempt"},
        )
        assert bob_tamper_cancel.status_code in (403, 404), "Patient Bob must not cancel Alice's appointment"

        # ------------------------------------------------------------------
        # Step 12: Doctor and Admin Visibility
        # Doctor Sarah Chen can view appointments assigned to her
        # Admin Arthur Vance can view all appointments
        # ------------------------------------------------------------------
        doc_view_resp = await client.get("/api/v1/appointments", headers=doc_headers)
        assert doc_view_resp.status_code == 200
        doc_appts = doc_view_resp.json()
        assert isinstance(doc_appts, list)

        adm_view_resp = await client.get("/api/v1/appointments", headers=adm_headers)
        assert adm_view_resp.status_code == 200
        adm_appts = adm_view_resp.json()
        assert len(adm_appts) >= 1


@pytest.mark.asyncio
async def test_september_30_past_date_filtering():
    """
    Direct regression test for the screenshot bug:
    An appointment scheduled on September 30, 2026 MUST NOT appear under Upcoming
    when the current date is in mid-October 2026. It MUST appear under Past.
    """
    from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
    from app.models.patient import Patient
    from app.models.doctor import Doctor
    from sqlalchemy import select
    import uuid

    async with AsyncSessionFactory() as session:
        # Find Alice Johnson patient profile
        res_pat = await session.execute(
            select(Patient).join(Patient.user).where(Patient.user.has(email="alice.johnson@medicare.ai"))
        )
        pat = res_pat.scalar_one()

        # Find Dr. Sarah Chen
        res_doc = await session.execute(
            select(Doctor).join(Doctor.user).where(Doctor.user.has(email="sarah.chen@medicare.ai"))
        )
        doc = res_doc.scalar_one()

        # Insert past appointment from September 30, 2026
        past_appt_id = uuid.uuid4()
        past_appt = Appointment(
            id=past_appt_id,
            patient_id=pat.id,
            doctor_id=doc.id,
            scheduled_at=datetime(2026, 9, 30, 14, 0, tzinfo=timezone.utc),
            duration_minutes=30,
            status=AppointmentStatus.CONFIRMED,
            appointment_type=AppointmentType.IN_PERSON,
            reason="Historical Cardiology Baseline Examination (September 30, 2026)",
            booking_reference="MC-2026-SEP30",
        )
        session.add(past_appt)
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login Alice
        res_alice = await client.post(
            "/api/v1/auth/login",
            json={"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"},
        )
        alice_headers = {"Authorization": f"Bearer {res_alice.json()['access_token']}"}

        # Query Upcoming
        up_resp = await client.get("/api/v1/appointments?time_frame=upcoming", headers=alice_headers)
        assert up_resp.status_code == 200
        up_ids = [a["id"] for a in up_resp.json()]
        assert str(past_appt_id) not in up_ids, "September 30 appointment must NEVER appear in upcoming on October 15"

        # Query Past
        past_resp = await client.get("/api/v1/appointments?time_frame=past", headers=alice_headers)
        assert past_resp.status_code == 200
        past_ids = [a["id"] for a in past_resp.json()]
        assert str(past_appt_id) in past_ids, "September 30 appointment MUST appear under past appointments"
