-- =============================================================================
-- MediCare Enterprise Healthcare Database Architecture (PostgreSQL 16+)
-- Standardized Entity Abbreviation Specification & Production DDL
-- 53 Canonical Healthcare Tables Across 8 Core Functional Domains
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =============================================================================
-- 1. IDENTITY & ACCESS MANAGEMENT (RBAC)
-- =============================================================================

-- Table 14: usr — System User Credentials and Authentication
CREATE TABLE IF NOT EXISTS usr (
    usr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usr_nm VARCHAR(100) NOT NULL UNIQUE,
    email_addr VARCHAR(255) NOT NULL UNIQUE,
    pswd_hash VARCHAR(255) NOT NULL,
    usr_sts_cd VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_lgn_dttm TIMESTAMP WITH TIME ZONE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    crte_by UUID,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_by UUID,
    CONSTRAINT fk_usr_crte_by FOREIGN KEY (crte_by) REFERENCES usr(usr_id) ON DELETE SET NULL,
    CONSTRAINT fk_usr_updt_by FOREIGN KEY (updt_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_usr_email ON usr(email_addr);
CREATE INDEX IF NOT EXISTS ix_usr_sts ON usr(usr_sts_cd);

-- Table 15: role — Security and Clinical Roles
CREATE TABLE IF NOT EXISTS role (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_nm VARCHAR(50) NOT NULL UNIQUE,
    role_dscrptn VARCHAR(500),
    role_sts_cd VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 16: prmssn — Granular Functional Permissions
CREATE TABLE IF NOT EXISTS prmssn (
    prmssn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prmssn_nm VARCHAR(100) NOT NULL UNIQUE,
    prmssn_dscrptn VARCHAR(500),
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 17: usr_role — User to Role Mapping
CREATE TABLE IF NOT EXISTS usr_role (
    usr_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usr_id UUID NOT NULL,
    role_id UUID NOT NULL,
    efctv_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expr_dt TIMESTAMP WITH TIME ZONE,
    actv_fl BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_usr_role UNIQUE (usr_id, role_id),
    CONSTRAINT fk_usr_role_usr FOREIGN KEY (usr_id) REFERENCES usr(usr_id) ON DELETE CASCADE,
    CONSTRAINT fk_usr_role_role FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_usr_role_usr ON usr_role(usr_id);
CREATE INDEX IF NOT EXISTS ix_usr_role_role ON usr_role(role_id);

-- Table 18: role_prmssn — Role to Permission Matrix
CREATE TABLE IF NOT EXISTS role_prmssn (
    role_prmssn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL,
    prmssn_id UUID NOT NULL,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_role_prmssn UNIQUE (role_id, prmssn_id),
    CONSTRAINT fk_role_prmssn_role FOREIGN KEY (role_id) REFERENCES role(role_id) ON DELETE CASCADE,
    CONSTRAINT fk_role_prmssn_prmssn FOREIGN KEY (prmssn_id) REFERENCES prmssn(prmssn_id) ON DELETE CASCADE
);

-- =============================================================================
-- 2. PATIENT DEMOGRAPHIC MASTER & CHILD EXTENSIONS
-- =============================================================================

-- Table 1: ptnt_dtls — Core Patient Master Identity
CREATE TABLE IF NOT EXISTS ptnt_dtls (
    ptnt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn VARCHAR(30) NOT NULL UNIQUE,
    usr_id UUID UNIQUE,
    ptnt_nm VARCHAR(200) NOT NULL,
    pt_fl_nm VARCHAR(200) NOT NULL,
    pt_frst_nm VARCHAR(100) NOT NULL,
    pt_mdl_nm VARCHAR(100),
    pt_lst_nm VARCHAR(100) NOT NULL,
    pt_prfrd_nm VARCHAR(100),
    pt_prv_nm VARCHAR(200),
    pt_dob DATE NOT NULL,
    pt_sex_cd VARCHAR(20) NOT NULL,
    pt_gndr_idnt_cd VARCHAR(30),
    pt_mrtl_sts_cd VARCHAR(30),
    pt_race_cd VARCHAR(30),
    pt_ethncty_cd VARCHAR(30),
    pt_prfrd_lang_cd VARCHAR(10) DEFAULT 'EN',
    pt_prmry_lang_cd VARCHAR(10) DEFAULT 'EN',
    pt_intrprtr_reqd_fl BOOLEAN NOT NULL DEFAULT FALSE,
    pt_intrprtr_lang_cd VARCHAR(10),
    pt_ctznshp_cd VARCHAR(30) DEFAULT 'US',
    pt_brth_cntry_cd VARCHAR(3) DEFAULT 'USA',
    pt_brth_st_cd VARCHAR(10),
    pt_brth_city_nm VARCHAR(100),
    pt_rlgn_cd VARCHAR(30),
    pt_occpn_nm VARCHAR(100),
    pt_emp_sts_cd VARCHAR(30),
    pt_edu_lvl_cd VARCHAR(30),
    pt_bld_typ_cd VARCHAR(5),
    ptnt_sts_cd VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    pt_dcsd_fl BOOLEAN NOT NULL DEFAULT FALSE,
    pt_dth_dt DATE,
    pt_prfrd_cntct_mthd_cd VARCHAR(20) DEFAULT 'PHONE',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    crte_by UUID,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_by UUID,
    CONSTRAINT fk_ptnt_usr FOREIGN KEY (usr_id) REFERENCES usr(usr_id) ON DELETE SET NULL,
    CONSTRAINT fk_ptnt_crte_by FOREIGN KEY (crte_by) REFERENCES usr(usr_id) ON DELETE SET NULL,
    CONSTRAINT fk_ptnt_updt_by FOREIGN KEY (updt_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_ptnt_mrn ON ptnt_dtls(mrn);
CREATE INDEX IF NOT EXISTS ix_ptnt_nm ON ptnt_dtls(pt_lst_nm, pt_frst_nm);
CREATE INDEX IF NOT EXISTS ix_ptnt_dob ON ptnt_dtls(pt_dob);
CREATE INDEX IF NOT EXISTS ix_ptnt_sts ON ptnt_dtls(ptnt_sts_cd);

-- Table 2: ptnt_cntct — Patient Contact Channels
CREATE TABLE IF NOT EXISTS ptnt_cntct (
    ptnt_cntct_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    cntct_typ_cd VARCHAR(20) NOT NULL, -- PHONE, EMAIL
    cntct_val VARCHAR(255) NOT NULL,
    cntry_cd VARCHAR(5) DEFAULT '+1',
    prmry_fl BOOLEAN NOT NULL DEFAULT FALSE,
    vrfd_fl BOOLEAN NOT NULL DEFAULT FALSE,
    vrfd_dt TIMESTAMP WITH TIME ZONE,
    actv_fl BOOLEAN NOT NULL DEFAULT TRUE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    crte_by UUID,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_by UUID,
    CONSTRAINT fk_ptnt_cntct_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_ptnt_cntct_crte_by FOREIGN KEY (crte_by) REFERENCES usr(usr_id) ON DELETE SET NULL,
    CONSTRAINT fk_ptnt_cntct_updt_by FOREIGN KEY (updt_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_ptnt_cntct_ptnt ON ptnt_cntct(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_ptnt_cntct_val ON ptnt_cntct(cntct_val);

-- Table 3: ptnt_addr — Patient Physical & Mailing Addresses
CREATE TABLE IF NOT EXISTS ptnt_addr (
    ptnt_addr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    addr_typ_cd VARCHAR(20) NOT NULL DEFAULT 'HOME',
    addr_ln_1 VARCHAR(200) NOT NULL,
    addr_ln_2 VARCHAR(200),
    addr_ln_3 VARCHAR(200),
    city_nm VARCHAR(100) NOT NULL,
    cnty_nm VARCHAR(100),
    st_cd VARCHAR(10) NOT NULL,
    pstl_cd VARCHAR(20) NOT NULL,
    cntry_cd VARCHAR(3) NOT NULL DEFAULT 'USA',
    prmry_fl BOOLEAN NOT NULL DEFAULT TRUE,
    crnt_fl BOOLEAN NOT NULL DEFAULT TRUE,
    vld_frm_dt DATE DEFAULT CURRENT_DATE,
    vld_to_dt DATE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ptnt_addr_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_ptnt_addr_ptnt ON ptnt_addr(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_ptnt_addr_pstl ON ptnt_addr(pstl_cd);

-- Table 4: ptnt_idntfr — Multi-Agency Patient Identifiers
CREATE TABLE IF NOT EXISTS ptnt_idntfr (
    ptnt_idntfr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    idntfr_typ_cd VARCHAR(30) NOT NULL, -- MRN, SSN, PASSPORT, DRIVERS_LICENSE, INSURANCE_ID
    idntfr_val VARCHAR(100) NOT NULL,
    issng_org_id VARCHAR(100),
    efctv_dt DATE,
    expr_dt DATE,
    idntfr_sts_cd VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    prmry_fl BOOLEAN NOT NULL DEFAULT FALSE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    crte_by UUID,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_by UUID,
    CONSTRAINT fk_ptnt_idntfr_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_ptnt_idntfr_crte_by FOREIGN KEY (crte_by) REFERENCES usr(usr_id) ON DELETE SET NULL,
    CONSTRAINT fk_ptnt_idntfr_updt_by FOREIGN KEY (updt_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_ptnt_idntfr_ptnt ON ptnt_idntfr(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_ptnt_idntfr_val ON ptnt_idntfr(idntfr_val);

-- Table 5: ptnt_emrgncy_cntct — Emergency Contacts & Proxies
CREATE TABLE IF NOT EXISTS ptnt_emrgncy_cntct (
    emrgncy_cntct_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    emrgncy_cntct_nm VARCHAR(255) NOT NULL,
    emrgncy_frst_nm VARCHAR(100),
    emrgncy_lst_nm VARCHAR(100),
    rltnshp_cd VARCHAR(50) NOT NULL, -- SPOUSE, PARENT, CHILD, GUARDIAN
    phn_num VARCHAR(30) NOT NULL,
    email_addr VARCHAR(255),
    addr_txt VARCHAR(500),
    prmry_fl BOOLEAN NOT NULL DEFAULT TRUE,
    med_info_auth_fl BOOLEAN NOT NULL DEFAULT TRUE,
    actv_fl BOOLEAN NOT NULL DEFAULT TRUE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ptnt_emrgncy_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_ptnt_emrgncy_ptnt ON ptnt_emrgncy_cntct(ptnt_id);

-- Table 6: ptnt_insrnc — Patient Health Insurance Coverage
CREATE TABLE IF NOT EXISTS ptnt_insrnc (
    ptnt_insrnc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    insrnc_pyr_id VARCHAR(100) NOT NULL,
    insrnc_plan_id VARCHAR(100),
    mbr_id VARCHAR(100) NOT NULL,
    grp_num VARCHAR(100),
    plcy_num VARCHAR(100),
    sbscbr_id VARCHAR(100),
    sbscbr_nm VARCHAR(250),
    sbscbr_rltnshp_cd VARCHAR(30) DEFAULT 'SELF',
    cvg_typ_cd VARCHAR(30) NOT NULL DEFAULT 'MEDICAL', -- MEDICAL, DENTAL, VISION, RX
    efctv_dt DATE NOT NULL,
    trmntn_dt DATE,
    prmry_fl BOOLEAN NOT NULL DEFAULT TRUE,
    vrfd_fl BOOLEAN NOT NULL DEFAULT FALSE,
    vrfctn_dt TIMESTAMP WITH TIME ZONE,
    insrnc_sts_cd VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ptnt_insrnc_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_ptnt_insrnc_ptnt ON ptnt_insrnc(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_ptnt_insrnc_mbr ON ptnt_insrnc(mbr_id);

-- Table 7: ptnt_emp — Patient Employment Records
CREATE TABLE IF NOT EXISTS ptnt_emp (
    ptnt_emp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    emplyr_nm VARCHAR(250) NOT NULL,
    occpn_nm VARCHAR(100),
    emp_sts_cd VARCHAR(30) NOT NULL DEFAULT 'EMPLOYED',
    strt_dt DATE,
    end_dt DATE,
    emplyr_phn_num VARCHAR(30),
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ptnt_emp_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_ptnt_emp_ptnt ON ptnt_emp(ptnt_id);

-- Table 8: ptnt_prfrnc — Communication & Clinical Preferences
CREATE TABLE IF NOT EXISTS ptnt_prfrnc (
    ptnt_prfrnc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    prfrnc_typ_cd VARCHAR(50) NOT NULL, -- COMM_METHOD, REMINDER_PREF, ACCESSIBILITY
    prfrnc_val VARCHAR(250) NOT NULL,
    efctv_dt DATE DEFAULT CURRENT_DATE,
    actv_fl BOOLEAN NOT NULL DEFAULT TRUE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ptnt_prfrnc_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_ptnt_prfrnc_ptnt ON ptnt_prfrnc(ptnt_id);

-- =============================================================================
-- 3. PROVIDER, DEPARTMENT & FACILITY
-- =============================================================================

-- Table 22: dept — Clinical & Administrative Departments
CREATE TABLE IF NOT EXISTS dept (
    dept_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dept_cd VARCHAR(30) NOT NULL UNIQUE,
    dept_nm VARCHAR(150) NOT NULL,
    dept_dscrptn VARCHAR(500),
    locn_nm VARCHAR(150),
    phone_num VARCHAR(30),
    dept_sts_cd VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 20: spclty — Medical Specialties
CREATE TABLE IF NOT EXISTS spclty (
    spclty_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spclty_nm VARCHAR(150) NOT NULL UNIQUE,
    spclty_cd VARCHAR(30) NOT NULL UNIQUE,
    spclty_dscrptn VARCHAR(500),
    actv_fl BOOLEAN NOT NULL DEFAULT TRUE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 19: dctr — Attending Physicians & Specialists
CREATE TABLE IF NOT EXISTS dctr (
    dctr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usr_id UUID NOT NULL UNIQUE,
    dctr_frst_nm VARCHAR(100) NOT NULL,
    dctr_mdl_nm VARCHAR(100),
    dctr_lst_nm VARCHAR(100) NOT NULL,
    dctr_fl_nm VARCHAR(250) NOT NULL,
    dept_id UUID,
    lic_num VARCHAR(100) NOT NULL UNIQUE,
    phone_num VARCHAR(30),
    email_addr VARCHAR(255),
    yr_exp_num INTEGER DEFAULT 0,
    dctr_sts_cd VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    crte_by UUID,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_by UUID,
    CONSTRAINT fk_dctr_usr FOREIGN KEY (usr_id) REFERENCES usr(usr_id) ON DELETE CASCADE,
    CONSTRAINT fk_dctr_dept FOREIGN KEY (dept_id) REFERENCES dept(dept_id) ON DELETE SET NULL,
    CONSTRAINT fk_dctr_crte_by FOREIGN KEY (crte_by) REFERENCES usr(usr_id) ON DELETE SET NULL,
    CONSTRAINT fk_dctr_updt_by FOREIGN KEY (updt_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_dctr_usr ON dctr(usr_id);
CREATE INDEX IF NOT EXISTS ix_dctr_lic ON dctr(lic_num);

-- Table 21: dctr_spclty — Doctor Specialties
CREATE TABLE IF NOT EXISTS dctr_spclty (
    dctr_spclty_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dctr_id UUID NOT NULL,
    spclty_id UUID NOT NULL,
    prmry_fl BOOLEAN NOT NULL DEFAULT TRUE,
    actv_fl BOOLEAN NOT NULL DEFAULT TRUE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_dctr_spclty UNIQUE (dctr_id, spclty_id),
    CONSTRAINT fk_dctr_spclty_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE,
    CONSTRAINT fk_dctr_spclty_spclty FOREIGN KEY (spclty_id) REFERENCES spclty(spclty_id) ON DELETE CASCADE
);

-- Table 23: dctr_avlblty — Doctor Working Hours & Shift Slots
CREATE TABLE IF NOT EXISTS dctr_avlblty (
    dctr_avlblty_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dctr_id UUID NOT NULL,
    day_of_wk_cd VARCHAR(10) NOT NULL, -- MON, TUE, WED, THU, FRI, SAT, SUN
    strt_tm TIME NOT NULL,
    end_tm TIME NOT NULL,
    slot_dur_min_num INTEGER NOT NULL DEFAULT 30,
    actv_fl BOOLEAN NOT NULL DEFAULT TRUE,
    efctv_dt DATE NOT NULL DEFAULT CURRENT_DATE,
    expr_dt DATE,
    CONSTRAINT fk_dctr_avlblty_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_dctr_avlblty_dctr ON dctr_avlblty(dctr_id);

-- Table 35: rm — Hospital Room Facility
CREATE TABLE IF NOT EXISTS rm (
    rm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dept_id UUID NOT NULL,
    rm_num VARCHAR(30) NOT NULL,
    rm_typ_cd VARCHAR(30) NOT NULL DEFAULT 'STANDARD', -- ICU, STANDARD, ISOLATION, POST_OP
    rm_sts_cd VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rm_dept_num UNIQUE (dept_id, rm_num),
    CONSTRAINT fk_rm_dept FOREIGN KEY (dept_id) REFERENCES dept(dept_id) ON DELETE CASCADE
);

-- Table 36: bed — Hospital Bed Assignment Units
CREATE TABLE IF NOT EXISTS bed (
    bed_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rm_id UUID NOT NULL,
    bed_num VARCHAR(30) NOT NULL,
    bed_typ_cd VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    bed_sts_cd VARCHAR(30) NOT NULL DEFAULT 'VACANT', -- VACANT, OCCUPIED, MAINTENANCE
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bed_rm_num UNIQUE (rm_id, bed_num),
    CONSTRAINT fk_bed_rm FOREIGN KEY (rm_id) REFERENCES rm(rm_id) ON DELETE CASCADE
);

-- =============================================================================
-- 4. SCHEDULING & APPOINTMENT AUDITING
-- =============================================================================

-- Table 24: appt — Master Appointment Scheduling
CREATE TABLE IF NOT EXISTS appt (
    appt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    dctr_id UUID NOT NULL,
    dept_id UUID,
    appt_typ_cd VARCHAR(30) NOT NULL DEFAULT 'IN_PERSON',
    schd_strt_dttm TIMESTAMP WITH TIME ZONE NOT NULL,
    schd_end_dttm TIMESTAMP WITH TIME ZONE NOT NULL,
    appt_sts_cd VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    appt_rsn_txt VARCHAR(1000) NOT NULL,
    crte_by UUID,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_by UUID,
    CONSTRAINT fk_appt_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_appt_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE,
    CONSTRAINT fk_appt_dept FOREIGN KEY (dept_id) REFERENCES dept(dept_id) ON DELETE SET NULL,
    CONSTRAINT fk_appt_crte_by FOREIGN KEY (crte_by) REFERENCES usr(usr_id) ON DELETE SET NULL,
    CONSTRAINT fk_appt_updt_by FOREIGN KEY (updt_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_appt_ptnt ON appt(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_appt_dctr ON appt(dctr_id);
CREATE INDEX IF NOT EXISTS ix_appt_strt ON appt(schd_strt_dttm);
CREATE INDEX IF NOT EXISTS ix_appt_sts ON appt(appt_sts_cd);

-- Table 25: appt_evnt — Appointment Lifecycle Event History
CREATE TABLE IF NOT EXISTS appt_evnt (
    appt_evnt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appt_id UUID NOT NULL,
    evnt_typ_cd VARCHAR(30) NOT NULL, -- CREATED, RESCHEDULED, CHECKED_IN, CANCELLED
    old_sts_cd VARCHAR(30),
    new_sts_cd VARCHAR(30) NOT NULL,
    evnt_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    evnt_by UUID,
    evnt_rsn_txt VARCHAR(500),
    CONSTRAINT fk_appt_evnt_appt FOREIGN KEY (appt_id) REFERENCES appt(appt_id) ON DELETE CASCADE,
    CONSTRAINT fk_appt_evnt_usr FOREIGN KEY (evnt_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_appt_evnt_appt ON appt_evnt(appt_id);

-- =============================================================================
-- 5. CLINICAL ENCOUNTERS, NOTES, DIAGNOSES & CARE PLANS
-- =============================================================================

-- Table 26: encntr — Clinical Interaction Hub
CREATE TABLE IF NOT EXISTS encntr (
    encntr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    dctr_id UUID NOT NULL,
    appt_id UUID,
    encntr_typ_cd VARCHAR(30) NOT NULL DEFAULT 'OUTPATIENT',
    encntr_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chf_cmpnt_txt VARCHAR(2000) NOT NULL,
    encntr_sts_cd VARCHAR(20) NOT NULL DEFAULT 'SIGNED',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_encntr_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_encntr_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE,
    CONSTRAINT fk_encntr_appt FOREIGN KEY (appt_id) REFERENCES appt(appt_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_encntr_ptnt ON encntr(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_encntr_dctr ON encntr(dctr_id);
CREATE INDEX IF NOT EXISTS ix_encntr_dttm ON encntr(encntr_dttm);

-- Table 27: dctr_nt — Versioned Physician SOAP Notes
CREATE TABLE IF NOT EXISTS dctr_nt (
    dctr_nt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encntr_id UUID NOT NULL,
    dctr_id UUID NOT NULL,
    nt_typ_cd VARCHAR(30) NOT NULL DEFAULT 'SOAP', -- SOAP, PROGRESS, DISCHARGE
    nt_txt TEXT NOT NULL,
    nt_sts_cd VARCHAR(20) NOT NULL DEFAULT 'SIGNED',
    vrsn_num INTEGER NOT NULL DEFAULT 1,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    crte_by UUID,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_by UUID,
    CONSTRAINT fk_dctr_nt_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE CASCADE,
    CONSTRAINT fk_dctr_nt_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE,
    CONSTRAINT fk_dctr_nt_crte_by FOREIGN KEY (crte_by) REFERENCES usr(usr_id) ON DELETE SET NULL,
    CONSTRAINT fk_dctr_nt_updt_by FOREIGN KEY (updt_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_dctr_nt_encntr ON dctr_nt(encntr_id);

-- Table 28: dx — Coded Clinical Diagnoses (ICD-10)
CREATE TABLE IF NOT EXISTS dx (
    dx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    encntr_id UUID,
    dctr_id UUID,
    dx_nm VARCHAR(250) NOT NULL,
    dx_cd VARCHAR(30) NOT NULL, -- ICD-10
    dx_dscrptn VARCHAR(1000),
    dx_sts_cd VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RESOLVED, CHRONIC
    onst_dt DATE DEFAULT CURRENT_DATE,
    rsld_dt DATE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dx_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_dx_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE SET NULL,
    CONSTRAINT fk_dx_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_dx_ptnt ON dx(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_dx_cd ON dx(dx_cd);

-- Table 29: trtmnt_pln — Longitudinal Care & Treatment Plans
CREATE TABLE IF NOT EXISTS trtmnt_pln (
    trtmnt_pln_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    encntr_id UUID,
    dx_id UUID,
    dctr_id UUID NOT NULL,
    trtmnt_pln_nm VARCHAR(250) NOT NULL,
    trtmnt_pln_dscrptn TEXT,
    strt_dt DATE NOT NULL DEFAULT CURRENT_DATE,
    end_dt DATE,
    dur_typ_cd VARCHAR(30) DEFAULT 'WEEKS',
    trtmnt_pln_sts_cd VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    fllw_up_dt DATE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trtmnt_pln_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_trtmnt_pln_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE SET NULL,
    CONSTRAINT fk_trtmnt_pln_dx FOREIGN KEY (dx_id) REFERENCES dx(dx_id) ON DELETE SET NULL,
    CONSTRAINT fk_trtmnt_pln_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_trtmnt_pln_ptnt ON trtmnt_pln(ptnt_id);

-- Table 30: trtmnt_itm — Protocol Action Items
CREATE TABLE IF NOT EXISTS trtmnt_itm (
    trtmnt_itm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trtmnt_pln_id UUID NOT NULL,
    trtmnt_typ_cd VARCHAR(30) NOT NULL, -- MEDICATION, SURGERY, THERAPY, LAB
    trtmnt_nm VARCHAR(250) NOT NULL,
    trtmnt_dscrptn TEXT,
    strt_dt DATE NOT NULL DEFAULT CURRENT_DATE,
    end_dt DATE,
    trtmnt_instrctn_txt TEXT,
    trtmnt_itm_sts_cd VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trtmnt_itm_pln FOREIGN KEY (trtmnt_pln_id) REFERENCES trtmnt_pln(trtmnt_pln_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_trtmnt_itm_pln ON trtmnt_itm(trtmnt_pln_id);

-- Table 31: med — Medication Catalog & Formulae
CREATE TABLE IF NOT EXISTS med (
    med_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    med_nm VARCHAR(250) NOT NULL,
    gnrc_nm VARCHAR(250) NOT NULL,
    brnd_nm VARCHAR(250),
    frm_cd VARCHAR(30) NOT NULL DEFAULT 'TABLET', -- TABLET, CAPSULE, INJECTION, SYRUP
    strngth_txt VARCHAR(100) NOT NULL,
    rte_cd VARCHAR(30) NOT NULL DEFAULT 'ORAL',
    med_dscrptn TEXT,
    actv_fl BOOLEAN NOT NULL DEFAULT TRUE,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_med_nm ON med(med_nm);
CREATE INDEX IF NOT EXISTS ix_med_gnrc ON med(gnrc_nm);

-- Table 32: rx — Patient Prescriptions
CREATE TABLE IF NOT EXISTS rx (
    rx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    dctr_id UUID NOT NULL,
    trtmnt_itm_id UUID,
    med_id UUID NOT NULL,
    dose_val DECIMAL(10, 2) NOT NULL,
    dose_unit_cd VARCHAR(30) NOT NULL DEFAULT 'mg',
    freq_cd VARCHAR(50) NOT NULL, -- ONCE_DAILY, BID, TID, PRN
    rte_cd VARCHAR(30) NOT NULL DEFAULT 'ORAL',
    dur_val INTEGER NOT NULL DEFAULT 30,
    dur_unit_cd VARCHAR(20) NOT NULL DEFAULT 'DAYS',
    strt_dt DATE NOT NULL DEFAULT CURRENT_DATE,
    end_dt DATE,
    rx_instrctn_txt TEXT,
    rfl_num INTEGER NOT NULL DEFAULT 0,
    rx_sts_cd VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    prscrbd_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rx_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_rx_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE,
    CONSTRAINT fk_rx_itm FOREIGN KEY (trtmnt_itm_id) REFERENCES trtmnt_itm(trtmnt_itm_id) ON DELETE SET NULL,
    CONSTRAINT fk_rx_med FOREIGN KEY (med_id) REFERENCES med(med_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_rx_ptnt ON rx(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_rx_dctr ON rx(dctr_id);
CREATE INDEX IF NOT EXISTS ix_rx_sts ON rx(rx_sts_cd);

-- Table 33: srgry — Surgical Procedures
CREATE TABLE IF NOT EXISTS srgry (
    srgry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    encntr_id UUID,
    trtmnt_pln_id UUID,
    prcdr_nm VARCHAR(250) NOT NULL,
    preop_dx_txt TEXT,
    postop_dx_txt TEXT,
    srgry_dttm TIMESTAMP WITH TIME ZONE NOT NULL,
    prmry_srgn_id UUID NOT NULL,
    anesthsiolgst_id UUID,
    prcdr_nt_txt TEXT,
    postop_nt_txt TEXT,
    cmplctn_txt TEXT,
    srgry_sts_cd VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_srgry_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_srgry_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE SET NULL,
    CONSTRAINT fk_srgry_pln FOREIGN KEY (trtmnt_pln_id) REFERENCES trtmnt_pln(trtmnt_pln_id) ON DELETE SET NULL,
    CONSTRAINT fk_srgry_srgn FOREIGN KEY (prmry_srgn_id) REFERENCES dctr(dctr_id) ON DELETE RESTRICT,
    CONSTRAINT fk_srgry_anes FOREIGN KEY (anesthsiolgst_id) REFERENCES dctr(dctr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_srgry_ptnt ON srgry(ptnt_id);

-- Table 34: srgry_stff — Operating Room Staffing
CREATE TABLE IF NOT EXISTS srgry_stff (
    srgry_stff_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    srgry_id UUID NOT NULL,
    dctr_id UUID NOT NULL,
    stff_role_cd VARCHAR(50) NOT NULL, -- ASSISTANT_SURGEON, SCRUB_NURSE, CIRCULATING_NURSE
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_srgry_stff_srgry FOREIGN KEY (srgry_id) REFERENCES srgry(srgry_id) ON DELETE CASCADE,
    CONSTRAINT fk_srgry_stff_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE
);

-- Table 37: admssn — Inpatient Admissions
CREATE TABLE IF NOT EXISTS admssn (
    admssn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    attndng_dctr_id UUID NOT NULL,
    dept_id UUID NOT NULL,
    rm_id UUID,
    bed_id UUID,
    admssn_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    admssn_rsn_txt TEXT NOT NULL,
    admssn_sts_cd VARCHAR(30) NOT NULL DEFAULT 'ADMITTED',
    nt_txt TEXT,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admssn_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_admssn_dctr FOREIGN KEY (attndng_dctr_id) REFERENCES dctr(dctr_id) ON DELETE RESTRICT,
    CONSTRAINT fk_admssn_dept FOREIGN KEY (dept_id) REFERENCES dept(dept_id) ON DELETE RESTRICT,
    CONSTRAINT fk_admssn_rm FOREIGN KEY (rm_id) REFERENCES rm(rm_id) ON DELETE SET NULL,
    CONSTRAINT fk_admssn_bed FOREIGN KEY (bed_id) REFERENCES bed(bed_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_admssn_ptnt ON admssn(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_admssn_sts ON admssn(admssn_sts_cd);

-- Table 38: dschrg — Patient Discharge Summary
CREATE TABLE IF NOT EXISTS dschrg (
    dschrg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admssn_id UUID NOT NULL UNIQUE,
    ptnt_id UUID NOT NULL,
    dctr_id UUID NOT NULL,
    dschrg_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dschrg_dx_txt TEXT NOT NULL,
    dschrg_cond_cd VARCHAR(30) NOT NULL DEFAULT 'STABLE', -- STABLE, IMPROVED, CRITICAL
    dschrg_instrctn_txt TEXT NOT NULL,
    fllw_up_dt DATE,
    dschrg_nt_txt TEXT,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dschrg_admssn FOREIGN KEY (admssn_id) REFERENCES admssn(admssn_id) ON DELETE CASCADE,
    CONSTRAINT fk_dschrg_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_dschrg_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_dschrg_ptnt ON dschrg(ptnt_id);

-- Table 42: fllw_up — Scheduled Clinical Follow-Up
CREATE TABLE IF NOT EXISTS fllw_up (
    fllw_up_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    encntr_id UUID,
    dctr_id UUID NOT NULL,
    fllw_up_dt DATE NOT NULL,
    fllw_up_typ_cd VARCHAR(30) NOT NULL DEFAULT 'POST_DISCHARGE',
    fllw_up_instrctn_txt TEXT,
    fllw_up_sts_cd VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updt_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fllw_up_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_fllw_up_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE SET NULL,
    CONSTRAINT fk_fllw_up_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_fllw_up_ptnt ON fllw_up(ptnt_id);

-- =============================================================================
-- 6. LABS, DIAGNOSTICS & CLINICAL REPORTS
-- =============================================================================

-- Table 39: lab_ordr — Laboratory Orders
CREATE TABLE IF NOT EXISTS lab_ordr (
    lab_ordr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    encntr_id UUID,
    dctr_id UUID NOT NULL,
    test_nm VARCHAR(250) NOT NULL,
    test_cd VARCHAR(50) NOT NULL, -- LOINC
    ordr_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ordr_sts_cd VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    priority_cd VARCHAR(20) NOT NULL DEFAULT 'ROUTINE', -- STAT, URGENT, ROUTINE
    instrctn_txt TEXT,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lab_ordr_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_lab_ordr_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE SET NULL,
    CONSTRAINT fk_lab_ordr_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_lab_ordr_ptnt ON lab_ordr(ptnt_id);

-- Table 40: lab_rslt — Laboratory Analyte Results
CREATE TABLE IF NOT EXISTS lab_rslt (
    lab_rslt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_ordr_id UUID NOT NULL,
    ptnt_id UUID NOT NULL,
    encntr_id UUID,
    test_nm VARCHAR(250) NOT NULL,
    test_cd VARCHAR(50) NOT NULL,
    rslt_val VARCHAR(500),
    rslt_num_val DECIMAL(12, 4),
    unit_cd VARCHAR(30),
    ref_rng_txt VARCHAR(100),
    abnrml_fl BOOLEAN NOT NULL DEFAULT FALSE,
    rslt_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vrfd_by UUID,
    lab_rslt_sts_cd VARCHAR(30) NOT NULL DEFAULT 'FINAL',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lab_rslt_ordr FOREIGN KEY (lab_ordr_id) REFERENCES lab_ordr(lab_ordr_id) ON DELETE CASCADE,
    CONSTRAINT fk_lab_rslt_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_lab_rslt_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE SET NULL,
    CONSTRAINT fk_lab_rslt_vrfd_by FOREIGN KEY (vrfd_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_lab_rslt_ptnt ON lab_rslt(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_lab_rslt_ordr ON lab_rslt(lab_ordr_id);

-- Table 41: dgnstc_rprt — Diagnostic & Radiology Narrative Reports
CREATE TABLE IF NOT EXISTS dgnstc_rprt (
    dgnstc_rprt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    encntr_id UUID,
    dctr_id UUID NOT NULL,
    rprt_typ_cd VARCHAR(50) NOT NULL, -- RADIOLOGY, PATHOLOGY, ECG, ECHO
    rprt_nm VARCHAR(250) NOT NULL,
    rprt_txt TEXT NOT NULL,
    rprt_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rprt_sts_cd VARCHAR(30) NOT NULL DEFAULT 'FINAL',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dgnstc_rprt_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_dgnstc_rprt_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE SET NULL,
    CONSTRAINT fk_dgnstc_rprt_dctr FOREIGN KEY (dctr_id) REFERENCES dctr(dctr_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_dgnstc_rprt_ptnt ON dgnstc_rprt(ptnt_id);

-- =============================================================================
-- 7. DOCUMENTS & AI CLINICAL RAG EMBEDDINGS
-- =============================================================================

-- Table 43: doc — Clinical Document Store
CREATE TABLE IF NOT EXISTS doc (
    doc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    encntr_id UUID,
    doc_typ_cd VARCHAR(50) NOT NULL, -- LAB_REPORT, DISCHARGE_SUMMARY, REFERRAL
    file_nm VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_typ VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    file_hash VARCHAR(128) NOT NULL,
    file_sz_num BIGINT NOT NULL DEFAULT 0,
    upld_by UUID,
    upld_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    doc_sts_cd VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT fk_doc_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_doc_encntr FOREIGN KEY (encntr_id) REFERENCES encntr(encntr_id) ON DELETE SET NULL,
    CONSTRAINT fk_doc_upld_by FOREIGN KEY (upld_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_doc_ptnt ON doc(ptnt_id);

-- Table 44: doc_chunk — Semantic Text Chunks for RAG Retrieval
CREATE TABLE IF NOT EXISTS doc_chunk (
    doc_chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL,
    chunk_seq_num INTEGER NOT NULL,
    chunk_txt TEXT NOT NULL,
    metadata_json JSONB,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doc_chunk_seq UNIQUE (doc_id, chunk_seq_num),
    CONSTRAINT fk_doc_chunk_doc FOREIGN KEY (doc_id) REFERENCES doc(doc_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_doc_chunk_doc ON doc_chunk(doc_id);

-- Table 45: doc_embddng — Vector Embeddings (pgvector)
CREATE TABLE IF NOT EXISTS doc_embddng (
    doc_embddng_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_chunk_id UUID NOT NULL UNIQUE,
    embedding_vec vector(768),
    model_nm VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_doc_embddng_chunk FOREIGN KEY (doc_chunk_id) REFERENCES doc_chunk(doc_chunk_id) ON DELETE CASCADE
);

-- =============================================================================
-- 8. DATA QUALITY, MPI & REGULATORY GOVERNANCE
-- =============================================================================

-- Table 46: dplct_case — Master Patient Index (MPI) Duplicate Matching
CREATE TABLE IF NOT EXISTS dplct_case (
    dplct_case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_typ_cd VARCHAR(30) NOT NULL DEFAULT 'PATIENT',
    record_a_id UUID NOT NULL,
    record_b_id UUID NOT NULL,
    nm_mtch_scr DECIMAL(5, 4) NOT NULL,
    dob_mtch_scr DECIMAL(5, 4) NOT NULL,
    phn_mtch_scr DECIMAL(5, 4) NOT NULL,
    email_mtch_scr DECIMAL(5, 4) NOT NULL,
    addr_mtch_scr DECIMAL(5, 4) NOT NULL,
    overall_mtch_scr DECIMAL(5, 4) NOT NULL,
    dplct_sts_cd VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, CONFIRMED, REJECTED
    detctd_by VARCHAR(30) NOT NULL DEFAULT 'MPI_ALGORITHM',
    rvwd_by UUID,
    rvwd_dt TIMESTAMP WITH TIME ZONE,
    rvw_nt_txt TEXT,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dplct_case_rvwd_by FOREIGN KEY (rvwd_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_dplct_scr ON dplct_case(overall_mtch_scr);

-- Table 47: ptnt_merge — MPI Survivor Record Merge History
CREATE TABLE IF NOT EXISTS ptnt_merge (
    ptnt_merge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survvg_ptnt_id UUID NOT NULL,
    mrged_ptnt_id UUID NOT NULL,
    merge_rsn_txt TEXT NOT NULL,
    merge_sts_cd VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    prfrmd_by UUID,
    prfrmd_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rollback_ref_txt VARCHAR(500),
    CONSTRAINT fk_ptnt_merge_surv FOREIGN KEY (survvg_ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ptnt_merge_mrged FOREIGN KEY (mrged_ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ptnt_merge_prfrmd_by FOREIGN KEY (prfrmd_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_ptnt_merge_surv ON ptnt_merge(survvg_ptnt_id);

-- Table 48: data_cnflct — Field-Level Data Quality Discrepancies
CREATE TABLE IF NOT EXISTS data_cnflct (
    data_cnflct_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptnt_id UUID NOT NULL,
    entity_typ_cd VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    field_nm VARCHAR(100) NOT NULL,
    value_a_txt TEXT,
    value_b_txt TEXT,
    cnflct_sts_cd VARCHAR(30) NOT NULL DEFAULT 'UNRESOLVED',
    rvwd_by UUID,
    rvwd_dttm TIMESTAMP WITH TIME ZONE,
    rslt_txt TEXT,
    crte_dt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_data_cnflct_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE CASCADE,
    CONSTRAINT fk_data_cnflct_rvwd_by FOREIGN KEY (rvwd_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_data_cnflct_ptnt ON data_cnflct(ptnt_id);

-- Table 49: rcd_vrsn — Immutable Snapshot Audit for Legal Records
CREATE TABLE IF NOT EXISTS rcd_vrsn (
    rcd_vrsn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_typ_cd VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    vrsn_num INTEGER NOT NULL,
    data_snapshot_json JSONB NOT NULL,
    chngd_by UUID,
    chngd_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    chng_rsn_txt TEXT,
    CONSTRAINT uq_rcd_vrsn UNIQUE (entity_typ_cd, entity_id, vrsn_num),
    CONSTRAINT fk_rcd_vrsn_chngd_by FOREIGN KEY (chngd_by) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_rcd_vrsn_entity ON rcd_vrsn(entity_typ_cd, entity_id);

-- Table 50: adt_log — HIPAA Security & System Operation Telemetry
CREATE TABLE IF NOT EXISTS adt_log (
    adt_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usr_id UUID,
    actn_cd VARCHAR(50) NOT NULL,
    entity_typ_cd VARCHAR(50) NOT NULL,
    entity_id UUID,
    req_id VARCHAR(100),
    ip_addr VARCHAR(50),
    user_agent_txt VARCHAR(500),
    rslt_cd VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    metadata_json JSONB,
    crte_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_adt_log_usr FOREIGN KEY (usr_id) REFERENCES usr(usr_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ix_adt_log_usr ON adt_log(usr_id);
CREATE INDEX IF NOT EXISTS ix_adt_log_dttm ON adt_log(crte_dttm);
CREATE INDEX IF NOT EXISTS ix_adt_log_actn ON adt_log(actn_cd);

-- Table 51: accs_log — Sensitive Health Information (PHI) Access Audit
CREATE TABLE IF NOT EXISTS accs_log (
    accs_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usr_id UUID NOT NULL,
    ptnt_id UUID NOT NULL,
    accs_typ_cd VARCHAR(30) NOT NULL, -- READ, EXPORT, PRINT, EMERGENCY_BREAK_GLASS
    resource_typ_cd VARCHAR(50) NOT NULL,
    resource_id UUID,
    accs_rslt_cd VARCHAR(30) NOT NULL DEFAULT 'GRANTED',
    req_id VARCHAR(100),
    accs_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_accs_log_usr FOREIGN KEY (usr_id) REFERENCES usr(usr_id) ON DELETE RESTRICT,
    CONSTRAINT fk_accs_log_ptnt FOREIGN KEY (ptnt_id) REFERENCES ptnt_dtls(ptnt_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_accs_log_usr ON accs_log(usr_id);
CREATE INDEX IF NOT EXISTS ix_accs_log_ptnt ON accs_log(ptnt_id);
CREATE INDEX IF NOT EXISTS ix_accs_log_dttm ON accs_log(accs_dttm);

-- =============================================================================
-- END OF SCHEMA DEFINITION
-- =============================================================================
