"""
Unit tests for AI Clinical Assistant service and Drug Interaction Screening.
"""
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.ai_service import AIService


class TestAIService(unittest.TestCase):
    def setUp(self):
        self.ai = AIService()

    def test_drug_interaction_high_risk_pair(self):
        # Lisinopril (ACEi) + Spironolactone (K+ sparing diuretic) -> Hyperkalemia risk
        meds = ["Lisinopril 10mg", "Spironolactone 25mg", "Metformin 500mg"]
        result = self.ai.check_drug_interactions(meds)
        self.assertGreaterEqual(result["interaction_count"], 1)
        self.assertTrue(result["has_critical"])
        self.assertTrue(any("Hyperkalaemia" in item["effect"] or "Hyperkalemia" in item["effect"] or "potassium" in item["effect"].lower() for item in result["interactions"]))

    def test_drug_interaction_anticoagulant_nsaid(self):
        # Warfarin + Aspirin -> Elevated bleeding risk
        meds = ["Warfarin 5mg", "Aspirin 81mg"]
        result = self.ai.check_drug_interactions(meds)
        self.assertGreaterEqual(result["interaction_count"], 1)
        self.assertTrue(result["has_critical"])

    def test_benign_medication_regimen(self):
        # Benign combination without contraindications
        meds = ["Acetaminophen 500mg", "Amoxicillin 500mg"]
        result = self.ai.check_drug_interactions(meds)
        self.assertEqual(result["interaction_count"], 0)
        self.assertFalse(result["has_critical"])

    def test_emergency_clinical_fallback(self):
        emergency_query = "I am having crushing chest pain and shortness of breath"
        response = self.ai._clinical_fallback(emergency_query, "patient", None, None)
        self.assertIn("Emergency", response)
        self.assertIn("911", response)


if __name__ == "__main__":
    unittest.main()
