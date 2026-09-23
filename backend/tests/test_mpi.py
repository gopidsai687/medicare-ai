"""
Unit tests for MPI (Master Patient Index) probabilistic linkage algorithm.
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.mpi import calculate_mpi_score, string_similarity


class TestMPILinkage(unittest.TestCase):
    def test_identical_profiles(self):
        p1 = {
            "full_name": "Alice Johnson",
            "date_of_birth": "1978-03-14",
            "phone": "5552345678",
            "zip_code": "97477",
            "gender": "female",
            "blood_type": "A+",
        }
        p2 = {
            "full_name": "Alice Johnson",
            "date_of_birth": "1978-03-14",
            "phone": "(555) 234-5678",
            "zip_code": "97477",
            "gender": "female",
            "blood_type": "A+",
        }
        score = calculate_mpi_score(p1, p2)
        self.assertEqual(score, 1.0)

    def test_phonetic_variation_duplicate(self):
        p1 = {
            "full_name": "Alice Johnson",
            "date_of_birth": "1978-03-14",
            "phone": "(555) 234-5678",
            "zip_code": "97477",
            "gender": "female",
            "blood_type": "A+",
        }
        p2 = {
            "full_name": "Alyce Johnson",
            "date_of_birth": "1978-03-14",
            "phone": "555-234-5678",
            "zip_code": "97477",
            "gender": "female",
            "blood_type": "A+",
        }
        score = calculate_mpi_score(p1, p2)
        # Should be well above duplicate threshold (0.75)
        self.assertGreaterEqual(score, 0.90)

    def test_completely_different_patients(self):
        p1 = {
            "full_name": "Alice Johnson",
            "date_of_birth": "1978-03-14",
            "phone": "(555) 234-5678",
            "zip_code": "97477",
            "gender": "female",
            "blood_type": "A+",
        }
        p2 = {
            "full_name": "David Kim",
            "date_of_birth": "1955-01-30",
            "phone": "(555) 901-2345",
            "zip_code": "92501",
            "gender": "male",
            "blood_type": "O+",
        }
        score = calculate_mpi_score(p1, p2)
        self.assertLess(score, 0.20)

    def test_string_similarity_edge_cases(self):
        self.assertEqual(string_similarity(None, "test"), 0.0)
        self.assertEqual(string_similarity("", "test"), 0.0)
        self.assertEqual(string_similarity("John", "john"), 1.0)


if __name__ == "__main__":
    unittest.main()
