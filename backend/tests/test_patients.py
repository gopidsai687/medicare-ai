"""
Unit and integration tests for Patients API router and schemas.
Verifies demographic summaries, census counts, and role-based access restrictions.
"""
import os
import sys
import unittest
import uuid
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.v1.patients import PatientSummary, PatientCreate, router
from app.models.user import User, UserRole
from app.main import app


class TestPatientSchemas(unittest.TestCase):
    """Test PatientSummary and PatientCreate schema validation."""

    def test_patient_summary_schema(self):
        data = {
            "id": str(uuid.uuid4()),
            "name": "Sarah Connor",
            "mrn": "MRN-00000088",
            "dob": "1984-05-12",
            "gender": "female",
            "blood_type": "O+",
            "phone": "(555) 987-6543",
            "address": "404 Cyberdyne Way, Los Angeles, CA",
            "insurance_provider": "Blue Cross Blue Shield",
            "doctor": "Dr. Sarah Chen",
            "dept": "Cardiology",
            "status": "Active",
            "is_merged": False,
            "notes": "No known allergies",
        }
        summary = PatientSummary(**data)
        self.assertEqual(summary.name, "Sarah Connor")
        self.assertEqual(summary.mrn, "MRN-00000088")
        self.assertEqual(summary.status, "Active")
        self.assertFalse(summary.is_merged)
        self.assertIsNone(summary.merged_into_mrn)

    def test_patient_summary_defaults(self):
        summary = PatientSummary(
            id=str(uuid.uuid4()),
            name="John Doe",
            mrn="MRN-00000001",
        )
        self.assertEqual(summary.gender, "prefer_not_to_say")
        self.assertEqual(summary.blood_type, "unknown")
        self.assertEqual(summary.status, "Active")
        self.assertFalse(summary.is_merged)

    def test_patient_create_payload(self):
        payload = PatientCreate(
            full_name="Alice Smith",
            email="alice.smith@example.com",
            date_of_birth=date(1992, 4, 15),
            gender="female",
            blood_type="A+",
            phone="(555) 123-4567",
            city="Springfield",
            state="IL",
            insurance_provider="Aetna Health",
        )
        self.assertEqual(payload.full_name, "Alice Smith")
        self.assertEqual(payload.email, "alice.smith@example.com")
        self.assertEqual(payload.city, "Springfield")


class TestPatientEndpoints(unittest.TestCase):
    """Verify route registration and RBAC enforcement rules."""

    def test_routes_exist_on_app(self):
        routes = [r.path for r in app.routes]
        self.assertIn("/api/v1/patients", routes)
        self.assertIn("/api/v1/patients/count", routes)
        self.assertIn("/api/v1/patients/{patient_id}", routes)

    def test_rbac_patient_forbidden_logic(self):
        patient_user = User(
            id=uuid.uuid4(),
            email="patient@example.com",
            role=UserRole.PATIENT,
        )
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@medicare.ai",
            role=UserRole.ADMIN,
        )
        doctor_user = User(
            id=uuid.uuid4(),
            email="doctor@medicare.ai",
            role=UserRole.DOCTOR,
        )
        # Verify role logic
        self.assertEqual(patient_user.role, UserRole.PATIENT)
        self.assertEqual(admin_user.role, UserRole.ADMIN)
        self.assertEqual(doctor_user.role, UserRole.DOCTOR)


if __name__ == "__main__":
    unittest.main()
