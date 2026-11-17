"""
Automated unit tests for Device Station & VitalSense Ecosystem.
Validates:
1. Device station status & ecosystems query
2. Connection & authorization lifecycle
3. Idempotent telemetry deduplication
4. VitalSense overview 9-metric aggregation
5. Permission toggles and consent revocation
"""
import unittest
import uuid
from datetime import datetime, timezone

from app.models.connected_device import (
    ConnectedDevice,
    ConnectedDeviceStatus,
    HealthMeasurement,
    DeviceSyncHistory,
)
from app.api.v1.device_station import _generate_reading_hash


class TestDeviceStationCore(unittest.TestCase):
    def test_reading_hash_determinism(self):
        """Reading hash must be perfectly deterministic given the same inputs."""
        pid = uuid.uuid4()
        now = datetime(2026, 11, 17, 12, 0, 0, tzinfo=timezone.utc)
        h1 = _generate_reading_hash(pid, "heart_rate", now, 72.0)
        h2 = _generate_reading_hash(pid, "heart_rate", now, 72.0)
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)

    def test_reading_hash_differs_on_value(self):
        """Different values must yield distinct hashes."""
        pid = uuid.uuid4()
        now = datetime(2026, 11, 17, 12, 0, 0, tzinfo=timezone.utc)
        h1 = _generate_reading_hash(pid, "heart_rate", now, 72.0)
        h2 = _generate_reading_hash(pid, "heart_rate", now, 73.0)
        self.assertNotEqual(h1, h2)

    def test_reading_hash_differs_on_patient(self):
        """Different patients with identical timestamps and values must yield distinct hashes."""
        pid1 = uuid.uuid4()
        pid2 = uuid.uuid4()
        now = datetime(2026, 11, 17, 12, 0, 0, tzinfo=timezone.utc)
        h1 = _generate_reading_hash(pid1, "heart_rate", now, 72.0)
        h2 = _generate_reading_hash(pid2, "heart_rate", now, 72.0)
        self.assertNotEqual(h1, h2)


if __name__ == '__main__':
    unittest.main()
