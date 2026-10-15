# MediCare AI — Comprehensive Use-Case Documentation

**Document Version:** 1.0.0  
**Project:** MediCare AI — Healthcare Management Platform  
**Live Application:** [https://medicare-ai-iv31.onrender.com](https://medicare-ai-iv31.onrender.com)  

---

## 1. Patient Portal Use Cases

### UC-PAT-01: Secure Sign In and Session Establishment
- **Primary User:** Patient
- **Problem Addressed:** Unauthenticated access or compromised credentials risking unauthorized access to protected health information (PHI).
- **Preconditions:** Patient account has been registered and verified in the database.
- **Workflow:**
  1. Patient navigates to `/login`.
  2. Enters registered email address and password.
  3. Frontend verifies form completeness, disables the submit button, and submits credentials to `POST /api/v1/auth/login`.
  4. Backend verifies Argon2id / bcrypt password hash.
  5. Backend generates an encrypted JWT access token (30-min TTL) and refresh token (7-day TTL).
  6. Frontend stores session tokens, retrieves `/api/v1/auth/me`, verifies the `patient` role, and redirects to `/patient`.
- **Inputs:** Email string, Password string.
- **Outputs:** JWT Bearer access token, user profile object, redirect to Patient Dashboard.
- **Benefits:** Prevents credential stuffing; enforces role isolation; eliminates hanging loading spinners via 15s timeout.
- **Exceptions:**
  - Invalid credentials -> Backend returns HTTP 401 with `"Incorrect email or password"`; UI displays clear error banner and resets loading button immediately.
  - Expired session -> API interceptor redirects to `/login` without infinite refresh loops.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Passwords are never logged; tokens are transmitted exclusively over TLS.

---

### UC-PAT-02: View Personal Health Dashboard
- **Primary User:** Patient
- **Problem Addressed:** Fragmented view of appointments, vital signs, active medications, and urgent alerts.
- **Preconditions:** Patient is authenticated with role `patient`.
- **Workflow:**
  1. Patient accesses `/patient`.
  2. System queries `/api/v1/vitals/summary`, `/api/v1/appointments`, and `/api/v1/prescriptions`.
  3. Dashboard renders summary cards: Latest Blood Pressure, Blood Glucose, Active Prescriptions, Upcoming Doctor Visits, and Health Score index.
- **Inputs:** Authenticated session context.
- **Outputs:** Aggregated clinical summary dashboard with trend badges.
- **Benefits:** Centralizes primary health metrics at a glance; encourages self-monitoring.
- **Exceptions:**
  - Network failure -> Toast notification informs patient; cached UI gracefully displays empty states.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** High-risk abnormal vitals trigger prominent visual warning badges.

---

### UC-PAT-03: Record Blood Pressure Manually
- **Primary User:** Patient
- **Problem Addressed:** Clinic-only blood pressure measurements miss ambulatory hypertension and white-coat syndrome.
- **Preconditions:** Patient has taken a reading using a calibrated home oscillometric arm cuff.
- **Workflow:**
  1. Patient navigates to `/patient/vitalsense` and clicks **"Log Blood Pressure"**.
  2. Modal opens with numeric fields for Systolic (mmHg), Diastolic (mmHg), and Resting Heart Rate (BPM).
  3. Patient enters readings (e.g., 124 / 82 mmHg, 72 BPM) and notes (e.g., "Morning resting").
  4. Client validates physiologic bounds (Systolic: 60–260 mmHg, Diastolic: 40–160 mmHg, Pulse: 30–220 BPM).
  5. Frontend submits `POST /api/v1/vitals/blood-pressure` with `measurement_source: "manual_home_cuff"`.
  6. Backend stores record, computes Mean Arterial Pressure ($82 + \frac{124-82}{3} = 96.0$ mmHg), and classifies reading per AHA guidelines (**Stage 1 Hypertension**).
  7. If reading exceeds safety threshold ($\ge 180$ systolic or $\ge 120$ diastolic), an urgent clinical alert is dispatched.
  8. Modal closes; longitudinal chart updates immediately.
- **Inputs:** Systolic BP, Diastolic BP, Heart Rate, optional notes.
- **Outputs:** Stored `VitalSign` record with computed MAP, AHA category, and provenance timestamp.
- **Benefits:** Structured chronic disease tracking; automated cardiovascular risk classification.
- **Exceptions:**
  - Physically impossible input ($< 30$ or $> 300$) -> Form validation rejects submission with informative validation error.
  - Hypertensive Crisis -> Immediate red emergency modal advising the patient to seek urgent medical attention.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Clear disclaimer that self-recorded readings should be verified by a licensed clinician.

---

### UC-PAT-04: Record Blood Glucose Manually
- **Primary User:** Patient
- **Problem Addressed:** Lack of structured meal-context logging makes diabetic glycemic variability impossible to interpret.
- **Preconditions:** Patient has performed a capillary blood glucose measurement using a home electrochemical glucometer.
- **Workflow:**
  1. Patient navigates to `/patient/vitalsense` and selects **"Log Blood Glucose"**.
  2. Selects preferred unit: `mg/dL` or `mmol/L`.
  3. Enters numeric value (e.g., $105.0$ mg/dL).
  4. Selects measurement context: **Fasting**, **Postprandial (2hr post-meal)**, **Bedtime**, or **Random**.
  5. Submits to `POST /api/v1/vitals/blood-glucose` with `measurement_source: "manual_fingerstick"`.
  6. Backend automatically computes reciprocal conversion ($105.0\text{ mg/dL} \div 18.0182 = 5.83\text{ mmol/L}$) and applies ADA context-aware thresholds (**Normal Fasting**).
  7. Historical scatter plot updates with color-coded glycemic zones.
- **Inputs:** Numeric glucose value, unit selection, clinical context, notes.
- **Outputs:** Persisted record with dual-unit fields (`blood_glucose`, `blood_glucose_mmol`), ADA classification, and context tag.
- **Benefits:** Prevents dangerous unit confusion between international (mmol/L) and US (mg/dL) standards.
- **Exceptions:**
  - Severe Hypoglycemia ($< 54$ mg/dL) -> Immediate emergency alert instructing ingestion of 15g fast-acting carbohydrates and emergency contact.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Dual-unit conversions are computed deterministically on the backend to prevent float rounding errors.

---

### UC-PAT-05: Upload and Analyze a Prescription Document
- **Primary User:** Patient
- **Problem Addressed:** Illegible prescription handwriting, confusing Latin abbreviations (QD, BID, PRN), and unvetted drug-drug interactions.
- **Preconditions:** Patient possesses a printed, digital, or scanned prescription (PDF, PNG, or JPEG).
- **Workflow:**
  1. Patient navigates to `/patient/prescriptions` and drags file into the upload dropzone.
  2. Frontend validates file extension and size ($\le 10$ MB).
  3. Submits multipart request to `POST /api/v1/prescriptions/upload`.
  4. Backend verifies binary magic bytes (`%PDF-`, `\x89PNG`, `\xFF\xD8\xFF`).
  5. Text extraction service parses text using `pypdf` with OCR fallback.
  6. Sanitization engine filters prompt-injection attack vectors (`[REDACTED_INJECTION_PATTERN]`).
  7. Deterministic regex entity recognizer identifies medications (e.g., *Lisinopril 10mg PO Daily*).
  8. AI Service (Gemini 2.5 Pro or Clinical Fallback Engine) formats plain-language patient explanations (purpose, when to take, food considerations).
  9. Drug interaction screening engine checks extracted medications against patient's existing active medication list.
  10. Results are returned and displayed in a structured summary card.
- **Inputs:** Prescription document file (PDF/image).
- **Outputs:** Structured extraction report: Medication Name, Dosage, Frequency, Plain-Language Purpose, Safety Warnings, Drug Interactions.
- **Benefits:** Dramatically improves patient medication adherence and prevents medication errors.
- **Exceptions:**
  - Corrupted or unreadable image -> System prompts patient to upload a clearer photograph with higher contrast.
  - Critical Drug Interaction Detected -> Prominent Amber/Red alert with clinical rationale and advice to consult prescribing doctor.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Prominent advisory: *"Do not alter or discontinue prescribed medication without consulting your physician."*

---

### UC-PAT-06: Upload and Analyze a Diagnostic Medical/Lab Report
- **Primary User:** Patient
- **Problem Addressed:** Routine laboratory reports (e.g., Comprehensive Metabolic Panel, Lipid Profile) contain numerical values and cryptic abbreviations that induce extreme patient anxiety.
- **Preconditions:** Patient has received a clinical laboratory PDF or diagnostic report.
- **Workflow:**
  1. Patient accesses `/patient/reports` and uploads report file.
  2. Pipeline extracts multi-page text and sanitizes inputs.
  3. Clinical entity recognizer extracts test names, measured values, units, and clinical reference ranges.
  4. Abnormal result evaluator flags values falling outside standard biological reference ranges (High, Low, Critical).
  5. Built-in medical terminology dictionary maps complex terms (e.g., *thrombocytopenia*, *eGFR*, *leukocytosis*) to plain-language descriptions.
  6. Generative AI compiles four distinct sections:
     - **Patient Plain-Language Summary:** Educational overview in conversational English.
     - **Extracted Lab Values Table:** Measured vs normal reference ranges with colored status chips.
     - **Questions for Your Doctor:** 3–5 intelligent questions to ask at the next clinical consultation.
     - **Red-Flag Warnings:** Immediate medical advice if critical thresholds are breached.
- **Inputs:** Diagnostic lab report PDF or image.
- **Outputs:** Comprehensive, plain-language patient analysis view with exportable summary.
- **Benefits:** Alleviates patient anxiety; transforms passive recipients of care into informed participants.
- **Exceptions:**
  - Critical laboratory value (e.g., Potassium $> 6.5$ mEq/L) -> System displays urgent red advisory recommending immediate emergency department evaluation.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Explicitly states that reference ranges vary by laboratory and clinical context.

---

### UC-PAT-07: Interactive Anatomical Body Map & Digital Twin HUD
- **Primary User:** Patient
- **Problem Addressed:** Abstract tabular records fail to give patients an intuitive understanding of which organ systems their medications and diagnoses pertain to.
- **Preconditions:** Patient has logged vitals, prescriptions, or medical records.
- **Workflow:**
  1. Patient opens `/patient/vitalsense` and selects the **"Anatomical Body Map"** tab.
  2. An interactive SVG human anatomy model is rendered with color-coded organ nodes (Brain, Heart, Lungs, Kidneys, Pancreas, Vascular System).
  3. Patient clicks on an organ node (e.g., **Pancreas**).
  4. System filters and displays related records: recent Blood Glucose readings, active Metformin prescription, and HbA1c lab tests.
  5. Patient toggles to **"Diagnostics HUD"** mode: a high-tech clinical twin interface displays animated ECG lead rhythm, 3-axis MRI scans, thoracic imaging overlay, neural cortex reconstruction, and genomic sequence indicators.
- **Inputs:** Interactive user click on anatomical region or view toggle.
- **Outputs:** Organ-specific clinical record drawer; synchronized digital twin telemetry.
- **Benefits:** Highly engaging educational tool that bridges spatial anatomical knowledge with medical records.
- **Exceptions:**
  - No records for selected organ -> Educational overview of the organ system is displayed with general wellness advice.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Digital twin animations are clearly designated as visual representations based on synthetic/aggregated data.

---

### UC-PAT-08: Experimental Webcam rPPG Pulse Detection
- **Primary User:** Patient (Research / Educational context)
- **Problem Addressed:** Lack of external pulse oximeter hardware in low-resource home environments.
- **Preconditions:** Patient device has a connected webcam and grants browser camera permissions over HTTPS.
- **Workflow:**
  1. Patient navigates to `/patient/vitalsense/research`.
  2. Reads explicit experimental disclaimer: *"Experimental client-side optical rPPG research. Not a medical device."*
  3. Patient positions face within the on-screen alignment guide in good ambient lighting.
  4. Client-side algorithm samples video frames at 30 FPS, isolates forehead region of interest (ROI), and extracts mean green-channel light absorption fluctuations caused by arterial blood pulsation.
  5. A bandpass filter (0.75–3.0 Hz, corresponding to 45–180 BPM) attenuates high-frequency noise and DC illumination drift.
  6. Real-time photoplethysmogram waveform is displayed with estimated pulse rate.
  7. If patient clicks "Save Measurement", reading is logged with `measurement_source: "experimental_webcam_rppg"` and `is_sample: false`.
- **Inputs:** Webcam video stream.
- **Outputs:** Estimated pulse rate, signal quality index, optical waveform.
- **Benefits:** Demonstrates future hardwareless telemetry potential; accessible zero-cost physiological research.
- **Exceptions:**
  - Poor lighting or subject motion -> Signal Quality Index drops to "DEGRADED" or "NOISE_CONTAMINATED"; calculation pauses until stability is restored.
- **Status:** **[Category B — Partially Implemented / Experimental]**
- **Safety Considerations:** Must never be used to diagnose cardiac arrhythmias or replace ECG / clinical pulse oximetry.

---

## 2. Clinician (Doctor / Nurse) Use Cases

### UC-DOC-01: Doctor Dashboard and Patient Triage Roster
- **Primary User:** Licensed Physician / Triage Nurse
- **Problem Addressed:** Clinicians are inundated with raw data and need prioritized triage queues to identify deteriorating patients.
- **Preconditions:** Clinician authenticated with role `doctor` or `nurse`.
- **Workflow:**
  1. Clinician logs in and accesses `/doctor`.
  2. System loads clinician's assigned patient roster, today's appointment schedule, and pending clinical alerts.
  3. Patient roster displays risk stratification chips (Stable, Guarded, Critical).
  4. Clinician clicks on a patient to inspect longitudinal charts and recent encounters.
- **Inputs:** Clinician session context.
- **Outputs:** Prioritized patient roster, daily appointment schedule, triage summary.
- **Benefits:** Maximizes clinical efficiency by directing immediate attention to unstable patients.
- **Exceptions:**
  - Unauthorized access to unassigned patient -> Backend returns HTTP 403 Forbidden.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Patient data is isolated by role and clinician-patient assignment.

---

### UC-DOC-02: Review VitalSense Clinical Alert Queue
- **Primary User:** Doctor / Clinical Staff
- **Problem Addressed:** Dangerous out-of-range patient readings must be reviewed, acknowledged, and actioned with documented accountability.
- **Preconditions:** Patient vital sign reading triggered an alert ($\ge \text{Stage 2}$ or Crisis).
- **Workflow:**
  1. Doctor opens `/doctor/alerts`.
  2. Alert queue lists pending alerts ordered by severity: **CRITICAL** (Hypertensive Crisis, Severe Hypoglycemia), **WARNING** (Stage 1/2 HTN, Elevated Fasting Glucose).
  3. Doctor selects an alert to review patient context, recent measurements, and current medications.
  4. Doctor records clinical review notes (e.g., *"Adjusted Amlodipine dosage from 5mg to 10mg; requested 48hr follow-up reading"*).
  5. Clicks **"Acknowledge & Sign Off"**.
  6. Backend updates `vital_alerts` with `status: "RESOLVED"`, `actioned_by_id: doctor_id`, and `actioned_at: timestamp`.
- **Inputs:** Alert ID, doctor clinical note, follow-up action.
- **Outputs:** Resolved alert status with immutable timestamped audit record.
- **Benefits:** Closes the clinical loop; satisfies medico-legal documentation standards.
- **Exceptions:**
  - Patient has revoked sharing consent -> Clinician view displays consent revocation notice.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Clinicians cannot delete alerts; all actions create audit log entries.

---

### UC-DOC-03: Clinical Encounters and SOAP Notes
- **Primary User:** Physician
- **Problem Addressed:** Need for standardized clinical documentation (Subjective, Objective, Assessment, Plan) during patient consultations.
- **Preconditions:** Doctor has an active encounter with an assigned patient.
- **Workflow:**
  1. Doctor opens `/doctor/encounters` and selects patient.
  2. Enters SOAP sections:
     - **Subjective:** Patient complaints, history of present illness.
     - **Objective:** Physical exam findings, VitalSense telemetry review.
     - **Assessment:** Differential diagnosis, ICD-10 diagnostic codes.
     - **Plan:** Therapeutic interventions, prescriptions, follow-up schedule.
  3. Submits encounter to `POST /api/v1/encounters`.
  4. Backend creates immutable clinical encounter record and dispatches encounter summary to patient portal.
- **Inputs:** Structured SOAP note fields, ICD-10 diagnostic codes.
- **Outputs:** Persisted encounter record linked to patient chart.
- **Benefits:** Enforces standard clinical documentation; seamless information flow to patient portal.
- **Status:** **[Category A — Implemented & Verified]**

---

## 3. Administrator Use Cases

### UC-ADM-01: HIPAA Audit Trail and Security Monitoring
- **Primary User:** Compliance Officer / Hospital IT Administrator
- **Problem Addressed:** Regulatory requirement (HIPAA Security Rule § 164.312(b)) to record and examine activity in systems containing electronic protected health information (ePHI).
- **Preconditions:** User authenticated with role `admin`.
- **Workflow:**
  1. Administrator navigates to `/admin/audit-logs`.
  2. Table displays all recorded audit events with filtering by date range, action type, and severity level (`INFO`, `WARNING`, `CRITICAL`).
  3. Each record details: Timestamp, Actor ID, Actor Role, Client IP Address, Action (e.g., `PATIENT_RECORD_VIEW`, `LOGIN_SUCCESS`, `PATIENT_MERGE`, `PRESCRIPTION_UPLOAD`), Resource Target, and Outcome.
  4. Administrator can export audit logs for external compliance auditing.
- **Inputs:** Date filters, action type filters.
- **Outputs:** Filterable, exportable audit log trail.
- **Benefits:** Complete regulatory transparency; immediate detection of anomalous data access patterns.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Audit logs are append-only; administrators cannot edit or purge audit events.

---

### UC-ADM-02: Master Patient Index (MPI) Deduplication and Merging
- **Primary User:** Health Informatics Administrator / Medical Records Registrar
- **Problem Addressed:** Duplicate patient records created through typographical errors, marriage name changes, or multi-facility intake create fragmented records and life-threatening medical errors.
- **Preconditions:** Multiple unlinked patient profiles exist in the enterprise database.
- **Workflow:**
  1. Administrator accesses `/admin/patients` and runs MPI linkage algorithm via `GET /api/v1/mpi/duplicate-candidates`.
  2. System compares patient demographics using Soundex / Metaphone phonetic matching, Levenshtein distance on names, and exact match on date of birth / national ID.
  3. System surfaces candidate pairs with calculated match confidence scores (e.g., 94% probability: *Johnathan Smith* vs *Jon Smith*, matching DOB).
  4. Administrator inspects both profiles, confirms duplicate identity, and executes `POST /api/v1/mpi/merge`.
  5. Backend re-links all encounters, prescriptions, vitals, and lab records to the surviving primary master patient record.
  6. Secondary record is marked `MERGED_INACTIVE` and an immutable `PATIENT_MERGE` audit record is created.
- **Inputs:** Primary Patient ID, Duplicate Patient ID, clinical justification.
- **Outputs:** Unified patient record with preserved clinical history and merge audit trail.
- **Benefits:** Eliminates clinical record fragmentation; prevents duplicated diagnostic testing.
- **Status:** **[Category A — Implemented & Verified]**
- **Safety Considerations:** Secondary record is soft-retired, never hard-deleted; merge is fully reversible by database administrators.
