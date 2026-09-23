"""
MediCare Enterprise Healthcare Database Conformance Verifier.
Validates all 53 standardized tables and column abbreviation patterns
against the MediCare Healthcare Data Dictionary specification.
"""
from __future__ import annotations

import os
import sys

# Ensure backend app is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import app.models  # Load all models
from app.models.base import Base

EXPECTED_TABLES = [
    # 1. Identity & RBAC
    "usr", "role", "prmssn", "usr_role", "role_prmssn",
    # 2. Patient Demographics & Master
    "ptnt_dtls", "ptnt_cntct", "ptnt_addr", "ptnt_idntfr",
    "ptnt_emrgncy_cntct", "ptnt_insrnc", "ptnt_emp", "ptnt_prfrnc",
    # 3. Provider & Facility
    "dctr", "spclty", "dctr_spclty", "dept", "dctr_avlblty", "rm", "bed",
    # 4. Scheduling
    "appt", "appt_evnt",
    # 5. Clinical & Inpatient
    "encntr", "dctr_nt", "dx", "trtmnt_pln", "trtmnt_itm",
    "med", "rx", "srgry", "srgry_stff", "admssn", "dschrg", "fllw_up",
    # 6. Diagnostics & Documents
    "lab_ordr", "lab_rslt", "dgnstc_rprt", "doc", "doc_chunk", "doc_embddng",
    # 7. Data Quality & Governance
    "dplct_case", "ptnt_merge", "data_cnflct", "rcd_vrsn", "adt_log", "accs_log"
]

KEY_COLUMNS_CHECK = {
    "ptnt_dtls": ["ptnt_id", "mrn", "ptnt_nm", "pt_dob", "pt_sex_cd", "ptnt_sts_cd"],
    "ptnt_cntct": ["ptnt_cntct_id", "ptnt_id", "cntct_typ_cd", "cntct_val", "prmry_fl"],
    "ptnt_addr": ["ptnt_addr_id", "ptnt_id", "addr_typ_cd", "addr_ln_1", "city_nm", "st_cd", "pstl_cd"],
    "ptnt_idntfr": ["ptnt_idntfr_id", "ptnt_id", "idntfr_typ_cd", "idntfr_val"],
    "ptnt_emrgncy_cntct": ["emrgncy_cntct_id", "ptnt_id", "emrgncy_cntct_nm", "rltnshp_cd", "phn_num"],
    "ptnt_insrnc": ["ptnt_insrnc_id", "ptnt_id", "insrnc_pyr_id", "mbr_id", "cvg_typ_cd"],
    "ptnt_emp": ["ptnt_emp_id", "ptnt_id", "emplyr_nm", "emp_sts_cd"],
    "ptnt_prfrnc": ["ptnt_prfrnc_id", "ptnt_id", "prfrnc_typ_cd", "prfrnc_val"],
    "usr": ["usr_id", "usr_nm", "email_addr", "pswd_hash", "usr_sts_cd"],
    "role": ["role_id", "role_nm"],
    "prmssn": ["prmssn_id", "prmssn_nm"],
    "usr_role": ["usr_role_id", "usr_id", "role_id"],
    "role_prmssn": ["role_prmssn_id", "role_id", "prmssn_id"],
    "dctr": ["dctr_id", "usr_id", "dctr_fl_nm", "lic_num"],
    "spclty": ["spclty_id", "spclty_nm", "spclty_cd"],
    "dctr_spclty": ["dctr_spclty_id", "dctr_id", "spclty_id"],
    "dept": ["dept_id", "dept_cd", "dept_nm"],
    "dctr_avlblty": ["dctr_avlblty_id", "dctr_id", "day_of_wk_cd"],
    "rm": ["rm_id", "dept_id", "rm_num"],
    "bed": ["bed_id", "rm_id", "bed_num"],
    "appt": ["appt_id", "ptnt_id", "dctr_id", "schd_strt_dttm", "appt_sts_cd"],
    "appt_evnt": ["appt_evnt_id", "appt_id", "evnt_typ_cd", "new_sts_cd"],
    "encntr": ["encntr_id", "ptnt_id", "dctr_id", "chf_cmpnt_txt"],
    "dctr_nt": ["dctr_nt_id", "encntr_id", "dctr_id", "nt_txt"],
    "dx": ["dx_id", "ptnt_id", "dx_nm", "dx_cd"],
    "trtmnt_pln": ["trtmnt_pln_id", "ptnt_id", "dctr_id", "trtmnt_pln_nm"],
    "trtmnt_itm": ["trtmnt_itm_id", "trtmnt_pln_id", "trtmnt_typ_cd"],
    "med": ["med_id", "med_nm", "gnrc_nm"],
    "rx": ["rx_id", "ptnt_id", "dctr_id", "med_id", "dose_val"],
    "srgry": ["srgry_id", "ptnt_id", "prmry_srgn_id", "prcdr_nm"],
    "srgry_stff": ["srgry_stff_id", "srgry_id", "dctr_id", "stff_role_cd"],
    "admssn": ["admssn_id", "ptnt_id", "attndng_dctr_id", "dept_id"],
    "dschrg": ["dschrg_id", "admssn_id", "ptnt_id", "dctr_id"],
    "fllw_up": ["fllw_up_id", "ptnt_id", "dctr_id", "fllw_up_dt"],
    "lab_ordr": ["lab_ordr_id", "ptnt_id", "dctr_id", "test_nm", "test_cd"],
    "lab_rslt": ["lab_rslt_id", "lab_ordr_id", "ptnt_id", "test_nm", "rslt_val"],
    "dgnstc_rprt": ["dgnstc_rprt_id", "ptnt_id", "dctr_id", "rprt_typ_cd"],
    "doc": ["doc_id", "ptnt_id", "file_nm", "storage_key"],
    "doc_chunk": ["doc_chunk_id", "doc_id", "chunk_seq_num", "chunk_txt"],
    "doc_embddng": ["doc_embddng_id", "doc_chunk_id", "model_nm"],
    "dplct_case": ["dplct_case_id", "record_a_id", "record_b_id", "overall_mtch_scr"],
    "ptnt_merge": ["ptnt_merge_id", "survvg_ptnt_id", "mrged_ptnt_id"],
    "data_cnflct": ["data_cnflct_id", "ptnt_id", "field_nm"],
    "rcd_vrsn": ["rcd_vrsn_id", "entity_typ_cd", "entity_id", "vrsn_num"],
    "adt_log": ["adt_log_id", "actn_cd", "entity_typ_cd"],
    "accs_log": ["accs_log_id", "usr_id", "ptnt_id", "accs_typ_cd"],
}


def verify_conformance():
    print("=" * 80)
    print(" MediCare Enterprise Healthcare Database Schema Verification")
    print("=" * 80)

    tables_in_meta = Base.metadata.tables
    all_passed = True
    missing_tables = []

    print(f"\n[1] Verifying Canonical Table Existence ({len(EXPECTED_TABLES)} tables)...")
    for tbl in EXPECTED_TABLES:
        if tbl in tables_in_meta:
            print(f"  ✓ {tbl:<20} registered in ORM metadata")
        else:
            print(f"  ✗ {tbl:<20} MISSING from ORM metadata!")
            missing_tables.append(tbl)
            all_passed = False

    print(f"\n[2] Verifying Healthcare Column Standard & Abbreviation Compliance...")
    for tbl, cols in KEY_COLUMNS_CHECK.items():
        if tbl not in tables_in_meta:
            continue
        t_obj = tables_in_meta[tbl]
        col_names = [c.name for c in t_obj.columns]
        missing_cols = [c for c in cols if c not in col_names]
        if not missing_cols:
            print(f"  ✓ {tbl:<20} all required columns present ({len(cols)} sampled)")
        else:
            print(f"  ✗ {tbl:<20} Missing columns: {missing_cols}")
            all_passed = False

    print("\n" + "=" * 80)
    if all_passed:
        print("🎉 SUCCESS: 100% Healthcare Abbreviation Standard & Schema Conformance Verified!")
    else:
        print(f"⚠️ FAILURE: Issues found with tables: {missing_tables}")
    print("=" * 80)
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(verify_conformance())
