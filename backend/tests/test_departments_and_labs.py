"""
Unit tests for Department, Labs, and Clinical Provider routes and schemas.
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.v1.departments import DepartmentSchema, DepartmentCreate
from app.api.v1.labs import LabTestSchema, LabPanelSchema, LabOrderCreate
from app.api.v1.users import DoctorCreateInput
from app.main import app


class TestDepartmentSchemas(unittest.TestCase):
    """Test validation and default values for Department schemas."""

    def test_department_schema_valid(self):
        data = {
            "id": "dept-101",
            "name": "Cardiology",
            "code": "CARD",
            "director": "Dr. Sarah Chen",
            "location": "North Wing Floor 3",
            "bedsTotal": 60,
            "bedsOccupied": 45,
            "staffCount": 20,
            "monthlyVisits": 550,
            "status": "Operational",
            "phone": "(555) 019-2831",
        }
        dept = DepartmentSchema(**data)
        self.assertEqual(dept.name, "Cardiology")
        self.assertEqual(dept.code, "CARD")
        self.assertEqual(dept.bedsTotal, 60)
        self.assertEqual(dept.bedsOccupied, 45)

    def test_department_schema_defaults(self):
        dept = DepartmentSchema(id="dept-102", name="Neurology", code="NEUR")
        self.assertEqual(dept.director, "Dr. Medical Director")
        self.assertEqual(dept.bedsTotal, 50)
        self.assertEqual(dept.status, "Operational")

    def test_department_create_payload(self):
        payload = DepartmentCreate(name="Orthopedics", code="ORTHO", location="West Wing")
        self.assertEqual(payload.name, "Orthopedics")
        self.assertEqual(payload.code, "ORTHO")
        self.assertEqual(payload.location, "West Wing")


class TestLabSchemas(unittest.TestCase):
    """Test validation and structure for LabTestSchema and LabPanelSchema."""

    def test_lab_test_schema(self):
        test_data = {
            "id": "test-1",
            "name": "Serum Potassium",
            "value": 4.2,
            "unit": "mmol/L",
            "rangeMin": 3.5,
            "rangeMax": 5.0,
            "status": "Normal",
            "trend": "stable",
            "date": "2026-09-22",
        }
        test = LabTestSchema(**test_data)
        self.assertEqual(test.name, "Serum Potassium")
        self.assertEqual(test.value, 4.2)
        self.assertEqual(test.status, "Normal")

    def test_lab_panel_schema(self):
        panel_data = {
            "id": "panel-1",
            "title": "Basic Metabolic Panel (BMP)",
            "orderedBy": "Dr. Sarah Chen",
            "date": "2026-09-22",
            "tests": [
                {
                    "id": "test-1",
                    "name": "Glucose",
                    "value": 95.0,
                    "unit": "mg/dL",
                    "rangeMin": 70.0,
                    "rangeMax": 99.0,
                    "status": "Normal",
                }
            ],
        }
        panel = LabPanelSchema(**panel_data)
        self.assertEqual(panel.title, "Basic Metabolic Panel (BMP)")
        self.assertEqual(len(panel.tests), 1)

    def test_lab_order_create_schema(self):
        order_data = {
            "panel_name": "Comprehensive Metabolic Panel (CMP)",
            "priority": "URGENT",
            "fasting": True,
            "clinical_indication": "Pre-operative evaluation",
        }
        order = LabOrderCreate(**order_data)
        self.assertEqual(order.panel_name, "Comprehensive Metabolic Panel (CMP)")
        self.assertEqual(order.priority, "URGENT")
        self.assertTrue(order.fasting)

    def test_doctor_create_input_schema(self):
        doc_data = {
            "name": "Dr. Emily Watson",
            "email": "emily.watson@medicare.ai",
            "specialty": "Pediatrics",
            "dept": "Pediatric Medicine",
            "license": "MD-2026-9812",
        }
        doc = DoctorCreateInput(**doc_data)
        self.assertEqual(doc.name, "Dr. Emily Watson")
        self.assertEqual(doc.specialty, "Pediatrics")
        self.assertEqual(doc.password, "DoctorPass123!")


class TestAppRouting(unittest.TestCase):
    """Ensure all required API routers are registered in the FastAPI app."""

    def test_routes_registered(self):
        route_paths = [r.path for r in app.routes]

        # Verify critical endpoints are mounted
        self.assertIn("/api/health", route_paths)
        self.assertIn("/api/v1/labs", route_paths)
        self.assertIn("/api/v1/labs/orders", route_paths)
        self.assertIn("/api/v1/labs/orders/{order_id}/sign", route_paths)
        self.assertIn("/api/v1/departments", route_paths)
        self.assertIn("/api/v1/users/doctors", route_paths)
        self.assertIn("/api/v1/appointments", route_paths)
        self.assertIn("/api/v1/records", route_paths)
        self.assertIn("/api/v1/prescriptions", route_paths)
        self.assertIn("/api/v1/patients", route_paths)
        self.assertIn("/api/v1/patients/count", route_paths)


if __name__ == "__main__":
    unittest.main()
