"""
Unit tests for password cryptography and JWT token management.
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from app.core.security import (
        hash_password,
        verify_password,
        create_access_token,
        create_refresh_token,
        decode_token,
    )
    SECURITY_AVAILABLE = True
except ImportError:
    SECURITY_AVAILABLE = False


class TestSecurity(unittest.TestCase):
    def setUp(self):
        if not SECURITY_AVAILABLE:
            self.skipTest("jose or passlib not installed in current python environment")

    def test_password_hashing_and_verification(self):
        raw_pwd = "SecureClinicalPassword123!"
        hashed = hash_password(raw_pwd)
        self.assertNotEqual(raw_pwd, hashed)
        self.assertTrue(verify_password(raw_pwd, hashed))
        self.assertFalse(verify_password("WrongPassword123!", hashed))

    def test_jwt_access_token_creation_and_decoding(self):
        user_id = "user-12345"
        role = "doctor"
        token = create_access_token(user_id, role)
        self.assertIsInstance(token, str)
        self.assertGreater(len(token), 20)

        payload = decode_token(token)
        self.assertEqual(payload["sub"], user_id)
        self.assertEqual(payload["role"], role)
        self.assertEqual(payload["type"], "access")
        self.assertIn("exp", payload)

    def test_jwt_refresh_token(self):
        user_id = "user-67890"
        token = create_refresh_token(user_id)
        payload = decode_token(token)
        self.assertEqual(payload["sub"], user_id)
        self.assertEqual(payload["type"], "refresh")


if __name__ == "__main__":
    unittest.main()
