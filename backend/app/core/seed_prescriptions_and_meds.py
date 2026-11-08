"""
Seed verified longitudinal prescriptions & medications for Alice Johnson.
Connects with Medical Documents, Previous AI Analyses, and Medications.
"""
import asyncio
import uuid
from datetime import date, datetime, timezone
from sqlalchemy import select

from app.core.database import AsyncSessionFactory
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.prescription import (
    Prescription,
    PrescriptionStatus,
    PrescriptionAuditLog,
)
from app.models.record_version import RecordVersion
from app.models.medical_record import MedicalRecord, RecordCategory, RecordStatus
from app.models.prescription_analysis import (
    PrescriptionUpload,
    PrescriptionExtractedItem,
    PrescriptionAnalysisReport,
    UploadStatus,
    ReviewStatus,
    MedicationReminder,
)

async def seed_prescriptions():
    async with AsyncSessionFactory() as session:
        # Find Alice Johnson
        stmt = select(User).where(User.email == "patient.alice@medicare.ai")
        res = await session.execute(stmt)
        user = res.scalars().first()
        if not user:
            print("Alice Johnson not found, finding first patient")
            stmt2 = select(User).where(User.role == UserRole.PATIENT)
            user = (await session.execute(stmt2)).scalars().first()
        if not user:
            print("No patient user found!")
            return

        p_stmt = select(Patient).where(Patient.user_id == user.id)
        patient = (await session.execute(p_stmt)).scalars().first()
        if not patient:
            print("No patient record found for user!")
            return

        # Find a doctor
        doc_stmt = select(Doctor).limit(1)
        doc = (await session.execute(doc_stmt)).scalars().first()
        doc_id = doc.id if doc else None

        print(f"Seeding for Patient ID: {patient.id} (User: {user.full_name})")

        # 1. Create a simulated official prescription document upload
        upload_id = uuid.uuid4()
        upload = PrescriptionUpload(
            id=upload_id,
            patient_id=patient.id,
            file_name="rx_metformin_lisinopril_dr_chen.pdf",
            file_type="application/pdf",
            file_size_bytes=42150,
            storage_path="uploads/prescriptions/sample_rx_chen.pdf",
            ocr_raw_text="Rx: MetroHealth Endocrinology Clinic. Metformin 500mg BID with meals. Lisinopril 10mg daily morning. Prescriber: Dr. Sarah Chen, MD.",
            status=UploadStatus.ANALYZED,
            is_manual_entry=False,
        )
        session.add(upload)

        # 2. Add an analysis report for this upload
        report_id = uuid.uuid4()
        report = PrescriptionAnalysisReport(
            id=report_id,
            upload_id=upload_id,
            patient_id=patient.id,
            summary_data={
                "overall_summary": "Active dual maintenance therapy for Type 2 Diabetes and Stage 1 Essential Hypertension. Good adherence reported.",
                "medications_count": 2,
            },
            medication_guidance=[
                {
                    "medication": "Metformin Hydrochloride",
                    "purpose": "First-line biguanide oral antihyperglycemic agent for glycemic management in Type 2 Diabetes.",
                    "administration": "Take 1 tablet (500mg) twice daily with meals to minimize gastrointestinal discomfort.",
                    "precautions": "Avoid excessive alcohol intake. Discontinue temporarily during acute severe illness or before iodinated contrast procedures.",
                },
                {
                    "medication": "Lisinopril",
                    "purpose": "Angiotensin-converting enzyme (ACE) inhibitor for blood pressure control and renal protection.",
                    "administration": "Take 1 tablet (10mg) once daily in the morning with a full glass of water.",
                    "precautions": "Avoid potassium supplements or high-potassium salt substitutes without physician guidance.",
                },
            ],
            next_steps={
                "action_items": [
                    "Take morning Lisinopril dose consistently at 08:00 AM",
                    "Log blood glucose readings in VitalSense twice weekly",
                    "Schedule 6-month comprehensive metabolic panel and HbA1c follow-up",
                ],
                "reminders_suggested": [
                    {"medication": "Metformin", "suggested_time": "08:00 AM & 06:00 PM", "frequency": "Twice daily with meals"},
                    {"medication": "Lisinopril", "suggested_time": "08:00 AM", "frequency": "Once daily morning"},
                ],
            },
            safety_review={
                "requires_pharmacist_review": False,
                "interactions": [],
                "allergy_alerts": [],
                "precautions_count": 2,
            },
            review_status=ReviewStatus.REVIEWED_BY_CLINICIAN,
            ai_provider="medicare-clinical-reasoning-engine",
        )
        session.add(report)

        # 3. Add supporting document to My Medical Documents (medical_records)
        doc_record = MedicalRecord(
            id=uuid.uuid4(),
            patient_id=patient.id,
            category=RecordCategory.OTHER,
            title="Prescription Document: Dr. Sarah Chen (Metformin & Lisinopril)",
            description="Official clinician-issued electronic prescription document from MetroHealth Endocrinology & Cardiology Clinic.",
            record_date=date(2026, 6, 15),
            status=RecordStatus.ACTIVE,
            provider="Dr. Sarah Chen, MD",
            source="clinician_issued",
            is_patient_reported=False,
            supporting_document_url=f"/api/v1/prescription-analysis/uploads/{upload_id}/file",
            notes=f"Linked to Shared Prescription Upload ID: {upload_id}",
            created_by=user.id,
        )
        session.add(doc_record)

        # 4. Seed core prescriptions
        initial_prescriptions = [
            {
                "id": uuid.uuid4(),
                "medication_name": "Metformin Hydrochloride",
                "brand_name": "Glucophage",
                "generic_name": "Metformin HCl",
                "strength": "500 mg",
                "dosage_form": "Oral Tablet",
                "dosage": "500 mg",
                "frequency": "Twice daily with meals",
                "route": "Oral",
                "start_date": date(2023, 6, 12),
                "end_date": None,
                "prescription_date": date(2026, 6, 15),
                "prescribing_doctor_name": "Dr. Sarah Chen, MD (Endocrinology)",
                "pharmacy": "MetroHealth Main Pharmacy (#4102)",
                "refills_remaining": 3,
                "refills_total": 4,
                "instructions": "Take 1 tablet with breakfast and 1 tablet with dinner. Drink plenty of water.",
                "notes": "Target HbA1c < 7.0%. Well tolerated without hypoglycemia.",
                "status": PrescriptionStatus.ACTIVE,
                "source": "clinician_issued",
                "is_patient_reported": False,
                "is_verified": True,
                "upload_id": upload_id,
                "analysis_report_id": report_id,
                "document_url": f"/api/v1/prescription-analysis/uploads/{upload_id}/file",
                "document_name": "rx_metformin_lisinopril_dr_chen.pdf",
            },
            {
                "id": uuid.uuid4(),
                "medication_name": "Lisinopril",
                "brand_name": "Prinivil / Zestril",
                "generic_name": "Lisinopril",
                "strength": "10 mg",
                "dosage_form": "Oral Tablet",
                "dosage": "10 mg",
                "frequency": "Once daily in the morning",
                "route": "Oral",
                "start_date": date(2022, 3, 18),
                "end_date": None,
                "prescription_date": date(2026, 6, 15),
                "prescribing_doctor_name": "Dr. Sarah Chen, MD (Cardiology)",
                "pharmacy": "MetroHealth Main Pharmacy (#4102)",
                "refills_remaining": 4,
                "refills_total": 5,
                "instructions": "Take in the morning with or without food. Avoid potassium supplements.",
                "notes": "Blood pressure controlled at 122/78 mmHg.",
                "status": PrescriptionStatus.ACTIVE,
                "source": "clinician_issued",
                "is_patient_reported": False,
                "is_verified": True,
                "upload_id": upload_id,
                "analysis_report_id": report_id,
                "document_url": f"/api/v1/prescription-analysis/uploads/{upload_id}/file",
                "document_name": "rx_metformin_lisinopril_dr_chen.pdf",
            },
            {
                "id": uuid.uuid4(),
                "medication_name": "Atorvastatin Calcium",
                "brand_name": "Lipitor",
                "generic_name": "Atorvastatin",
                "strength": "20 mg",
                "dosage_form": "Oral Tablet",
                "dosage": "20 mg",
                "frequency": "Once daily at bedtime",
                "route": "Oral",
                "start_date": date(2023, 1, 10),
                "end_date": None,
                "prescription_date": date(2026, 1, 10),
                "prescribing_doctor_name": "Dr. Sarah Chen, MD (Cardiology)",
                "pharmacy": "Walgreens Pharmacy (#1209)",
                "refills_remaining": 1,
                "refills_total": 3,
                "instructions": "Take in the evening before sleep. Report any unexplained muscle aches.",
                "notes": "Lipid management. Total cholesterol improved from 218 to 172 mg/dL.",
                "status": PrescriptionStatus.ACTIVE,
                "source": "clinician_issued",
                "is_patient_reported": False,
                "is_verified": True,
                "upload_id": None,
                "analysis_report_id": None,
                "document_url": None,
                "document_name": None,
            },
            {
                "id": uuid.uuid4(),
                "medication_name": "Amoxicillin Trihydrate",
                "brand_name": "Amoxil",
                "generic_name": "Amoxicillin",
                "strength": "500 mg",
                "dosage_form": "Oral Capsule",
                "dosage": "500 mg",
                "frequency": "Three times daily for 10 days",
                "route": "Oral",
                "start_date": date(2025, 11, 1),
                "end_date": date(2025, 11, 11),
                "prescription_date": date(2025, 11, 1),
                "prescribing_doctor_name": "Dr. Maria Lopez, MD (Urgent Care)",
                "pharmacy": "CVS Pharmacy (#8891)",
                "refills_remaining": 0,
                "refills_total": 0,
                "instructions": "Completed 10-day course for dental prophylaxis. Discontinued.",
                "notes": "Patient experienced mild pruritus on day 9; penicillin cross-reactivity warning active.",
                "status": PrescriptionStatus.DISCONTINUED,
                "source": "ehr_imported",
                "is_patient_reported": False,
                "is_verified": True,
                "discontinued_reason": "Course completed and mild cutaneous sensitivity observed",
                "discontinued_at": datetime(2025, 11, 12, tzinfo=timezone.utc),
            },
        ]

        for rx_dict in initial_prescriptions:
            rx_obj = Prescription(
                id=rx_dict["id"],
                patient_id=patient.id,
                doctor_id=doc_id,
                medication_name=rx_dict["medication_name"],
                brand_name=rx_dict["brand_name"],
                generic_name=rx_dict["generic_name"],
                strength=rx_dict["strength"],
                dosage_form=rx_dict["dosage_form"],
                dosage=rx_dict["dosage"],
                frequency=rx_dict["frequency"],
                route=rx_dict["route"],
                start_date=rx_dict["start_date"],
                end_date=rx_dict["end_date"],
                prescription_date=rx_dict["prescription_date"],
                prescribing_doctor_name=rx_dict["prescribing_doctor_name"],
                pharmacy=rx_dict["pharmacy"],
                refills_remaining=rx_dict["refills_remaining"],
                refills_total=rx_dict["refills_total"],
                instructions=rx_dict["instructions"],
                notes=rx_dict["notes"],
                status=rx_dict["status"],
                source=rx_dict["source"],
                is_patient_reported=rx_dict["is_patient_reported"],
                is_verified=rx_dict["is_verified"],
                verified_at=datetime.now(timezone.utc),
                discontinued_reason=rx_dict.get("discontinued_reason"),
                discontinued_at=rx_dict.get("discontinued_at"),
                upload_id=rx_dict.get("upload_id"),
                document_url=rx_dict.get("document_url"),
                document_name=rx_dict.get("document_name"),
                analysis_report_id=rx_dict.get("analysis_report_id"),
                created_by=user.id,
            )
            session.add(rx_obj)

            # Audit log
            session.add(PrescriptionAuditLog(
                id=uuid.uuid4(),
                prescription_id=rx_obj.id,
                patient_id=patient.id,
                action="created" if rx_obj.status == PrescriptionStatus.ACTIVE else "discontinued",
                performed_by=user.id,
                performed_by_name="Dr. Sarah Chen, MD",
                reason="Clinical maintenance prescription established",
                new_value=f"{rx_obj.medication_name} ({rx_obj.dosage})",
            ))

            # Record version snapshot
            session.add(RecordVersion(
                id=uuid.uuid4(),
                record_id=rx_obj.id,
                record_type="prescription",
                version_number=1,
                action="created",
                snapshot_data={
                    "medication": rx_obj.medication_name,
                    "dosage": rx_obj.dosage,
                    "frequency": rx_obj.frequency,
                    "status": rx_obj.status.value,
                    "prescriber": rx_obj.prescribing_doctor_name,
                },
                change_summary=f"Established verified prescription for {rx_obj.medication_name}",
                reason="Initial prescription",
                changed_by=user.id,
                changed_by_name="Dr. Sarah Chen, MD",
            ))

        await session.commit()
        print("Successfully seeded shared prescriptions, documents, and analysis reports!")

if __name__ == "__main__":
    asyncio.run(seed_prescriptions())

