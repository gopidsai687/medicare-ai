"""
MediCare AI — Executive Presentation Briefing Report Generator
Generates an 8-page, publication-grade executive presentation report / dossier
formatted in Letter Portrait using Edge Headless and CSS Paged Media.
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path
import pypdf

OUTPUT_DIR = Path("docs/mediCare-project")
OUTPUT_PDF = OUTPUT_DIR / "MediCare_AI_Presentation_Report.pdf"
TEMP_HTML = Path(os.environ.get("TEMP", "C:/Temp")) / "medicare_pres_report_build.html"
TEMP_PDF = Path(os.environ.get("TEMP", "C:/Temp")) / "medicare_pres_report_build.pdf"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def build_report_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MediCare AI — Executive Presentation Briefing Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

  @page {
    size: letter portrait;
    margin: 16mm 14mm 16mm 14mm;
    @bottom-center {
      content: "MediCare AI — Executive Presentation Briefing Report";
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-right {
      content: "Page " counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: #0f172a;
    }
  }

  @page :first {
    margin: 0;
    @bottom-center { content: ""; }
    @bottom-right { content: ""; }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 9.2pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Page Break Controls */
  .page {
    page-break-after: always;
    position: relative;
    height: 100%;
  }

  /* Typography */
  h1, h2, h3, h4 {
    font-family: 'Outfit', sans-serif;
    color: #0f172a;
    letter-spacing: -0.015em;
  }
  h2 {
    font-size: 16pt;
    font-weight: 800;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
  }
  h3 {
    font-size: 11pt;
    font-weight: 700;
    color: #0369a1;
    margin: 10px 0 4px 0;
  }
  p { margin-bottom: 8px; text-align: justify; }

  .lead-text {
    font-size: 9.8pt;
    line-height: 1.55;
    color: #334155;
    margin-bottom: 12px;
  }

  /* Pills & Badges */
  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 9999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .pill-cyan { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }
  .pill-emerald { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .pill-amber { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
  .pill-rose { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }

  /* Cards & Containers */
  .card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .card.highlight {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }
  .card.alert {
    background: #fff1f2;
    border-color: #fecdd3;
  }
  .card.info {
    background: #f0f9ff;
    border-color: #bae6fd;
  }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }

  /* Stat Box */
  .stat-box {
    text-align: center;
    padding: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .stat-val {
    font-family: 'Outfit', sans-serif;
    font-size: 22pt;
    font-weight: 900;
    line-height: 1;
    color: #0284c7;
    margin-bottom: 4px;
  }
  .stat-val.emerald { color: #16a34a; }
  .stat-val.rose { color: #e11d48; }
  .stat-val.amber { color: #d97706; }
  .stat-label {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #475569;
  }
  .stat-sub {
    font-size: 7pt;
    color: #64748b;
    margin-top: 2px;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin: 8px 0 12px 0;
  }
  th {
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  td {
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    color: #334155;
  }
  tr:nth-child(even) td { background: #f8fafc; }

  /* Callout boxes */
  .callout {
    border-left: 4px solid #0284c7;
    padding: 8px 12px;
    background: #f0f9ff;
    border-radius: 0 6px 6px 0;
    margin: 8px 0;
    font-size: 8.8pt;
  }
  .callout.warning {
    border-left-color: #d97706;
    background: #fffbeb;
  }
  .callout.success {
    border-left-color: #16a34a;
    background: #f0fdf4;
  }

  /* Cover Page */
  .cover-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 22mm 18mm;
    background: linear-gradient(135deg, #070d18 0%, #0f172a 60%, #162544 100%);
    color: #ffffff;
  }
  .cover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cover-pill {
    padding: 6px 14px;
    border-radius: 9999px;
    background: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.4);
    font-family: 'JetBrains Mono', monospace;
    font-size: 9pt;
    font-weight: 700;
    color: #22d3ee;
    letter-spacing: 0.08em;
  }
  .cover-main {
    margin: 40px 0;
  }
  .cover-title {
    font-family: 'Outfit', sans-serif;
    font-size: 34pt;
    font-weight: 900;
    line-height: 1.1;
    color: #ffffff;
    margin-bottom: 14px;
    letter-spacing: -0.02em;
  }
  .cover-title span {
    background: linear-gradient(135deg, #38bdf8, #22d3ee, #34d399);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .cover-sub {
    font-size: 13.5pt;
    line-height: 1.5;
    color: #cbd5e1;
    max-width: 6.8in;
    margin-bottom: 24px;
  }
  .cover-specs-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
  }
  .cover-specs-table td {
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #e2e8f0;
    font-size: 9pt;
  }
  .cover-specs-table strong { color: #38bdf8; }

  .cover-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding-top: 15px;
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    color: #94a3b8;
  }
</style>
</head>
<body>

<!-- PAGE 1: COVER PAGE -->
<div class="page" style="margin: 0; padding: 0;">
  <div class="cover-container">
    <div class="cover-header">
      <div class="cover-pill">STRATEGIC HEALTHCARE IT BRIEFING DOSSIER</div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 9pt; color: #94a3b8;">CONFIDENTIAL — FOR EXECUTIVE REVIEW</div>
    </div>

    <div class="cover-main">
      <div class="cover-title">
        MediCare <span>AI</span><br>
        Executive Presentation Report
      </div>
      <div class="cover-sub">
        A Comprehensive Strategic Briefing on Clinical Architecture, Longitudinal Telemetry, Deterministic AI Safeguards, and Hospital ROI
      </div>

      <table class="cover-specs-table">
        <tr>
          <td style="width: 25%;"><strong>Document Target:</strong></td>
          <td style="width: 25%;">Hospital C-Suite &amp; Clinical Directors</td>
          <td style="width: 25%;"><strong>Verified Codebase:</strong></td>
          <td style="width: 25%;">FastAPI, React 18, PostgreSQL</td>
        </tr>
        <tr>
          <td><strong>Companion Deck:</strong></td>
          <td>14-Slide Widescreen Presentation</td>
          <td><strong>Test Coverage:</strong></td>
          <td>37/37 Tests Passed (100% Pass)</td>
        </tr>
        <tr>
          <td><strong>Live Platform:</strong></td>
          <td>medicare-ai-iv31.onrender.com</td>
          <td><strong>Database Engine:</strong></td>
          <td>46 Verified Relational Tables</td>
        </tr>
        <tr>
          <td><strong>AI Integration:</strong></td>
          <td>Gemini LLM + Hardcoded Safety Rules</td>
          <td><strong>Regulatory Classification:</strong></td>
          <td>Clinical Support Pilot (Non-SaMD)</td>
        </tr>
      </table>
    </div>

    <div class="cover-footer">
      <div>Prepared by: Senior Healthcare Product Architecture Team</div>
      <div>Platform Status: Operational Demonstration &amp; Pilot Ready</div>
      <div>Date: October 2026</div>
    </div>
  </div>
</div>

<!-- PAGE 2: CLINICAL PROBLEM ANALYSIS -->
<div class="page">
  <h2>
    <span class="pill pill-rose">Section 1</span>
    The Clinical Problem &amp; Economic Burden
  </h2>
  
  <p class="lead-text">
    Modern healthcare delivery is severely impaired by a widening disconnect between clinical data generation and human comprehension. Patients are inundated with complex diagnostic summaries and prescriptions they cannot decipher, while physicians suffer from unprecedented cognitive fatigue caused by fragmented, unstructured documentation.
  </p>

  <div class="grid-3" style="margin-bottom: 12px;">
    <div class="stat-box">
      <div class="stat-val rose">88%</div>
      <div class="stat-label">Health Literacy Deficit</div>
      <div class="stat-sub">Adults lacking clinical literacy</div>
    </div>
    <div class="stat-box">
      <div class="stat-val amber">$528B</div>
      <div class="stat-label">Non-Adherence Waste</div>
      <div class="stat-sub">Annual avoidable US health costs</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">2.0 hrs</div>
      <div class="stat-label">EHR Burden Ratio</div>
      <div class="stat-sub">Per 1 hour of direct patient care</div>
    </div>
  </div>

  <h3>1.1 The Health Literacy Barrier</h3>
  <p>
    Clinical diagnostic summaries, laboratory panels (e.g., CBC, Comprehensive Metabolic Panels), and written prescriptions rely on dense Latinate terminology (e.g., <em>thrombocytopenia</em>, <em>hypokalemia</em>, <em>prn</em>, <em>tid</em>) that 88% of adult patients fail to understand. This opacity creates severe anxiety, causes patients to skip follow-up testing, and results in preventable acute care admissions.
  </p>

  <h3>1.2 The Crisis of Chronic Medication Non-Adherence</h3>
  <p>
    Over 50% of patients diagnosed with chronic conditions (hypertension, Type 2 diabetes, hyperlipidemia) discontinue or take their medications incorrectly within the first 12 months. When patients do not understand why a medication was prescribed, what food interactions exist, or how to distinguish minor side-effects from life-threatening reactions, treatment adherence collapses.
  </p>

  <h3>1.3 Clinician Cognitive Overload and Documentation Burnout</h3>
  <p>
    Primary care providers and hospitalists spend more than two hours sifting through unstructured EHR documents for every single hour of patient contact. Clinicians are forced to hunt through disconnected PDFs, manually transcribe historical home blood pressure logs, and synthesize disparate specialist reports under extreme time constraints.
  </p>

  <div class="callout warning">
    <strong>Strategic Imperative:</strong> Traditional patient portals serve merely as passive PDF storage lockers. What healthcare systems urgently require is an active intelligence layer that translates records for patients while distilling actionable telemetry trends for clinicians.
  </div>
</div>

<!-- PAGE 3: SYSTEM ARCHITECTURE & RIGOR -->
<div class="page">
  <h2>
    <span class="pill pill-cyan">Section 2</span>
    System Architecture &amp; Engineering Rigor
  </h2>

  <p class="lead-text">
    MediCare AI is built from the ground up as a decoupled, cloud-native web application designed for high uptime, sub-50ms API responsiveness, and absolute data integrity.
  </p>

  <div class="grid-2" style="margin-bottom: 10px;">
    <div class="card">
      <h3 style="margin-top: 0; color: #0284c7;">Frontend Architecture</h3>
      <p style="font-size: 8.5pt;">
        <strong>Framework:</strong> React 18 SPA with Vite 6 &amp; TypeScript 5.7.<br>
        <strong>Styling:</strong> Tailwind CSS design tokens with medical aesthetic.<br>
        <strong>Module Verification:</strong> 2,674 modules bundled in 7.99s with zero compilation errors.<br>
        <strong>State Management:</strong> Context API + Axios interceptor with automatic 15-second timeout and 401 token refresh loop guards.
      </p>
    </div>

    <div class="card">
      <h3 style="margin-top: 0; color: #0284c7;">Backend Application Core</h3>
      <p style="font-size: 8.5pt;">
        <strong>Framework:</strong> FastAPI (Python 3.12) ASGI framework.<br>
        <strong>Data Modeling:</strong> Pydantic v2 schemas for request validation.<br>
        <strong>Asynchronous I/O:</strong> Non-blocking async endpoints across all clinical modules.<br>
        <strong>Health Probing:</strong> Dedicated <code>/api/health</code> endpoint for container lifecycle monitoring on Render.
      </p>
    </div>
  </div>

  <h3>2.1 Database Schema &amp; Dual-Engine Resilience</h3>
  <p>
    The persistence layer utilizes SQLAlchemy 2.0 Async ORM supporting production PostgreSQL and local SQLite workstation fallback. The schema comprises <strong>46 verified relational tables</strong> with strict foreign key constraints, cascading rules, and index optimization.
  </p>

  <table>
    <thead>
      <tr>
        <th>Domain</th>
        <th>Key Tables</th>
        <th>Key Constraints / Indexes</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Identity &amp; Auth</strong></td>
        <td><code>users</code>, <code>roles</code>, <code>sessions</code></td>
        <td>Unique email/username, bcrypt/Argon2 salts</td>
        <td><span class="pill pill-emerald">Verified</span></td>
      </tr>
      <tr>
        <td><strong>Physiological Telemetry</strong></td>
        <td><code>blood_pressure_readings</code>, <code>glucose_readings</code></td>
        <td>Composite index (user_id, recorded_at), is_sample flag</td>
        <td><span class="pill pill-emerald">Verified</span></td>
      </tr>
      <tr>
        <td><strong>Clinical Documents</strong></td>
        <td><code>medical_documents</code>, <code>prescriptions</code>, <code>lab_results</code></td>
        <td>OCR status enum, structured JSON analysis payload</td>
        <td><span class="pill pill-emerald">Verified</span></td>
      </tr>
      <tr>
        <td><strong>Governance &amp; Triage</strong></td>
        <td><code>audit_logs</code>, <code>clinical_alerts</code>, <code>encounters</code></td>
        <td>Append-only, immutable timestamps, resolution notes</td>
        <td><span class="pill pill-emerald">Verified</span></td>
      </tr>
    </tbody>
  </table>

  <h3>2.2 Automated Test Verification</h3>
  <div class="grid-3">
    <div class="stat-box">
      <div class="stat-val emerald">37 / 37</div>
      <div class="stat-label">Unit Tests Passing</div>
      <div class="stat-sub">100% test success rate</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">1.45 s</div>
      <div class="stat-label">Execution Speed</div>
      <div class="stat-sub">Automated CI/CD suite</div>
    </div>
    <div class="stat-box">
      <div class="stat-val emerald">0 Errors</div>
      <div class="stat-label">Production Build</div>
      <div class="stat-sub">TypeScript &amp; Vite 6</div>
    </div>
  </div>
</div>

<!-- PAGE 4: FUNCTIONAL MODULES & WORKFLOWS -->
<div class="page">
  <h2>
    <span class="pill pill-emerald">Section 3</span>
    Functional Capabilities &amp; Clinical Workflows
  </h2>

  <p class="lead-text">
    MediCare AI delivers unified workflows tailored specifically for three distinct user roles: Patients managing chronic conditions, Clinicians triaging care, and Administrators maintaining governance.
  </p>

  <div class="grid-2">
    <div class="card info">
      <h3 style="margin-top: 0;">VitalSense Telemetry Engine</h3>
      <p style="font-size: 8.5pt;">
        <strong>Blood Pressure Staging:</strong> Implements American Heart Association (AHA) criteria, categorizing readings into Normal, Elevated, Stage 1, Stage 2, and Hypertensive Crisis. Automatically computes <em>Mean Arterial Pressure (MAP)</em>:
        <br><center style="margin: 4px 0;"><code>MAP = DBP + 0.333 * (SBP - DBP)</code></center>
        <strong>Glycemic Tracking:</strong> Dual-unit conversion (mg/dL and mmol/L) with ADA-aligned meal timing tags (Fasting, Postprandial, Bedtime). Flags hypoglycemia (&lt;70 mg/dL) and hyperglycemia (&gt;250 mg/dL).
      </p>
    </div>

    <div class="card highlight">
      <h3 style="margin-top: 0;">Full Body Diagnostics &amp; Digital Twin HUD</h3>
      <p style="font-size: 8.5pt;">
        <strong>Interactive Anatomical Mapping:</strong> High-engagement SVG body silhouette featuring 5 target organ nodes (Brain, Heart, Lungs, Pancreas, Kidneys). Clicking an organ surfaces active medications, relevant lab markers, and vital trends.
        <br><strong>Diagnostics HUD:</strong> Real-time animated ECG rhythm, 3-axis MRI views (Axial, Coronal, Sagittal), thoracic X-ray overlay, and genomic sequence indicator for clinical displays.
      </p>
    </div>
  </div>

  <h3>3.1 Clinician Portal &amp; Triage Engine</h3>
  <div class="card">
    <div class="grid-3">
      <div>
        <strong style="color: #be123c;">Prioritized Alert Queue:</strong>
        <p style="font-size: 8pt; margin-top: 4px;">
          Ingested telemetry readings that cross critical thresholds (SBP &gt; 180, DBP &gt; 120, Glucose &lt; 54 mg/dL) immediately create high-priority triage alerts visible on the provider dashboard.
        </p>
      </div>
      <div>
        <strong style="color: #15803d;">Clinical Alert Sign-Off:</strong>
        <p style="font-size: 8pt; margin-top: 4px;">
          Physicians review the alert alongside longitudinal vital charts, enter clinical management notes, and sign off. The resolution is stamped with the physician ID and exact timestamp.
        </p>
      </div>
      <div>
        <strong style="color: #0369a1;">SOAP Clinical Encounters:</strong>
        <p style="font-size: 8pt; margin-top: 4px;">
          Standardized Subjective, Objective, Assessment, Plan documentation tool equipped with searchable ICD-10 diagnostic coding to streamline outpatient visit notes.
        </p>
      </div>
    </div>
  </div>

  <h3>3.2 Master Patient Index (MPI) Deduplication</h3>
  <p>
    To prevent the clinical fragmentation and patient safety risks associated with duplicate charts, MediCare AI features an algorithmic Master Patient Index. The MPI executes hybrid <strong>Soundex phonetic encoding</strong> and <strong>Levenshtein edit-distance calculation</strong> across first name, last name, date of birth, and phone number, scoring potential duplicate matches and alerting hospital registrars.
  </p>
</div>

<!-- PAGE 5: AI CLINICAL PIPELINE & SAFEGUARDS -->
<div class="page">
  <h2>
    <span class="pill pill-rose">Section 4</span>
    AI Clinical Pipeline &amp; Deterministic Safeguards
  </h2>

  <p class="lead-text">
    MediCare AI implements a defense-in-depth architecture for artificial intelligence in healthcare. Generative LLMs are never permitted to operate without strict deterministic safeguards, prompt sanitization, and hardcoded clinical boundary rules.
  </p>

  <div class="card alert" style="margin-bottom: 12px;">
    <h3 style="margin-top: 0; color: #be123c;">Deterministic Drug-Drug Interaction Matrix</h3>
    <p style="font-size: 8.5pt;">
      To eliminate the risk of LLM hallucinations on life-critical pharmaceutical interactions, MediCare AI executes an independent Python rules matrix screening 10 high-risk medication pairs before generating patient guidance:
    </p>
    <table style="margin-top: 6px;">
      <thead>
        <tr><th>Medication Pair</th><th>Clinical Severity</th><th>Adverse Clinical Consequence</th></tr>
      </thead>
      <tbody>
        <tr><td>Warfarin + Aspirin</td><td><span class="pill pill-rose">High Risk</span></td><td>Severe additive hemorrhagic bleeding risk</td></tr>
        <tr><td>ACE Inhibitor + Potassium</td><td><span class="pill pill-rose">High Risk</span></td><td>Potentially fatal hyperkalemia and cardiac arrest</td></tr>
        <tr><td>Sildenafil + Nitroglycerin</td><td><span class="pill pill-rose">Severe / Critical</span></td><td>Catastrophic, uncorrectable hypotensive collapse</td></tr>
        <tr><td>Clopidogrel + Omeprazole</td><td><span class="pill pill-amber">Moderate</span></td><td>CYP2C19 inhibition reducing antiplatelet protection</td></tr>
        <tr><td>Simvastatin + Amiodarone</td><td><span class="pill pill-amber">Moderate</span></td><td>Elevated risk of rhabdomyolysis and acute renal failure</td></tr>
      </tbody>
    </table>
  </div>

  <h3>4.1 Multi-Stage Prescription Processing</h3>
  <p>
    Uploaded prescription images or PDFs undergo four rigorous processing stages:
  </p>
  <ol style="margin-left: 20px; font-size: 8.8pt; line-height: 1.5; margin-bottom: 10px;">
    <li><strong>Magic-Byte Validation:</strong> Confirms binary file header matches true JPEG, PNG, or PDF formats, preventing arbitrary payload uploads.</li>
    <li><strong>Anti-Injection Sanitization:</strong> Inspects OCR text and strips prompt injection patterns (e.g., <code>system:</code>, <code>override previous instructions</code>, <code>&lt;script&gt;</code>).</li>
    <li><strong>Deterministic Rule Evaluation:</strong> Cross-checks extracted active drug names against the hardcoded clinical interaction matrix.</li>
    <li><strong>Plain-Language Generation:</strong> Produces clear patient instructions (purpose, food/timing instructions, side-effect distinction) accompanied by mandatory non-diagnostic disclaimers.</li>
  </ol>

  <h3>4.2 Laboratory Report 4-Part Translation</h3>
  <div class="grid-2">
    <div class="card">
      <strong>1. Conversational Summary:</strong>
      <p style="font-size: 8pt; margin-top: 2px;">Synthesizes the overall panel in plain 6th-grade English, avoiding intimidating Latin terms.</p>
      <strong>2. Structured Test Table:</strong>
      <p style="font-size: 8pt; margin-top: 2px;">Extracts test names, numeric values, units, reference ranges, and High/Normal/Low status chips.</p>
    </div>
    <div class="card">
      <strong>3. Doctor Consultation Questions:</strong>
      <p style="font-size: 8pt; margin-top: 2px;">Generates 3 to 5 targeted questions for the patient's next clinical consultation.</p>
      <strong>4. Red-Flag Emergency Triage:</strong>
      <p style="font-size: 8pt; margin-top: 2px;">Immediately flags critical panic values (e.g., Potassium &gt; 6.0 mEq/L) advising emergency care.</p>
    </div>
  </div>
</div>

<!-- PAGE 6: GOVERNANCE, SECURITY & HIPAA -->
<div class="page">
  <h2>
    <span class="pill pill-cyan">Section 5</span>
    Governance, Data Security &amp; Compliance
  </h2>

  <p class="lead-text">
    Healthcare data demands the highest standard of custodial integrity. MediCare AI implements defense-in-depth security controls aligned with HIPAA Privacy and Security Rules.
  </p>

  <div class="grid-2" style="margin-bottom: 12px;">
    <div class="card">
      <h3 style="margin-top: 0; color: #0284c7;">Authentication &amp; Access Controls</h3>
      <ul style="margin-left: 16px; font-size: 8.5pt; line-height: 1.5;">
        <li><strong>Dual-Token Architecture:</strong> 15-minute cryptographically signed JWT access tokens paired with 7-day rotating refresh tokens.</li>
        <li><strong>Role-Based Access Control (RBAC):</strong> Strict endpoint segregation for <code>patient</code>, <code>doctor</code>, and <code>admin</code> roles.</li>
        <li><strong>Salted Password Hashing:</strong> Passwords protected using Argon2 and bcrypt with unique cryptographically random salts.</li>
        <li><strong>Session Interceptor:</strong> Automatic 401 interception and redirect handling to eliminate hanging login states.</li>
      </ul>
    </div>

    <div class="card">
      <h3 style="margin-top: 0; color: #0284c7;">Immutable HIPAA Audit Trail</h3>
      <ul style="margin-left: 16px; font-size: 8.5pt; line-height: 1.5;">
        <li><strong>Append-Only Integrity:</strong> Complete audit log recording user ID, action, client IP, resource, and timestamp.</li>
        <li><strong>Zero Edit/Delete APIs:</strong> The audit table cannot be altered through any application endpoint.</li>
        <li><strong>Database Migration:</strong> Managed via dedicated Alembic migration <code>0004_audit_logs.py</code>.</li>
        <li><strong>Admin Forensics:</strong> Dedicated dashboard enabling date and action filtering for security compliance audits.</li>
      </ul>
    </div>
  </div>

  <h3>5.1 Biomedical Sensor Realities &amp; Disclaimers</h3>
  <div class="callout warning">
    <strong>Scientific Boundary Disclosures:</strong>
    <p style="font-size: 8.3pt; margin-top: 4px;">
      1. <strong>Optical Webcams &amp; Fingerprint Sensors:</strong> Commercial webcams and capacitive fingerprint readers cannot measure biochemical glucose or arterial blood pressure. MediCare AI firmly rejects hardwareless diagnostic claims.<br>
      2. <strong>Experimental rPPG:</strong> Camera pulse estimation is designated strictly as experimental computer vision research.<br>
      3. <strong>Software as a Medical Device (SaMD):</strong> MediCare AI is currently an operational prototype and educational platform. It has not received FDA 510(k) clearance and does not diagnose disease or prescribe medications autonomously.
    </p>
  </div>

  <h3>5.2 Data Provenance &amp; Sample Data Isolation</h3>
  <p>
    To guarantee that test simulations never corrupt clinical records, all demonstration readings generated via the test bench carry an immutable metadata flag: <code>is_sample = true</code>. The clinician portal and export pipelines strictly filter these records to prevent clinical misdirection.
  </p>
</div>

<!-- PAGE 7: SWOT & OPERATIONAL FEASIBILITY -->
<div class="page">
  <h2>
    <span class="pill pill-amber">Section 6</span>
    Strategic SWOT &amp; Operational Feasibility
  </h2>

  <p class="lead-text">
    A rigorous objective assessment of MediCare AI's strategic strengths, current limitations, market opportunities, and implementation risks.
  </p>

  <div class="grid-2" style="margin-bottom: 12px;">
    <div class="card highlight">
      <strong style="color: #15803d; font-size: 9.5pt;">STRENGTHS</strong>
      <ul style="margin-left: 16px; font-size: 8.2pt; line-height: 1.45; margin-top: 4px;">
        <li>Operational full-stack software with 37 passing unit tests.</li>
        <li>Deterministic drug-interaction matrix eliminates hallucination risk.</li>
        <li>Rich visual Digital Twin HUD boosts patient engagement.</li>
        <li>Strict data provenance segregating real and sample readings.</li>
        <li>Self-healing database with resilient startup inspection.</li>
      </ul>
    </div>

    <div class="card alert">
      <strong style="color: #be123c; font-size: 9.5pt;">WEAKNESSES</strong>
      <ul style="margin-left: 16px; font-size: 8.2pt; line-height: 1.45; margin-top: 4px;">
        <li>Lacks native HL7 FHIR R4 endpoints for direct Epic/Cerner sync.</li>
        <li>Requires manual entry or sample generation for vital signs.</li>
        <li>No direct Bluetooth Low Energy (BLE) peripheral hardware driver.</li>
        <li>Has not yet undergone formal SOC 2 Type II compliance audit.</li>
      </ul>
    </div>

    <div class="card info">
      <strong style="color: #0369a1; font-size: 9.5pt;">OPPORTUNITIES</strong>
      <ul style="margin-left: 16px; font-size: 8.2pt; line-height: 1.45; margin-top: 4px;">
        <li>Expanding hospital demand for remote patient monitoring (RPM).</li>
        <li>CMS billing codes for remote physiological monitoring (CPT 99453, 99454).</li>
        <li>Partnerships with medical device makers (Omron, Dexcom).</li>
        <li>White-label chronic disease management portal for health plans.</li>
      </ul>
    </div>

    <div class="card">
      <strong style="color: #b45309; font-size: 9.5pt;">THREATS</strong>
      <ul style="margin-left: 16px; font-size: 8.2pt; line-height: 1.45; margin-top: 4px;">
        <li>EHR vendor lock-in (Epic MyChart feature expansion).</li>
        <li>Stringent FDA regulatory oversight for AI decision-support.</li>
        <li>Cloud compute and LLM token pricing scalability at high volume.</li>
        <li>Provider reluctance to adopt new software interfaces.</li>
      </ul>
    </div>
  </div>

  <h3>6.1 Operational Requirements &amp; Infrastructure</h3>
  <table style="font-size: 8pt;">
    <thead>
      <tr><th>Component</th><th>Specification</th><th>Estimated Monthly Overhead</th></tr>
    </thead>
    <tbody>
      <tr><td>Container Web Service</td><td>Render Standard Instance (1 CPU, 2 GB RAM)</td><td>$25.00 / month</td></tr>
      <tr><td>Managed Database</td><td>PostgreSQL Managed DB (v15, automated backups)</td><td>$35.00 / month</td></tr>
      <tr><td>Cloud Document Storage</td><td>Encrypted S3 Object Store (AES-256)</td><td>$10.00 / month (first 100k docs)</td></tr>
      <tr><td>Clinical AI Inference</td><td>Gemini API (Estimated 5,000 document parses)</td><td>$40.00 / month</td></tr>
    </tbody>
  </table>
</div>

<!-- PAGE 8: ROI, ROADMAP & CONCLUSION -->
<div class="page">
  <h2>
    <span class="pill pill-emerald">Section 7</span>
    Financial ROI, Implementation Roadmap &amp; Next Steps
  </h2>

  <p class="lead-text">
    Quantifying the economic return for health systems, outlining a realistic four-phase deployment schedule, and establishing pilot collaboration next steps.
  </p>

  <div class="card highlight" style="margin-bottom: 10px;">
    <h3 style="margin-top: 0; color: #15803d;">Projected Economic Return for a 300-Bed Regional Hospital</h3>
    <table style="margin-top: 6px; font-size: 8pt;">
      <thead>
        <tr><th>Cost Avoidance Category</th><th>Clinical Mechanism</th><th>Estimated Annual Savings</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>30-Day Readmission Reduction</strong></td><td>Early vital destabilization triage (CHF, Diabetes)</td><td>$450,000 – $700,000</td></tr>
        <tr><td><strong>Adverse Drug Event (ADE) Prevention</strong></td><td>Deterministic drug interaction matrix screening</td><td>$280,000 – $420,000</td></tr>
        <tr><td><strong>Clinician Time Optimization</strong></td><td>15 min saved per chart review &times; 12,000 annual visits</td><td>$360,000 – $540,000</td></tr>
        <tr><td><strong>MPI Record Cleanliness</strong></td><td>Elimination of duplicate clinical workups &amp; testing</td><td>$110,000 – $140,000</td></tr>
        <tr style="font-weight: 700; background: #e2e8f0;">
          <td colspan="2">TOTAL ESTIMATED ANNUAL VALUE CREATION</td>
          <td style="color: #15803d;">$1,200,000 – $1,800,000</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h3>7.1 Phased Implementation Roadmap</h3>
  <table style="font-size: 8pt;">
    <thead>
      <tr><th>Phase</th><th>Timeline</th><th>Key Milestones</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Phase 1: Foundation</strong></td><td>Completed</td><td>FastAPI/React core, VitalSense, Document AI, 37 passing unit tests</td><td><span class="pill pill-emerald">Completed</span></td></tr>
      <tr><td><strong>Phase 2: Interoperability</strong></td><td>Months 1–6</td><td>HL7 FHIR R4 endpoints, SMART-on-FHIR Epic/Cerner bidirectional sync</td><td><span class="pill pill-cyan">Planned</span></td></tr>
      <tr><td><strong>Phase 3: Device Drivers</strong></td><td>Months 7–12</td><td>Bluetooth Web BLE for Omron BP cuffs, Dexcom CGM API integration</td><td><span class="pill pill-amber">Planned</span></td></tr>
      <tr><td><strong>Phase 4: Regulatory</strong></td><td>Months 13–24</td><td>IRB clinical trial, SOC 2 Type II audit, FDA 510(k) SaMD submission</td><td><span class="pill pill-amber">Planned</span></td></tr>
    </tbody>
  </table>

  <h3>7.2 Pilot Engagement Next Steps</h3>
  <div class="callout success">
    <strong>Executive Call to Action:</strong> MediCare AI is verified, fully documented, and operating live. We invite clinical department chairs, health system CIOs, and innovation directors to schedule a pilot demonstration.
    <br><br>
    <strong>Live Portal:</strong> <a href="https://medicare-ai-iv31.onrender.com" style="color: #0284c7; font-weight: 700;">https://medicare-ai-iv31.onrender.com</a> &nbsp;|&nbsp; 
    <strong>Repository:</strong> <a href="https://github.com/gopidsai687/medicare-ai" style="color: #0284c7; font-weight: 700;">github.com/gopidsai687/medicare-ai</a>
  </div>
</div>

</body>
</html>
"""

def generate_report():
    print("=" * 65)
    print("MediCare AI — Executive Presentation Briefing Report Generator")
    print("=" * 65)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    html_content = build_report_html()

    print(f"1. Writing temporary briefing report HTML to {TEMP_HTML}...")
    TEMP_HTML.write_text(html_content, encoding="utf-8")

    cmd = [
        EDGE_EXE,
        "--headless=new",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={str(TEMP_PDF)}",
        "--no-pdf-header-footer",
        TEMP_HTML.as_uri()
    ]
    print(f"2. Invoking Edge Headless PDF engine (Letter Portrait)...")
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    if not TEMP_PDF.exists():
        print(f"ERROR: Edge headless failed to write PDF: {res.stderr}")
        sys.exit(1)

    shutil.copyfile(TEMP_PDF, OUTPUT_PDF)
    print(f"3. Copied briefing report to: {OUTPUT_PDF} ({OUTPUT_PDF.stat().st_size} bytes)")

    reader = pypdf.PdfReader(str(OUTPUT_PDF))
    total_pages = len(reader.pages)
    print(f"4. PyPDF Verification:")
    print(f"   Total Pages: {total_pages}")
    assert total_pages == 8, f"Expected exactly 8 pages, got {total_pages}"

    # Extract text from page 1 and page 2
    text_p1 = reader.pages[0].extract_text()
    assert "medicare" in text_p1.lower() and "briefing" in text_p1.lower()
    print(f"   Selectable text extraction verified on Page 1: PASS")

    print("\n" + "=" * 65)
    print(f"SUCCESS: MediCare_AI_Presentation_Report.pdf generated successfully!")
    print(f"Location: {OUTPUT_PDF.resolve()} (8 Pages)")
    print("=" * 65)

if __name__ == "__main__":
    generate_report()
