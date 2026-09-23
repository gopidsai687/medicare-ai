"""
MediCare AI — Enterprise Healthcare 53-Table Seeder.
Creates and populates the normalized enterprise schema with complete clinical data,
demographics, RBAC, MPI quality records, and HIPAA telemetry.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

# Ensure backend app is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import select
from app.core.database import AsyncSessionFactory, engine
from app.core.security import hash_password
from app.models.base import Base
import app.models as m


async def seed_enterprise_schema():
    print("🏥 Starting MediCare Enterprise 53-Table Schema Seeding...")

    # 1. Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("📋 Enterprise physical tables verified/created in database.")

    async with AsyncSessionFactory() as session:
        # Check if already seeded
        res = await session.execute(select(m.SystemUser).where(m.SystemUser.email_addr == "admin@medicare.ai"))
        if res.scalar_one_or_none():
            print("ℹ️ Enterprise admin account already exists in 'usr'. Skipping duplicate seed.")
            return

        # ── 1. Roles & Permissions ───────────────────────────────────────────
        print("🔐 Initializing Enterprise RBAC Roles & Permissions...")
        roles = [
            m.SystemRole(role_id=uuid.uuid4(), role_nm="ADMIN", role_dscrptn="System Administrator"),
            m.SystemRole(role_id=uuid.uuid4(), role_nm="DOCTOR", role_dscrptn="Attending Clinical Specialist"),
            m.SystemRole(role_id=uuid.uuid4(), role_nm="PATIENT", role_dscrptn="Registered Health Consumer"),
            m.SystemRole(role_id=uuid.uuid4(), role_nm="NURSE", role_dscrptn="Clinical Registered Nurse"),
        ]
        session.add_all(roles)
        await session.flush()
        role_map = {r.role_nm: r for r in roles}

        permissions = [
            m.SystemPermission(prmssn_id=uuid.uuid4(), prmssn_nm="PATIENT_VIEW", prmssn_dscrptn="Read PHI records"),
            m.SystemPermission(prmssn_id=uuid.uuid4(), prmssn_nm="PRESCRIPTION_CREATE", prmssn_dscrptn="Authorize e-Prescriptions"),
            m.SystemPermission(prmssn_id=uuid.uuid4(), prmssn_nm="PATIENT_MERGE", prmssn_dscrptn="Resolve MPI Duplicate Records"),
            m.SystemPermission(prmssn_id=uuid.uuid4(), prmssn_nm="AUDIT_VIEW", prmssn_dscrptn="Inspect HIPAA Access Logs"),
        ]
        session.add_all(permissions)
        await session.flush()

        # ── 2. Users (usr) ───────────────────────────────────────────────────
        print("👤 Provisioning System Users ('usr')...")
        admin_u = m.SystemUser(
            usr_id=uuid.uuid4(),
            usr_nm="admin_cmo",
            email_addr="admin@medicare.ai",
            pswd_hash=hash_password("AdminPass123!"),
            usr_sts_cd="ACTIVE",
        )
        doctor_u = m.SystemUser(
            usr_id=uuid.uuid4(),
            usr_nm="dr_sarah_chen",
            email_addr="sarah.chen@medicare.ai",
            pswd_hash=hash_password("DoctorPass123!"),
            usr_sts_cd="ACTIVE",
        )
        patient_u = m.SystemUser(
            usr_id=uuid.uuid4(),
            usr_nm="alice_johnson",
            email_addr="alice.johnson@medicare.ai",
            pswd_hash=hash_password("PatientPass123!"),
            usr_sts_cd="ACTIVE",
        )
        session.add_all([admin_u, doctor_u, patient_u])
        await session.flush()

        session.add_all([
            m.UserRoleMapping(usr_id=admin_u.usr_id, role_id=role_map["ADMIN"].role_id),
            m.UserRoleMapping(usr_id=doctor_u.usr_id, role_id=role_map["DOCTOR"].role_id),
            m.UserRoleMapping(usr_id=patient_u.usr_id, role_id=role_map["PATIENT"].role_id),
        ])

        # ── 3. Departments, Specialties & Facility ────────────────────────────
        print("🏥 Configuring Hospital Departments, Specialties & Rooms...")
        dept_cardio = m.Department(
            dept_id=uuid.uuid4(),
            dept_cd="CARD-01",
            dept_nm="Department of Cardiovascular Medicine",
            locn_nm="Wing B, 4th Floor",
            phone_num="(555) 019-2001",
        )
        dept_emrg = m.Department(
            dept_id=uuid.uuid4(),
            dept_cd="EMRG-01",
            dept_nm="Emergency Medicine Trauma Center",
            locn_nm="Ground Floor Pavilion",
            phone_num="(555) 019-9110",
        )
        session.add_all([dept_cardio, dept_emrg])
        await session.flush()

        spclty_cardio = m.MedicalSpecialty(
            spclty_id=uuid.uuid4(),
            spclty_cd="CARDIO",
            spclty_nm="Adult Cardiology & Interventional Cardiology",
            spclty_dscrptn="Disorders of the heart and vascular system",
        )
        session.add(spclty_cardio)
        await session.flush()

        rm_401 = m.FacilityRoom(rm_id=uuid.uuid4(), dept_id=dept_cardio.dept_id, rm_num="401-B", rm_typ_cd="CARDIAC_MONITORED")
        session.add(rm_401)
        await session.flush()

        bed_a = m.FacilityBed(bed_id=uuid.uuid4(), rm_id=rm_401.rm_id, bed_num="BED-01", bed_typ_cd="ELECTRIC_TELEMETRY")
        session.add(bed_a)

        # ── 4. Doctor Details & Availability ──────────────────────────────────
        print("🩺 Enrolling Attending Physician ('dctr')...")
        doctor_rec = m.DoctorDetails(
            dctr_id=uuid.uuid4(),
            usr_id=doctor_u.usr_id,
            dctr_frst_nm="Sarah",
            dctr_mdl_nm="Lin",
            dctr_lst_nm="Chen",
            dctr_fl_nm="Dr. Sarah Chen, MD, FACC",
            dept_id=dept_cardio.dept_id,
            lic_num="CA-MED-92841",
            phone_num="(555) 234-5678",
            email_addr="sarah.chen@medicare.ai",
            yr_exp_num=14,
            dctr_sts_cd="ACTIVE",
        )
        session.add(doctor_rec)
        await session.flush()

        session.add(m.DoctorSpecialtyMapping(dctr_id=doctor_rec.dctr_id, spclty_id=spclty_cardio.spclty_id, prmry_fl=True))
        session.add(m.DoctorAvailability(
            dctr_id=doctor_rec.dctr_id,
            day_of_wk_cd="MON",
            strt_tm=time(8, 0),
            end_tm=time(17, 0),
            slot_dur_min_num=30,
        ))

        # ── 5. Normalized Patient Demographics (ptnt_dtls + children) ─────────
        print("🧑‍⚕️ Populating Patient Demographic Master ('ptnt_dtls') and Child Tables...")
        patient_rec = m.PatientDetails(
            ptnt_id=uuid.uuid4(),
            mrn="MRN-00000012",
            usr_id=patient_u.usr_id,
            ptnt_nm="Alice Johnson",
            pt_fl_nm="Alice M. Johnson",
            pt_frst_nm="Alice",
            pt_mdl_nm="Marie",
            pt_lst_nm="Johnson",
            pt_prfrd_nm="Alice",
            pt_dob=date(1982, 4, 15),
            pt_sex_cd="FEMALE",
            pt_gndr_idnt_cd="FEMALE",
            pt_mrtl_sts_cd="MARRIED",
            pt_race_cd="WHITE",
            pt_ethncty_cd="NON_HISPANIC",
            pt_prfrd_lang_cd="EN",
            pt_prmry_lang_cd="EN",
            pt_bld_typ_cd="A+",
            ptnt_sts_cd="ACTIVE",
            pt_prfrd_cntct_mthd_cd="PHONE",
        )
        session.add(patient_rec)
        await session.flush()

        # Contacts, Addresses, Identifiers, Insurance, Employment, Preferences
        session.add_all([
            m.PatientContact(ptnt_id=patient_rec.ptnt_id, cntct_typ_cd="PHONE", cntct_val="(555) 123-4567", prmry_fl=True, vrfd_fl=True),
            m.PatientContact(ptnt_id=patient_rec.ptnt_id, cntct_typ_cd="EMAIL", cntct_val="alice.johnson@medicare.ai", prmry_fl=False, vrfd_fl=True),
            m.PatientAddress(
                ptnt_id=patient_rec.ptnt_id,
                addr_typ_cd="HOME",
                addr_ln_1="742 Evergreen Terrace",
                city_nm="Springfield",
                st_cd="IL",
                pstl_cd="62704",
                prmry_fl=True,
            ),
            m.PatientIdentifier(ptnt_id=patient_rec.ptnt_id, idntfr_typ_cd="MRN", idntfr_val="MRN-00000012", prmry_fl=True),
            m.PatientIdentifier(ptnt_id=patient_rec.ptnt_id, idntfr_typ_cd="SSN", idntfr_val="XXX-XX-4819", prmry_fl=False),
            m.PatientEmergencyContact(
                ptnt_id=patient_rec.ptnt_id,
                emrgncy_cntct_nm="Mark Johnson",
                rltnshp_cd="SPOUSE",
                phn_num="(555) 987-6543",
                prmry_fl=True,
                med_info_auth_fl=True,
            ),
            m.PatientInsurance(
                ptnt_id=patient_rec.ptnt_id,
                insrnc_pyr_id="BCBS-IL",
                mbr_id="XOF-891024",
                plcy_num="GRP-90214",
                cvg_typ_cd="MEDICAL",
                efctv_dt=date(2024, 1, 1),
                prmry_fl=True,
            ),
            m.PatientEmployment(
                ptnt_id=patient_rec.ptnt_id,
                emplyr_nm="Horizon Health Systems",
                occpn_nm="Clinical Research Coordinator",
                emp_sts_cd="EMPLOYED",
            ),
            m.PatientPreference(
                ptnt_id=patient_rec.ptnt_id,
                prfrnc_typ_cd="COMM_METHOD",
                prfrnc_val="SMS_AND_EMAIL",
            ),
        ])

        # ── 6. Scheduling (appt, appt_evnt) ──────────────────────────────────
        print("📅 Scheduling Appointments ('appt', 'appt_evnt')...")
        appt_rec = m.AppointmentMaster(
            appt_id=uuid.uuid4(),
            ptnt_id=patient_rec.ptnt_id,
            dctr_id=doctor_rec.dctr_id,
            dept_id=dept_cardio.dept_id,
            appt_typ_cd="IN_PERSON",
            schd_strt_dttm=datetime.now(timezone.utc) + timedelta(days=2, hours=3),
            schd_end_dttm=datetime.now(timezone.utc) + timedelta(days=2, hours=3, minutes=30),
            appt_sts_cd="CONFIRMED",
            appt_rsn_txt="Cardiovascular review and blood pressure assessment",
        )
        session.add(appt_rec)
        await session.flush()

        session.add(m.AppointmentEvent(
            appt_id=appt_rec.appt_id,
            evnt_typ_cd="CONFIRMED",
            old_sts_cd="SCHEDULED",
            new_sts_cd="CONFIRMED",
            evnt_rsn_txt="Patient confirmed via portal SMS notification",
        ))

        # ── 7. Clinical Encounter, Notes & Care Plan ──────────────────────────
        print("📝 Generating Clinical Encounters ('encntr', 'dctr_nt', 'dx', 'trtmnt_pln')...")
        encntr_rec = m.ClinicalEncounter(
            encntr_id=uuid.uuid4(),
            ptnt_id=patient_rec.ptnt_id,
            dctr_id=doctor_rec.dctr_id,
            appt_id=appt_rec.appt_id,
            encntr_typ_cd="OUTPATIENT",
            chf_cmpnt_txt="Follow-up on Essential Hypertension and Type 2 Diabetes management",
            encntr_sts_cd="SIGNED",
        )
        session.add(encntr_rec)
        await session.flush()

        session.add(m.DoctorNote(
            encntr_id=encntr_rec.encntr_id,
            dctr_id=doctor_rec.dctr_id,
            nt_typ_cd="SOAP",
            nt_txt="SUBJECTIVE: Patient reports adherence to antihypertensive regimen.\nOBJECTIVE: BP 126/80 mmHg, HR 72 bpm.\nASSESSMENT: Hypertension well-controlled.\nPLAN: Continue Lisinopril 10mg daily.",
        ))

        dx_htn = m.ClinicalDiagnosis(
            dx_id=uuid.uuid4(),
            ptnt_id=patient_rec.ptnt_id,
            encntr_id=encntr_rec.encntr_id,
            dctr_id=doctor_rec.dctr_id,
            dx_nm="Essential (primary) hypertension",
            dx_cd="I10",
            dx_sts_cd="ACTIVE",
        )
        session.add(dx_htn)
        await session.flush()

        care_plan = m.TreatmentPlan(
            trtmnt_pln_id=uuid.uuid4(),
            ptnt_id=patient_rec.ptnt_id,
            encntr_id=encntr_rec.encntr_id,
            dx_id=dx_htn.dx_id,
            dctr_id=doctor_rec.dctr_id,
            trtmnt_pln_nm="Hypertension Cardiovascular Risk Reduction Plan",
            trtmnt_pln_dscrptn="Maintain systolic BP < 130 mmHg via pharmacotherapy and low-sodium diet",
        )
        session.add(care_plan)
        await session.flush()

        session.add(m.TreatmentItem(
            trtmnt_pln_id=care_plan.trtmnt_pln_id,
            trtmnt_typ_cd="MEDICATION",
            trtmnt_nm="ACE-inhibitor maintenance",
            trtmnt_dscrptn="Lisinopril 10mg PO QD",
        ))

        # ── 8. Medication & Prescription ──────────────────────────────────────
        print("💊 Cataloging Medications & Prescriptions ('med', 'rx')...")
        med_lisinopril = m.MedicationCatalog(
            med_id=uuid.uuid4(),
            med_nm="Lisinopril 10mg Oral Tablet",
            gnrc_nm="Lisinopril",
            brnd_nm="Prinivil",
            frm_cd="TABLET",
            strngth_txt="10mg",
            rte_cd="ORAL",
        )
        session.add(med_lisinopril)
        await session.flush()

        session.add(m.PrescriptionMaster(
            ptnt_id=patient_rec.ptnt_id,
            dctr_id=doctor_rec.dctr_id,
            med_id=med_lisinopril.med_id,
            dose_val=Decimal("10.00"),
            dose_unit_cd="mg",
            freq_cd="ONCE_DAILY",
            dur_val=90,
            rfl_num=3,
            rx_sts_cd="ACTIVE",
            rx_instrctn_txt="Take 1 tablet daily every morning with water.",
        ))

        # ── 9. Diagnostics & Labs ─────────────────────────────────────────────
        print("🔬 Ordering Laboratory Panels ('lab_ordr', 'lab_rslt')...")
        lab_o = m.LaboratoryOrder(
            lab_ordr_id=uuid.uuid4(),
            ptnt_id=patient_rec.ptnt_id,
            encntr_id=encntr_rec.encntr_id,
            dctr_id=doctor_rec.dctr_id,
            test_nm="Basic Metabolic Panel (BMP)",
            test_cd="24320-4",
            priority_cd="ROUTINE",
        )
        session.add(lab_o)
        await session.flush()

        session.add(m.LaboratoryResult(
            lab_ordr_id=lab_o.lab_ordr_id,
            ptnt_id=patient_rec.ptnt_id,
            test_nm="Serum Potassium",
            test_cd="2823-3",
            rslt_val="4.4",
            rslt_num_val=Decimal("4.4000"),
            unit_cd="mmol/L",
            ref_rng_txt="3.5 - 5.0",
            abnrml_fl=False,
        ))

        # ── 10. Document & Vector Chunk ───────────────────────────────────────
        print("📄 Archiving Clinical Documents & Semantic Chunks ('doc', 'doc_chunk')...")
        doc_rec = m.ClinicalDocument(
            doc_id=uuid.uuid4(),
            ptnt_id=patient_rec.ptnt_id,
            encntr_id=encntr_rec.encntr_id,
            doc_typ_cd="CARDIOLOGY_CONSULT_NOTE",
            file_nm="Cardiology_Consult_Johnson_Alice.pdf",
            storage_key="s3://medicare-vault/docs/ptnt_0012/cardio_2026.pdf",
            file_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            file_sz_num=458210,
        )
        session.add(doc_rec)
        await session.flush()

        session.add(m.DocumentChunk(
            doc_id=doc_rec.doc_id,
            chunk_seq_num=1,
            chunk_txt="Patient Alice Johnson presents for cardiac follow-up. Blood pressure optimal on Lisinopril.",
            metadata_json={"patient_mrn": "MRN-00000012", "specialty": "Cardiology"},
        ))

        # ── 11. Data Quality & Regulatory Governance ──────────────────────────
        print("🛡️ Recording MPI Matches & HIPAA Telemetry ('dplct_case', 'adt_log', 'accs_log')...")
        session.add(m.DuplicateCase(
            record_a_id=patient_rec.ptnt_id,
            record_b_id=uuid.uuid4(),
            nm_mtch_scr=Decimal("0.9850"),
            dob_mtch_scr=Decimal("1.0000"),
            phn_mtch_scr=Decimal("0.9500"),
            email_mtch_scr=Decimal("1.0000"),
            addr_mtch_scr=Decimal("0.9200"),
            overall_mtch_scr=Decimal("0.9710"),
            dplct_sts_cd="CONFIRMED",
            detctd_by="FELDMEN_MPI_V2",
            rvw_nt_txt="Definite duplicate record resolved and flagged for merge.",
        ))

        session.add(m.SecurityAuditLog(
            usr_id=admin_u.usr_id,
            actn_cd="ENTERPRISE_SCHEMA_MIGRATION",
            entity_typ_cd="SCHEMA_GOVERNANCE",
            entity_id=patient_rec.ptnt_id,
            ip_addr="127.0.0.1",
            user_agent_txt="MediCare Enterprise CLI / Seeder v2.0",
            rslt_cd="SUCCESS",
            metadata_json={"tables_migrated": 53, "status": "COMPLETED"},
        ))

        session.add(m.PhiAccessLog(
            usr_id=doctor_u.usr_id,
            ptnt_id=patient_rec.ptnt_id,
            accs_typ_cd="READ",
            resource_typ_cd="PATIENT_CHART",
            resource_id=patient_rec.ptnt_id,
            accs_rslt_cd="GRANTED",
        ))

        await session.commit()
        print("✅ MediCare Enterprise 53-Table Seeding Completed Successfully!")


if __name__ == "__main__":
    asyncio.run(seed_enterprise_schema())
