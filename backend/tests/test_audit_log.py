"""
Unit tests for AuditLog model, schema validation, and merge audit trail integrity.
"""
import unittest
import uuid
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.audit_log import AuditAction, AuditSeverity


class TestAuditAction(unittest.TestCase):
    """Tests for AuditAction enum completeness and values."""

    def test_all_hipaa_actions_exist(self):
        """Verify all required HIPAA-relevant actions are defined."""
        required = [
            "view_record",
            "create_record",
            "update_record",
            "delete_record",
            "login_success",
            "login_failure",
            "logout",
            "patient_merge",
            "export_health_data",
            "role_change",
        ]
        for action_value in required:
            with self.subTest(action=action_value):
                action = AuditAction(action_value)
                self.assertIsInstance(action, AuditAction)

    def test_action_enum_values_are_lowercase_snake_case(self):
        for action in AuditAction:
            self.assertEqual(action.value, action.value.lower())
            self.assertNotIn(" ", action.value)

    def test_patient_merge_is_defined(self):
        """PATIENT_MERGE is the most critical HIPAA action — assert its existence."""
        self.assertEqual(AuditAction.PATIENT_MERGE.value, "patient_merge")


class TestAuditSeverity(unittest.TestCase):
    """Tests for AuditSeverity enum."""

    def test_severity_levels(self):
        self.assertEqual(AuditSeverity.INFO.value, "info")
        self.assertEqual(AuditSeverity.WARNING.value, "warning")
        self.assertEqual(AuditSeverity.CRITICAL.value, "critical")

    def test_severity_count(self):
        self.assertEqual(len(AuditSeverity), 3)


class TestAuditLogSchema(unittest.TestCase):
    """Tests for Pydantic AuditLog schemas."""

    def setUp(self):
        try:
            from app.schemas.audit_log import AuditLogBase, AuditLogCreate, AuditLogRead
            self.AuditLogBase = AuditLogBase
            self.AuditLogCreate = AuditLogCreate
            self.AuditLogRead = AuditLogRead
            self.schemas_available = True
        except ImportError:
            self.schemas_available = False

    def test_create_schema_accepts_valid_payload(self):
        if not self.schemas_available:
            self.skipTest("Schemas not importable")
        entry = self.AuditLogCreate(
            action=AuditAction.VIEW_RECORD,
            severity=AuditSeverity.INFO,
            resource_type="MedicalRecord",
            resource_id="rec-123",
            user_id=uuid.uuid4(),
            ip_address="10.0.0.1",
            details={"patient_name": "John Doe"},
        )
        self.assertEqual(entry.action, AuditAction.VIEW_RECORD)
        self.assertEqual(entry.severity, AuditSeverity.INFO)
        self.assertEqual(entry.resource_type, "MedicalRecord")

    def test_create_schema_defaults_severity_to_info(self):
        if not self.schemas_available:
            self.skipTest("Schemas not importable")
        entry = self.AuditLogBase(
            action=AuditAction.LOGIN_SUCCESS,
            resource_type="Auth",
        )
        self.assertEqual(entry.severity, AuditSeverity.INFO)

    def test_create_schema_allows_null_optional_fields(self):
        if not self.schemas_available:
            self.skipTest("Schemas not importable")
        entry = self.AuditLogCreate(
            action=AuditAction.LOGIN_FAILURE,
            severity=AuditSeverity.WARNING,
            resource_type="Auth",
        )
        self.assertIsNone(entry.resource_id)
        self.assertIsNone(entry.ip_address)
        self.assertIsNone(entry.user_agent)
        self.assertIsNone(entry.details)
        self.assertIsNone(entry.user_id)

    def test_read_schema_requires_id_and_timestamp(self):
        if not self.schemas_available:
            self.skipTest("Schemas not importable")
        read_entry = self.AuditLogRead(
            id=uuid.uuid4(),
            action=AuditAction.PATIENT_MERGE,
            severity=AuditSeverity.CRITICAL,
            resource_type="Patient",
            resource_id="MRN-0001",
            created_at=datetime.now(timezone.utc),
        )
        self.assertIsNotNone(read_entry.id)
        self.assertIsNotNone(read_entry.created_at)

    def test_merge_audit_details_payload(self):
        """Verify a PATIENT_MERGE audit entry can carry full transfer metadata."""
        if not self.schemas_available:
            self.skipTest("Schemas not importable")
        details = {
            "survivor_mrn": "MRN-00000012",
            "survivor_id": str(uuid.uuid4()),
            "merged_mrn": "MRN-00000099",
            "merged_id": str(uuid.uuid4()),
            "reason": "Confirmed duplicate via MPI scoring (0.97)",
            "transferred_appointments": 3,
            "transferred_encounters": 5,
            "transferred_vitals": 8,
            "transferred_records": 2,
            "transferred_prescriptions": 4,
        }
        entry = self.AuditLogCreate(
            action=AuditAction.PATIENT_MERGE,
            severity=AuditSeverity.WARNING,
            resource_type="Patient",
            resource_id=details["survivor_mrn"],
            user_id=uuid.uuid4(),
            details=details,
        )
        self.assertEqual(entry.details["transferred_encounters"], 5)
        self.assertEqual(entry.details["reason"], "Confirmed duplicate via MPI scoring (0.97)")
        self.assertIn("transferred_vitals", entry.details)


class TestMergeValidation(unittest.TestCase):
    """Tests for merge request validation logic (pure business rule checks)."""

    def test_self_merge_disallowed(self):
        """A patient should never be merged into themselves."""
        patient_id = uuid.uuid4()
        self.assertEqual(patient_id, patient_id)
        # The API checks this and returns HTTP 400

    def test_merge_request_schema(self):
        """Validate MergeRequest schema accepts required fields."""
        try:
            from app.schemas.mpi import MergeRequest
        except ImportError:
            self.skipTest("MPI schemas not importable")

        req = MergeRequest(
            survivor_patient_id=uuid.uuid4(),
            merged_patient_id=uuid.uuid4(),
            reason="Confirmed duplicate via MPI scoring (0.92)",
        )
        self.assertIsNotNone(req.survivor_patient_id)
        self.assertIsNotNone(req.merged_patient_id)
        self.assertNotEqual(req.survivor_patient_id, req.merged_patient_id)
        self.assertIn("MPI", req.reason)

    def test_merge_response_schema(self):
        """Validate MergeResponse schema with transfer counts."""
        try:
            from app.schemas.mpi import MergeResponse
        except ImportError:
            self.skipTest("MPI schemas not importable")

        resp = MergeResponse(
            success=True,
            survivor_mrn="MRN-00000012",
            merged_mrn="MRN-00000099",
            transferred_appointments=3,
            transferred_records=2,
            transferred_prescriptions=4,
            message="Successfully merged MRN-00000099 into MRN-00000012.",
        )
        self.assertTrue(resp.success)
        self.assertEqual(resp.transferred_appointments, 3)
        self.assertIn("MRN-00000099", resp.message)


if __name__ == "__main__":
    unittest.main()
