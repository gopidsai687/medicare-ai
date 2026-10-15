# MediCare AI — Security, Privacy, and Clinical Limitations

**Document Version:** 1.0.0  
**Project:** MediCare AI — Healthcare Management Platform  
**Live URL:** [https://medicare-ai-iv31.onrender.com](https://medicare-ai-iv31.onrender.com)  

---

## 1. Healthcare Safety & Non-Diagnostic Disclosure

> [!IMPORTANT]
> **LEGAL AND CLINICAL DISCLAIMER:**  
> MediCare AI is an operational software prototype, clinical workflow demonstration system, and educational health-management platform. It has **NOT** been evaluated, cleared, or approved by the United States Food and Drug Administration (FDA) as Software as a Medical Device (SaMD) under 21 CFR Part 820, nor has it received CE-mark certification under EU MDR 2017/745.
> 
> The platform is strictly intended to supplement patient education, organize historical health records, and streamline clinical documentation. **It does not provide definitive medical diagnoses, does not prescribe treatments, and must never replace direct evaluation, diagnosis, or treatment by a licensed physician or qualified healthcare provider.**

---

## 2. Biomedical Realities & Sensor Integrity

In digital healthcare technology, transparent communication regarding the capabilities and limitations of physiological sensors is paramount:

### A. Non-Invasive Biochemical and Arterial Measurements
- **Blood Glucose:** There is currently no FDA-cleared optical camera or smartphone application capable of measuring capillary or interstitial blood glucose through a standard web camera or display glass. Blood glucose tracking in MediCare AI requires genuine electrochemical test strip fingersticks, continuous glucose monitors (CGM), or clinical venous blood draws.
- **Blood Pressure:** True arterial blood pressure measurement requires an occluding pneumatic cuff (oscillometric or auscultatory sphygmomanometer) or an invasive arterial line. Ordinary webcam video, mobile touchscreens, or standard fingerprint sensors cannot measure systolic or diastolic blood pressure. MediCare AI requires patient entry from a validated home cuff or direct BLE ingestion from a validated medical device.

### B. Experimental Optical rPPG Research
- MediCare AI contains an experimental client-side research tool (`WebcamPulseModal.tsx`) exploring remote photoplethysmography (rPPG).
- **Physiological Basis:** When the heart beats, blood pulses through microvascular capillary beds beneath facial skin, slightly modulating the absorption of ambient green light ($\approx 520\text{–}560\text{ nm}$).
- **Severe Environmental Limitations:** rPPG accuracy is heavily degraded by motion artifacts, ambient light flicker (fluorescent lighting 50/60 Hz), low camera frame rates, optical compression artifacts, and variations in melanin absorption.
- **System Safeguards:** The system explicitly tags all camera-derived pulse readings with `measurement_source: "experimental_webcam_rppg"`, displays prominent amber research warnings, and forbids clinicians from basing acute decisions on rPPG telemetry.

---

## 3. Cybersecurity and Data Protection Architecture

MediCare AI incorporates defense-in-depth principles across all architectural tiers:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DEFENSE-IN-DEPTH ARCHITECTURE                          │
├────────────────────┬────────────────────────────────────────────────────────────┤
│ Network Edge       │ TLS 1.3 encryption, automatic HTTPS redirection, HSTS      │
├────────────────────┼────────────────────────────────────────────────────────────┤
│ Application Layer  │ Dual-token JWT (30m access, 7d refresh), role route guards │
├────────────────────┼────────────────────────────────────────────────────────────┤
│ Document Gateway   │ Binary magic-byte verification (%PDF-, PNG, JPEG), 10MB cap│
├────────────────────┼────────────────────────────────────────────────────────────┤
│ AI Input Filter    │ Anti-prompt-injection regex sanitization, control-char strip│
├────────────────────┼────────────────────────────────────────────────────────────┤
│ Data Persistence   │ Scoped tenant isolation, Argon2id/bcrypt passwords (cost 12│
├────────────────────┼────────────────────────────────────────────────────────────┤
│ Governance Layer   │ Immutable, append-only HIPAA-aligned audit trail           │
└────────────────────┴────────────────────────────────────────────────────────────┘
```

### A. Anti-Prompt-Injection Safeguards
Uploaded documents (such as PDF prescriptions or image scans) could contain malicious text designed to hijack the language model's behavior (Indirect Prompt Injection). To mitigate this vulnerability:
1. All extracted text is sanitized before being concatenated into AI prompt templates.
2. The pipeline scans for adversarial patterns (`ignore previous instructions`, `system: override`, `you are now a`, `act as DAN`, `reveal prompt`).
3. Matched injection sequences are replaced with `[REDACTED_INJECTION_PATTERN]`.
4. High-risk control characters and escape sequences are stripped using regex filters.

### B. File Upload Verification
Attackers frequently attempt to upload executable payloads masked with double extensions (e.g., `report.pdf.exe`). MediCare AI strictly verifies the binary file signature (Magic Bytes) in memory:
- **PDF Documents:** Must begin with `b"%PDF-"`.
- **PNG Images:** Must begin with `b"\x89PNG\r\n\x1a\n"`.
- **JPEG Images:** Must begin with `b"\xff\xd8\xff"`.
Files failing binary inspection are immediately rejected with HTTP 400 before disk persistence.

### C. HIPAA Alignment vs Certification
- **Aligned Controls:** The system implements technical safeguards specified under HIPAA Security Rule (45 CFR § 164.312), including Unique User Identification (§ 164.312(a)(2)(i)), Automatic Logoff (§ 164.312(a)(2)(iii)), Transmission Security via TLS 1.3 (§ 164.312(e)(1)), and Audit Controls (§ 164.312(b)).
- **Certification Boundary:** A software codebase itself cannot be "HIPAA certified." Compliance requires the entire operational environment (covered entity policies, Business Associate Agreements [BAAs] with hosting providers, physical access controls, and administrative training) to be audited and maintained.

---

## 4. Current Limitations & Known Boundaries

| Domain | Current Limitation | Mitigation in MediCare AI |
| :--- | :--- | :--- |
| **OCR Quality** | Low-resolution phone photos with severe glare or folds can cause character misrecognition in drug dosage numbers. | System warns patient to verify extracted numbers against the physical container label before saving. |
| **EHR Interoperability** | The platform does not currently connect directly to Epic or Cerner via live HL7 FHIR feeds. | Data import/export is handled via structured JSON and standard clinical CSV formats. |
| **Offline Telemetry** | Full AI document processing requires connectivity to the cloud backend. | The application caches core views and includes an offline clinical reasoning fallback engine. |
| **Bluetooth Hardware** | Web Bluetooth requires Chromium-based desktop browsers or Android; iOS Safari does not support the Web Bluetooth API. | Manual entry options are always provided as the primary, universally accessible logging pathway. |
