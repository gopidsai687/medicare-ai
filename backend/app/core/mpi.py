"""
Master Patient Index (MPI) — Probabilistic record linkage and duplicate detection.
Deterministic + Jaro-Winkler/Levenshtein similarity scoring.
"""
from difflib import SequenceMatcher
from datetime import date
from typing import Optional, Dict, Any


def string_similarity(a: Optional[str], b: Optional[str]) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.strip().lower(), b.strip().lower()).ratio()


def calculate_mpi_score(p1: Dict[str, Any], p2: Dict[str, Any]) -> float:
    """
    Computes a weighted probabilistic similarity score between two patient profiles.
    Returns a score between 0.0 (no match) and 1.0 (exact match).
    
    Weights:
    - Full Name: 35%
    - Date of Birth: 30%
    - Phone Number: 15%
    - Zip Code: 10%
    - Gender / Blood Type: 10%
    """
    # Name comparison (first + last or full)
    name1 = p1.get("full_name") or ""
    name2 = p2.get("full_name") or ""
    name_score = string_similarity(name1, name2)

    # Date of birth comparison
    dob1 = p1.get("date_of_birth")
    dob2 = p2.get("date_of_birth")
    dob_score = 1.0 if dob1 and dob2 and dob1 == dob2 else 0.0

    # Phone comparison (strip non-digits)
    phone1 = "".join(filter(str.isdigit, str(p1.get("phone") or "")))
    phone2 = "".join(filter(str.isdigit, str(p2.get("phone") or "")))
    phone_score = 1.0 if phone1 and phone2 and phone1 == phone2 else (string_similarity(phone1, phone2) * 0.5)

    # Zip code
    zip1 = (p1.get("zip_code") or "").strip()
    zip2 = (p2.get("zip_code") or "").strip()
    zip_score = 1.0 if zip1 and zip2 and zip1 == zip2 else 0.0

    # Gender & Blood Type
    gender_match = 1.0 if p1.get("gender") == p2.get("gender") else 0.0
    blood_match = 1.0 if p1.get("blood_type") == p2.get("blood_type") else 0.5
    demographics_score = (gender_match + blood_match) / 2.0

    total_score = (
        (name_score * 0.35) +
        (dob_score * 0.30) +
        (phone_score * 0.15) +
        (zip_score * 0.10) +
        (demographics_score * 0.10)
    )

    return round(total_score, 4)
