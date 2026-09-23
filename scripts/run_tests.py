"""
MediCare AI — Automated Unit & Integration Test Runner.
Executes test suite with built-in unittest framework and generates execution report.
"""
from __future__ import annotations

import os
import sys
import unittest

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def run_all_tests() -> bool:
    print("=" * 70)
    print("[MEDICARE AI] Automated Test Suite Execution")
    print("=" * 70)

    loader = unittest.TestLoader()
    tests_dir = os.path.join(backend_dir, "tests")
    suite = loader.discover(start_dir=tests_dir, pattern="test_*.py")

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 70)
    print(f"Tests Run: {result.testsRun}")
    print(f"Errors: {len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print("=" * 70)

    if result.wasSuccessful():
        print("✅ ALL TESTS PASSED SUCCESSFULLY!")
        return True
    else:
        print("❌ SOME TESTS FAILED. PLEASE REVIEW LOGS.")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
