# MediCare AI — Project Overview & Functional Inventory

**Document Version:** 1.0.0  
**Project:** MediCare AI — Healthcare Management Platform  
**Live Application:** [https://medicare-ai-iv31.onrender.com](https://medicare-ai-iv31.onrender.com)  
**Repository:** [https://github.com/gopidsai687/medicare-ai](https://github.com/gopidsai687/medicare-ai)  

---

## 1. Project Background and Vision

Modern healthcare delivery faces severe communication and data fragmentation. Patients are routinely handed clinical discharge summaries, laboratory panels, and handwritten prescriptions laden with impenetrable medical jargon. Between episodic clinical visits, chronic conditions such as essential hypertension and Type 2 diabetes go unmonitored, or are recorded in inconsistent paper logs prone to recall bias. Simultaneously, clinicians face administrative burnout navigating disjointed EHR interfaces, and hospital administrators struggle with duplicate records and opaque audit compliance.

**MediCare AI** was conceived to address these compounding challenges. Built as a comprehensive, cloud-native healthcare platform, it unites:
1. **Longitudinal Vitals Monitoring (VitalSense):** Structured, high-integrity recording of cardiovascular and metabolic telemetry with automated clinical guideline evaluation.
2. **Clinical Document Intelligence:** Optical Character Recognition (OCR) and PDF parsing pipelines combined with generative AI to extract medications, interpret diagnostic labs, and explain findings in clear, accessible language.
3. **Multimodal Health Visualization (Digital Twin HUD & Body Map):** Interactive anatomical representations linking organ systems to patient records and physiological telemetry.
4. **Clinical Governance & Access Control:** Role-based segregation for Patients, Clinicians, and Administrators backed by HIPAA-aligned audit logs and Master Patient Index (MPI) deduplication.

---

## 2. Target Users and Personas

MediCare AI provides purpose-built interfaces tailored to three distinct user groups:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               USER PERSONAS                                     │
├────────────────────┬────────────────────────────┬───────────────────────────────┤
│ Patient            │ Clinician (Doctor / Nurse) │ Administrator                 │
├────────────────────┼────────────────────────────┼───────────────────────────────┤
│ • Chronic disease  │ • Primary care physicians  │ • Hospital IT directors       │
│   self-managers    │ • Specialist clinicians    │ • Clinical operations managers│
│ • Post-discharge   │ • Triage nurses            │ • Medical records directors   │
│   recovery patients│ • Clinical staff           │ • Compliance officers         │
│ • Health-literacy  │ • Need concise longitudinal│ • Need system auditability,   │
│   seekers          │   telemetry, triage alerts,│   staff credentialing, and    │
│ • Need clear plain-│   and decision support.    │   master patient identity.    │
│   language data.   │                            │                               │
└────────────────────┴────────────────────────────┴───────────────────────────────┘
```

---

## 3. Verified Functional Inventory

Every feature in the repository has been audited against the active codebase, database schema, and test suite. Features are categorized into three clear transparency tiers:

### Category A: Fully Implemented and Verified
These capabilities exist in the codebase, are backed by database models and API endpoints, and have passed automated tests:

1. **Role-Based Authentication & Session Management:**
   - Standard email and password login backed by Argon2id / bcrypt cryptographic hashing.
   - Dual-token JWT bearer authentication (short-lived access token, rotating refresh token).
   - Strict role-based route guards protecting `/patient/*`, `/doctor/*`, and `/admin/*`.
   - Guaranteed loading state resets, duplicate submission guards, and 15s request timeouts.

2. **VitalSense Cardiovascular Tracking:**
   - Manual entry of Systolic BP, Diastolic BP, and Resting Heart Rate.
   - Automated Mean Arterial Pressure (MAP) computation: $\text{MAP} \approx \text{DBP} + \frac{1}{3}(\text{SBP} - \text{DBP})$.
   - Deterministic American Heart Association (AHA) categorization: Normal, Elevated, Hypertension Stage 1, Hypertension Stage 2, and Hypertensive Crisis.
   - Strict provenance metadata recording (`manual_home_cuff`, `PATIENT_MANUAL`).

3. **VitalSense Metabolic Tracking:**
   - Manual entry of Blood Glucose with dual-unit support (mg/dL and mmol/L auto-conversion).
   - Measurement context tagging: Fasting, Postprandial (2hr post-meal), Bedtime, and Random.
   - Deterministic American Diabetes Association (ADA) risk stratification.
   - Strict provenance metadata recording (`manual_fingerstick`, `PATIENT_MANUAL`).

4. **Prescription Document Processing Pipeline:**
   - Binary magic-byte validation (PDF `%PDF-`, PNG, JPEG) and 10MB upload limits.
   - Anti-prompt-injection sanitization stripping adversarial override patterns.
   - Multi-page PDF text extraction via `pypdf` with OCR fallback.
   - Deterministic regex entity extraction for drug names, dosages, and administration frequencies.
   - Google Gemini generative AI clinical summary generation with intelligent fallback.
   - Rule-based drug-drug interaction checker screening 10 high-risk medication pairs.

5. **Medical Report & Lab Diagnostic Pipeline:**
   - Extraction of clinical laboratory panels (CBC, Metabolic Panel, Lipid Panel, Renal, Liver, Thyroid).
   - Embedded clinical dictionary translating 37 complex medical terms into plain English.
   - Automated reference range comparison flagging High, Low, and Critical values.
   - Structured JSON output delivering Patient Plain-Language Summary, Clinical Findings, Suggested Follow-Up Questions, and Red-Flag Emergency Guidance.

6. **Full Body Diagnostics & Digital Twin HUD:**
   - Interactive SVG Anatomical Body Map linking organ systems (Brain, Cardiovascular, Pulmonary, Renal, Metabolic) to corresponding patient records, prescriptions, and lab results.
   - High-tech Digital Twin HUD featuring simulated 3-axis MRI views, animated ECG waveform, thoracic imaging radiographic overlay, 3D anatomical twin with nodal markers, neural reconstruction cortex model, and DNA genomic sequencing visualization.

7. **Clinical Decision Support & Alerting Engine:**
   - Automated threshold evaluation evaluating vital signs against critical clinical safety limits.
   - Generation of high-priority clinician alerts upon detection of Hypertensive Crisis or severe hypoglycemia.
   - Clinician triage queue allowing doctors to review, acknowledge, record follow-up notes, and sign off.

8. **Enterprise Governance & Audit Trail:**
   - Immutable audit logging tracking all access to patient data, logins, record updates, and patient merges.
   - Master Patient Index (MPI) linkage algorithms evaluating demographic phonetic similarity to identify duplicate patient charts.

---

### Category B: Partially Implemented or Requiring Verification
These features have underlying backend architecture or UI prototypes but operate with external limitations:

1. **Web Bluetooth (BLE) Hardware Connectivity:**
   - Frontend Web Bluetooth API adapter exists in `DeviceConnections.tsx` to discover and pair with standard Bluetooth GATT Blood Pressure and Heart Rate monitors.
   - *Limitation:* Web Bluetooth is restricted to Chromium-based browsers (Chrome/Edge on Windows, macOS, Android); it is unsupported on iOS Safari. Requires physical compatible hardware.
2. **Experimental Webcam rPPG (Remote Photoplethysmography):**
   - Functional client-side video frame sampling (`WebcamPulseModal.tsx`) computing green-channel intensity changes to calculate heart rate.
   - *Limitation:* Highly sensitive to ambient lighting, subject motion, camera frame rate, and skin tone variations. Clinically unvalidated and strictly designated for educational research.
3. **Carrier Push Notifications & SMS:**
   - User notification preference endpoints and Web Push subscription models exist in `vitals.py`.
   - *Limitation:* Live production SMS/push delivery requires an external carrier gateway (Twilio / VAPID server configuration).

---

### Category C: Proposed Future Capabilities
Planned features for subsequent architectural phases:

1. **SMART-on-FHIR R4 Interoperability:** Direct integration with Epic Systems, Cerner/Oracle Health, and hospital EHR systems via standard FHIR REST resources (`Patient`, `Observation`, `DiagnosticReport`, `MedicationRequest`).
2. **Wearable Vendor Cloud Sync:** Direct OAuth2 sync with Apple HealthKit, Google Health Connect, and Dexcom CGM APIs.
3. **FDA 510(k) SaMD Clearance:** Formal clinical validation trials and regulatory submission for diagnostic AI algorithms.
4. **DICOM PACS Imaging Integration:** Interactive diagnostic radiological viewer supporting multi-planar CT/MRI reconstructions.
5. **WebRTC Telemedicine Video:** Encrypted peer-to-peer clinical consultations with in-call telemetry overlays.

---

## 4. Healthcare Safety and Ethical Principles

1. **Non-Diagnostic Educational Disclosure:** The platform prominently reminds users that AI-generated interpretations and educational summaries do not replace professional clinical evaluation.
2. **Emergency Protocol Enforcement:** If acute red-flag symptoms are detected (e.g., crushing substernal chest pain, acute hemiparesis, sudden dyspnea), the system immediately instructs the patient to seek emergency care (911).
3. **Zero Fictional Data Contamination:** Every telemetry reading in the database carries an immutable `measurement_source` and `is_sample` flag. Simulated demo data and manual self-reported entries are strictly separated from genuine clinical readings.
