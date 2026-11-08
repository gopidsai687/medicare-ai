"""
Seed script for Diagnostic Lab Results and Medical Records with proper historical tracking and linkages.
"""
import asyncio
import sys
import uuid
from datetime import date

sys.path.insert(0, ".")

from app.core.database import AsyncSessionFactory
from app.models.patient import Patient
from app.models.medical_record import MedicalRecord, RecordCategory, RecordStatus
from app.models.lab_result import LabResult, LabResultAuditLog
from sqlalchemy import select


async def seed_data():
    async with AsyncSessionFactory() as session:
        res = await session.execute(select(Patient))
        patients = res.scalars().all()
        if not patients:
            print("No patients found in DB")
            return

        for pat in patients:
            # Check existing lab results
            c_res = await session.execute(select(LabResult).where(LabResult.patient_id == pat.id))
            existing_labs = c_res.scalars().all()
            if not existing_labs:
                labs = [
                    # CMP on 2026-09-18
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Fasting Blood Glucose",
                        panel_name="Comprehensive Metabolic Panel (CMP)",
                        category="CMP",
                        value=104.0,
                        unit="mg/dL",
                        range_min=70.0,
                        range_max=99.0,
                        reference_range="70 – 99 mg/dL",
                        test_date=date(2026, 9, 18),
                        status="Elevated",
                        trend="down",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                        clinical_notes="Mildly elevated fasting plasma glucose.",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Blood Urea Nitrogen (BUN)",
                        panel_name="Comprehensive Metabolic Panel (CMP)",
                        category="CMP",
                        value=16.0,
                        unit="mg/dL",
                        range_min=7.0,
                        range_max=20.0,
                        reference_range="7 – 20 mg/dL",
                        test_date=date(2026, 9, 18),
                        status="Normal",
                        trend="stable",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Serum Creatinine",
                        panel_name="Comprehensive Metabolic Panel (CMP)",
                        category="CMP",
                        value=0.95,
                        unit="mg/dL",
                        range_min=0.6,
                        range_max=1.2,
                        reference_range="0.6 – 1.2 mg/dL",
                        test_date=date(2026, 9, 18),
                        status="Normal",
                        trend="stable",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Serum Sodium",
                        panel_name="Comprehensive Metabolic Panel (CMP)",
                        category="CMP",
                        value=140.0,
                        unit="mEq/L",
                        range_min=135.0,
                        range_max=145.0,
                        reference_range="135 – 145 mEq/L",
                        test_date=date(2026, 9, 18),
                        status="Normal",
                        trend="stable",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Serum Potassium",
                        panel_name="Comprehensive Metabolic Panel (CMP)",
                        category="CMP",
                        value=4.2,
                        unit="mEq/L",
                        range_min=3.5,
                        range_max=5.0,
                        reference_range="3.5 – 5.0 mEq/L",
                        test_date=date(2026, 9, 18),
                        status="Normal",
                        trend="stable",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="eGFR",
                        panel_name="Comprehensive Metabolic Panel (CMP)",
                        category="CMP",
                        value=92.0,
                        unit="mL/min/1.73m²",
                        range_min=60.0,
                        range_max=120.0,
                        reference_range="60 – 120 mL/min/1.73m²",
                        test_date=date(2026, 9, 18),
                        status="Normal",
                        trend="stable",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    # Historical Fasting Glucose on 2026-02-01 (Intake diabetes record)
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Fasting Blood Glucose",
                        panel_name="Diagnostic Blood Glucose Log",
                        category="CMP",
                        value=118.0,
                        unit="mg/dL",
                        range_min=70.0,
                        range_max=99.0,
                        reference_range="70 – 99 mg/dL",
                        test_date=date(2026, 2, 1),
                        status="Elevated",
                        trend="down",
                        ordering_physician="Dr. James Kim, MD",
                        laboratory_name="Ambulatory Care Lab",
                        source="patient_entered",
                        clinical_notes="Initial baseline reading documented during Type 2 Diabetes clinical review.",
                    ),
                    # Lipid Panel on 2026-09-18
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Total Cholesterol",
                        panel_name="Lipid Panel",
                        category="Lipid Panel",
                        value=188.0,
                        unit="mg/dL",
                        range_min=125.0,
                        range_max=200.0,
                        reference_range="125 – 200 mg/dL",
                        test_date=date(2026, 9, 18),
                        status="Normal",
                        trend="down",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="LDL Cholesterol",
                        panel_name="Lipid Panel",
                        category="Lipid Panel",
                        value=108.0,
                        unit="mg/dL",
                        range_min=0.0,
                        range_max=100.0,
                        reference_range="0 – 100 mg/dL",
                        test_date=date(2026, 9, 18),
                        status="Elevated",
                        trend="down",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="HDL Cholesterol",
                        panel_name="Lipid Panel",
                        category="Lipid Panel",
                        value=52.0,
                        unit="mg/dL",
                        range_min=40.0,
                        range_max=60.0,
                        reference_range="40 – 60 mg/dL",
                        test_date=date(2026, 9, 18),
                        status="Normal",
                        trend="up",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Triglycerides",
                        panel_name="Lipid Panel",
                        category="Lipid Panel",
                        value=142.0,
                        unit="mg/dL",
                        range_min=0.0,
                        range_max=150.0,
                        reference_range="0 – 150 mg/dL",
                        test_date=date(2026, 9, 18),
                        status="Normal",
                        trend="down",
                        ordering_physician="Dr. Sarah Chen, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                    # HbA1c Historical Trend (2025-11-15: 7.4%, 2026-03-20: 7.1%, 2026-08-10: 6.8%)
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Hemoglobin A1c",
                        panel_name="Glycated Hemoglobin (HbA1c)",
                        category="HbA1c",
                        value=7.4,
                        unit="%",
                        range_min=4.0,
                        range_max=5.6,
                        reference_range="4.0 – 5.6 %",
                        test_date=date(2025, 11, 15),
                        status="Elevated",
                        trend="stable",
                        ordering_physician="Dr. James Kim, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                        clinical_notes="Initial post-diagnosis HbA1c measurement.",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Hemoglobin A1c",
                        panel_name="Glycated Hemoglobin (HbA1c)",
                        category="HbA1c",
                        value=7.1,
                        unit="%",
                        range_min=4.0,
                        range_max=5.6,
                        reference_range="4.0 – 5.6 %",
                        test_date=date(2026, 3, 20),
                        status="Elevated",
                        trend="down",
                        ordering_physician="Dr. James Kim, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                        clinical_notes="Interval improvement following Metformin titration.",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Hemoglobin A1c",
                        panel_name="Glycated Hemoglobin (HbA1c)",
                        category="HbA1c",
                        value=6.8,
                        unit="%",
                        range_min=4.0,
                        range_max=5.6,
                        reference_range="4.0 – 5.6 %",
                        test_date=date(2026, 8, 10),
                        status="Elevated",
                        trend="down",
                        ordering_physician="Dr. James Kim, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                        clinical_notes="Continuous glycemic improvement. Target < 7.0% achieved.",
                    ),
                    LabResult(
                        id=uuid.uuid4(),
                        patient_id=pat.id,
                        test_name="Estimated Average Glucose (eAG)",
                        panel_name="Glycated Hemoglobin (HbA1c)",
                        category="HbA1c",
                        value=148.0,
                        unit="mg/dL",
                        range_min=70.0,
                        range_max=114.0,
                        reference_range="70 – 114 mg/dL",
                        test_date=date(2026, 8, 10),
                        status="Elevated",
                        trend="down",
                        ordering_physician="Dr. James Kim, MD",
                        laboratory_name="MediCare Central Pathology Lab",
                        source="lab_imported",
                    ),
                ]
                session.add_all(labs)
                print(f"Seeded {len(labs)} lab results for patient {pat.id}")

            # Update medical records with providers and linked lab results
            m_res = await session.execute(select(MedicalRecord).where(MedicalRecord.patient_id == pat.id))
            med_recs = m_res.scalars().all()
            for mr in med_recs:
                if not mr.provider:
                    if "Chen" in (mr.description or ""):
                        mr.provider = "Dr. Sarah Chen (Cardiology)"
                    elif "Kim" in (mr.description or ""):
                        mr.provider = "Dr. James Kim (Endocrinology)"
                    else:
                        mr.provider = "MetroHealth Clinical Services"
                if not mr.source:
                    mr.source = "clinician_confirmed"

            # Check if common diagnoses and allergies exist
            existing_titles = {mr.title.lower() for mr in med_recs}
            extra_records = []
            if "type 2 diabetes mellitus" not in existing_titles:
                extra_records.append(MedicalRecord(
                    id=uuid.uuid4(),
                    patient_id=pat.id,
                    category=RecordCategory.DIAGNOSIS,
                    title="Type 2 Diabetes Mellitus",
                    icd10_code="E11.9",
                    record_date=date(2023, 6, 12),
                    status=RecordStatus.CHRONIC,
                    severity="Moderate",
                    provider="Dr. James Kim (Endocrinology)",
                    source="clinician_confirmed",
                    description="Managed with Metformin 500mg BID and dietary interventions. Target HbA1c < 7.0%.",
                    notes="Patient advised to monitor blood glucose twice weekly and maintain low glycemic diet.",
                ))
            if "essential hypertension — stage 1" not in existing_titles and "essential hypertension (mild)" not in existing_titles:
                extra_records.append(MedicalRecord(
                    id=uuid.uuid4(),
                    patient_id=pat.id,
                    category=RecordCategory.DIAGNOSIS,
                    title="Essential Hypertension — Stage 1",
                    icd10_code="I10",
                    record_date=date(2022, 3, 18),
                    status=RecordStatus.ACTIVE,
                    severity="Mild",
                    provider="Dr. Sarah Chen (Cardiology)",
                    source="clinician_confirmed",
                    description="Controlled on Lisinopril 10mg daily. Ambulatory BP monitoring recommended every 6 months.",
                    notes="Average home readings 128/82 mmHg.",
                ))
            if "penicillin & amoxicillin" not in existing_titles and "penicillin" not in existing_titles:
                extra_records.append(MedicalRecord(
                    id=uuid.uuid4(),
                    patient_id=pat.id,
                    category=RecordCategory.ALLERGY,
                    title="Penicillin & Amoxicillin",
                    record_date=date(2015, 5, 20),
                    status=RecordStatus.ACTIVE,
                    severity="Severe",
                    provider="Dr. Maria Lopez (General Practice)",
                    source="clinician_confirmed",
                    description="Hives, angioedema, and airway tightness upon ingestion. Cross-reactivity warning active.",
                    notes="Prescribe cephalosporins with caution or alternative macrolide antibiotics.",
                ))
            if "laparoscopic appendectomy" not in existing_titles:
                extra_records.append(MedicalRecord(
                    id=uuid.uuid4(),
                    patient_id=pat.id,
                    category=RecordCategory.SURGERY,
                    title="Laparoscopic Appendectomy",
                    record_date=date(2019, 1, 14),
                    status=RecordStatus.RESOLVED,
                    provider="Dr. Robert Patel (General Surgery)",
                    source="clinician_confirmed",
                    description="Uncomplicated acute appendicitis. Three-port laparoscopic resection without rupture.",
                    notes="Post-operative recovery uneventful. Incisions fully healed.",
                ))
            if "influenza vaccine (quadrivalent)" not in existing_titles:
                extra_records.append(MedicalRecord(
                    id=uuid.uuid4(),
                    patient_id=pat.id,
                    category=RecordCategory.IMMUNIZATION,
                    title="Influenza Vaccine (Quadrivalent)",
                    record_date=date(2025, 10, 10),
                    status=RecordStatus.ACTIVE,
                    provider="MetroHealth Pharmacy Clinic",
                    source="clinician_confirmed",
                    description="Annual seasonal flu prophylaxis. Lot #FL-88912.",
                    notes="No adverse reactions noted post 15-minute observation.",
                ))
            if "covid-19 updated booster (mrna)" not in existing_titles:
                extra_records.append(MedicalRecord(
                    id=uuid.uuid4(),
                    patient_id=pat.id,
                    category=RecordCategory.IMMUNIZATION,
                    title="COVID-19 Updated Booster (mRNA)",
                    record_date=date(2025, 9, 2),
                    status=RecordStatus.ACTIVE,
                    provider="MetroHealth Main Clinic",
                    source="clinician_confirmed",
                    description="Monovalent spike antigen booster. Lot #CV-39210.",
                    notes="Mild localized arm soreness for 24 hours.",
                ))
            if extra_records:
                session.add_all(extra_records)
                print(f"Seeded {len(extra_records)} additional EHR records for patient {pat.id}")

        await session.commit()
        print("Data seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_data())
