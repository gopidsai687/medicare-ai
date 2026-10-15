# MediCare AI — 3–5 Minute Live Demonstration Guide

**Document Version:** 1.0.0 Enterprise Preview  
**Live Application URL:** [https://medicare-ai-iv31.onrender.com](https://medicare-ai-iv31.onrender.com)  
**Target Duration:** 3–5 Minutes  
**Audience:** Public, Healthcare Managers, Hospital Administrators, Clinicians, Investors  

---

## 1. Pre-Demonstration Checklist & Credentials

> [!IMPORTANT]
> **Safety & Privacy Rule:** All accounts below are pre-seeded demonstration personas with synthetic test data. Never display real patient personal health information (PHI), personal passwords, or private API keys during a live presentation.

### Verified Test Accounts

| Role | Name / Title | Email Address | Password | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | Alice Johnson | `alice.johnson@medicare.ai` | `PatientPass123!` | Patient portal, digital twin HUD, vital logging, document analysis |
| **Doctor** | Dr. Sarah Chen | `dr.sarah.chen@medicare.ai` | `DoctorPass123!` | Clinician triage, active outlier alert queue, encounter management |
| **Admin** | Hospital Administrator | `admin@medicare.ai` | `AdminPass123!` | Master Patient Index (MPI), HIPAA audit log inspection |

### Pre-Flight Verification (Run 5 Minutes Before Presenting)
1. Open [https://medicare-ai-iv31.onrender.com/api/health](https://medicare-ai-iv31.onrender.com/api/health) in a browser tab to ensure the Render container is warm (`status: "ok"`).
2. Ensure you have two browser windows ready (one regular window, one incognito window) so you can demonstrate the **Patient** and **Doctor** perspectives simultaneously without logging in and out.
3. Have a sample lab report PDF or image ready in your downloads folder (e.g., standard blood panel scan).

---

## 2. Step-by-Step 3–5 Minute Live Demonstration Script

### Step 1: Patient Login & Health Dashboard Overview (45 Seconds)
- **Page to Open:** `https://medicare-ai-iv31.onrender.com/login`
- **Action to Perform:**
  1. Enter `alice.johnson@medicare.ai` and `PatientPass123!`.
  2. Click **Sign In**.
- **What the Audience Should Observe:**
  - Fast, immediate entry into the Patient Dashboard (`/patient`).
  - Welcome banner: *"Welcome back, Alice"*.
  - 4 Summary Stat Cards: Upcoming Appointments (2), Active Medications (4), Recent Lab Results (1), Medical Documents (12).
  - Clean, dark-mode glassmorphism interface with high-contrast accessibility.
- **What You Should Say Aloud:**
  > *"We begin in the Patient Portal as Alice Johnson, a patient managing Type 2 Diabetes and Hypertension. Right away, notice that Alice is not overwhelmed by medical jargon. Her top dashboard immediately shows her upcoming appointments, active prescriptions, and recent lab results in clean, accessible cards."*
- **Dependencies:** Core authentication API, local SQLite / PostgreSQL database.
- **Fallback Plan:** If network latency delays login, point out that our API enforces 15-second deterministic timeouts with automatic retry, avoiding infinite loading loops.

---

### Step 2: Full Body Diagnostics Digital Twin HUD (45 Seconds)
- **Page to Open:** Scroll down on the Patient Dashboard (`/patient`).
- **Action to Perform:**
  1. Hover over the **Interactive Anatomical Body Map**.
  2. Click on the **Cardiovascular Hotspot** (chest area).
  3. Observe the metric overlay showing blood pressure history and Mean Arterial Pressure (MAP).
  4. Click on the **Metabolic Hotspot** (abdominal area) to view glucose readings.
- **What the Audience Should Observe:**
  - Interactive SVG human body with glowing anatomical hotspots.
  - Contextual modal/drawer updating with Alice's specific organ telemetry.
  - Green indicator badges showing stable biometrics, or amber badges showing elevated readings.
- **What You Should Say Aloud:**
  > *"Here is our Human Digital Twin HUD. Instead of forcing patients to read spreadsheets of numbers, we map their physiological telemetry directly onto an interactive anatomical diagram. When Alice clicks her cardiovascular zone, she immediately sees her recent blood pressure and calculated Mean Arterial Pressure. This transforms abstract clinical data into intuitive visual comprehension."*
- **Dependencies:** Client-side React SVG component, cached telemetry records.
- **Fallback Plan:** If clicks do not open a modal immediately, use the direct navigation cards below: **Blood Pressure Tracker** or **Blood Glucose Tracker**.

---

### Step 3: VitalSense Telemetry & Deterministic MAP Calculation (60 Seconds)
- **Page to Open:** Navigate to `/patient/vitalsense/blood-pressure` (or click *Blood Pressure Tracker*).
- **Action to Perform:**
  1. Under *Record New Reading*, input Systolic: `145`, Diastolic: `92`, Heart Rate: `78`.
  2. Select Source: `Manual Home Cuff`.
  3. Click **Submit Reading**.
- **What the Audience Should Observe:**
  - Instant submission with zero page reload.
  - The longitudinal chart updates immediately with the new data point.
  - The calculated **Mean Arterial Pressure (MAP)** appears as `109.7 mmHg`.
  - American Heart Association Category displays as **Hypertension Stage 2** with an amber/red warning badge.
- **What You Should Say Aloud:**
  > *"Now, let's watch how VitalSense handles home telemetry. Alice takes her blood pressure at home with an oscillometric cuff and enters 145 over 92. Notice what happens the instant she clicks submit: our backend deterministically calculates her Mean Arterial Pressure—109.7 millimeters of mercury—and classifies her reading under American Heart Association guidelines as Stage 2 Hypertension. We don't wait for an AI call—this clinical evaluation executes in milliseconds in code."*
- **Dependencies:** `/api/v1/vitals/blood-pressure` endpoint, AHA evaluation logic.
- **Fallback Plan:** If submission fails due to an intermittent network hiccup, refresh the page and point to the existing pre-seeded readings on the chart showing historical MAP curves.

---

### Step 4: Doctor Alert Queue & Clinical Triage (60 Seconds)
- **Page to Open:** In your second (incognito) window, go to `https://medicare-ai-iv31.onrender.com/login`.
- **Action to Perform:**
  1. Sign in as `dr.sarah.chen@medicare.ai` with password `DoctorPass123!`.
  2. Navigate to `/doctor/alerts` (or click **Alert Queue** in the sidebar).
  3. Locate Alice Johnson's newly triggered **Stage 2 HTN Alert** at the top of the queue.
  4. Click **Action Alert**. In the modal, type: *"Reviewed MAP trend. Increasing lisinopril to 20mg daily; follow-up in 2 weeks."*
  5. Click **Resolve Alert**.
- **What the Audience Should Observe:**
  - Dr. Chen's dashboard displays a prioritized, uncluttered queue of patients who actually need attention.
  - Alice's record is marked with an amber **WARNING** badge.
  - The Action Modal captures the clinician's notes.
  - Upon clicking Resolve, the alert smoothly disappears from the active queue and is logged in the permanent audit trail.
- **What You Should Say Aloud:**
  > *"Now let's switch over to the hospital side. Dr. Sarah Chen is an attending cardiologist. Notice that Dr. Chen is not drowning in raw numbers. Because Alice logged a Stage 2 hypertensive reading, Alice immediately surfaces at the top of Dr. Chen's alert queue. Dr. Chen reviews Alice's 30-day MAP trend, enters a dose adjustment note, and resolves the alert. In less than 30 seconds, a dangerous physiological drift was caught, reviewed, and actioned—potentially preventing an emergency room admission."*
- **Dependencies:** Doctor role authorization, `/api/v1/vitals/doctor/alerts` endpoint.
- **Fallback Plan:** If the doctor queue shows pre-existing resolved alerts, filter by 'All Alerts' to show the audit trail of actioned events.

---

### Step 5: Document Intelligence: Medical Report or Prescription Analysis (60 Seconds)
- **Page to Open:** Back in Alice's patient window, navigate to `/patient/reports` (or `/patient/prescriptions`).
- **Action to Perform:**
  1. Click **Upload Lab Report** (or choose *Use Demo Sample*).
  2. Click **Analyze Report**.
  3. Observe the 4-part structured translation:
     - 1. Test Performed (e.g., Comprehensive Metabolic Panel / eGFR).
     - 2. Clinical Meaning (e.g., Kidney filtration rate explanation).
     - 3. Finding Status (e.g., Borderline / Stage 3a Chronic Kidney Disease indicator).
     - 4. Questions to Ask Your Doctor.
  4. Type a follow-up question in the Q&A box: *"Should I avoid ibuprofen with this result?"*
- **What the Audience Should Observe:**
  - Instant text extraction and anti-prompt-injection sanitization.
  - Structured, empathetic plain-English summary.
  - The AI assistant grounds its answer in the document, advising that NSAIDs like ibuprofen can further reduce kidney filtration and strongly recommending consulting Dr. Chen.
- **What You Should Say Aloud:**
  > *"Finally, let's look at clinical document intelligence. Alice uploads a frightening lab report showing a reduced eGFR. Instead of giving her unverified internet search results, MediCare AI translates the report into four clean sections: What test was done, What the finding means, Is it normal, and What questions to ask Dr. Chen. When she asks if she can take ibuprofen, the system explains the risk to renal blood flow and reinforces physician consultation. We empower the patient while protecting the clinical relationship."*
- **Dependencies:** `/api/v1/medical-reports/upload`, embedded 37-term dictionary; Gemini API (if online) or deterministic fallback.
- **Fallback Plan:** If external Gemini API rate limits trigger, explain that our **deterministic rule-based fallback** is actively operating, serving clinical dictionary definitions directly from local memory without missing a beat.

---

## 3. Known Boundaries to Respect During Demonstration

1. **VitalSense Webcam PPG (`/patient/vitalsense/research`):**
   - **Status:** Educational simulation only.
   - **Rule:** Do NOT present the optical camera pulse tracker as a validated clinical diagnostic device. If you show this page, explicitly declare: *"This is a laboratory educational tool demonstrating how optical light absorption corresponds to cardiac cycle pulses; it is not a medical device."*
2. **Passkey Authentication:**
   - **Status:** Intentionally removed across the platform in favor of standard, battle-tested bcrypt/JWT authentication to eliminate browser WebAuthn timeout hangs.
   - **Rule:** Demonstrate standard email/password login.
3. **Simulated vs. Genuine Telemetry:**
   - **Status:** If using the Demo Bench Simulator, remember to click **Reset Demo Data** (`/api/v1/vitals/clear-demo-data`) before logging genuine readings to show the clear separation between synthetic test fixtures and patient records.
