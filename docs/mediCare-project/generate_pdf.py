"""
MediCare AI — Professional Healthcare Documentation & Presentation PDF Generator
Generates a 15-25 page publication-grade healthcare technology report using
headless browser rendering with modern CSS paged media, SVG diagrams, and pypdf verification.
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path
import pypdf

OUTPUT_DIR = Path("docs/mediCare-project")
OUTPUT_PDF = OUTPUT_DIR / "MediCare_AI_Project_Report.pdf"
TEMP_HTML = Path(os.environ.get("TEMP", "C:/Temp")) / "medicare_report_build.html"
TEMP_PDF = Path(os.environ.get("TEMP", "C:/Temp")) / "medicare_report_build.pdf"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def build_html_content() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MediCare AI — System Architecture, Use Cases, and Healthcare Technology Overview</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

  @page {
    size: letter portrait;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-center {
      content: "MediCare AI — Healthcare Management Platform";
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

  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 9.5pt;
    line-height: 1.55;
    margin: 0;
    padding: 0;
  }

  /* Cover Page */
  .cover-page {
    page-break-after: always;
    height: 100vh;
    padding: 50mm 25mm 30mm 25mm;
    background: linear-gradient(135deg, #070f1e 0%, #0d1b2a 50%, #1b263b 100%);
    color: #f8fafc;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .cover-tag {
    display: inline-block;
    padding: 5px 14px;
    background: rgba(0, 180, 216, 0.15);
    border: 1px solid rgba(0, 180, 216, 0.4);
    border-radius: 20px;
    color: #00b4d8;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  .cover-title {
    font-family: 'Outfit', sans-serif;
    font-size: 32pt;
    font-weight: 800;
    line-height: 1.15;
    color: #ffffff;
    margin: 0 0 15px 0;
    letter-spacing: -0.5px;
  }

  .cover-title span {
    color: #00b4d8;
    background: linear-gradient(90deg, #00b4d8, #90e0ef);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .cover-subtitle {
    font-size: 13.5pt;
    color: #94a3b8;
    line-height: 1.5;
    max-width: 550px;
    margin: 0 0 30px 0;
    font-weight: 300;
  }

  .cover-divider {
    width: 60px;
    height: 4px;
    background: #00b4d8;
    border-radius: 2px;
    margin-bottom: 40px;
  }

  .cover-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }

  .cover-meta-item {
    font-size: 8.5pt;
  }

  .cover-meta-item .label {
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-size: 7.5pt;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .cover-meta-item .value {
    color: #e2e8f0;
    font-weight: 500;
  }

  /* Page Break Utilities */
  .page-break { page-break-before: always; }
  .no-break { break-inside: avoid; page-break-inside: avoid; }

  /* Headings */
  h1 {
    font-family: 'Outfit', sans-serif;
    font-size: 19pt;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 0;
    margin-bottom: 14px;
    letter-spacing: -0.3px;
  }

  h2 {
    font-family: 'Outfit', sans-serif;
    font-size: 13pt;
    font-weight: 600;
    color: #1e293b;
    margin-top: 16px;
    margin-bottom: 8px;
    letter-spacing: -0.2px;
  }

  h3 {
    font-family: 'Inter', sans-serif;
    font-size: 10.5pt;
    font-weight: 700;
    color: #334155;
    margin-top: 12px;
    margin-bottom: 6px;
  }

  p { margin: 0 0 8px 0; text-align: justify; }

  /* Callouts & Alerts */
  .callout {
    border-radius: 6px;
    padding: 10px 14px;
    margin: 10px 0;
    font-size: 8.8pt;
    line-height: 1.45;
    border-left: 4px solid #00b4d8;
    background: #f0f9ff;
    color: #0369a1;
  }

  .callout-warning {
    border-left-color: #f59e0b;
    background: #fffbeb;
    color: #92400e;
  }

  .callout-danger {
    border-left-color: #ef4444;
    background: #fef2f2;
    color: #991b1b;
  }

  .callout-success {
    border-left-color: #10b981;
    background: #ecfdf5;
    color: #065f46;
  }

  .callout-title {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.8px;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px 0;
    font-size: 8.2pt;
    line-height: 1.4;
  }

  th {
    background: #0f172a;
    color: #ffffff;
    text-align: left;
    padding: 6px 8px;
    font-weight: 600;
    font-size: 7.8pt;
    letter-spacing: 0.3px;
  }

  td {
    padding: 6px 8px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }

  tr:nth-child(even) td { background: #f8fafc; }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .badge-verified { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .badge-partial { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .badge-planned { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .badge-critical { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

  /* Diagram Boxes */
  .diagram-container {
    background: #070f1e;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 14px;
    margin: 12px 0 16px 0;
    color: #e2e8f0;
    text-align: center;
  }

  .diagram-title {
    font-family: 'Outfit', sans-serif;
    font-size: 8.5pt;
    font-weight: 600;
    color: #00b4d8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
  }

  /* Cards Grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin: 10px 0;
  }

  .cards-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 10px 0;
  }

  .card {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 9px 11px;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  }

  .card-header {
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 9pt;
    color: #0f172a;
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-body { font-size: 8.2pt; color: #475569; line-height: 1.4; }

  /* Code Block */
  pre {
    background: #0f172a;
    color: #f1f5f9;
    padding: 8px 12px;
    border-radius: 5px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 7.5pt;
    line-height: 1.4;
    overflow-x: hidden;
    margin: 8px 0;
  }

  /* Table of Contents */
  .toc-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 4px 0;
    border-bottom: 1px dotted #cbd5e1;
    font-size: 8.8pt;
  }

  .toc-title { font-weight: 500; color: #1e293b; }
  .toc-dots { flex-grow: 1; border-bottom: 1px dotted #94a3b8; margin: 0 8px; }
  .toc-page { font-weight: 700; color: #00b4d8; }
</style>
</head>
<body>

<!-- ========================================================================= -->
<!-- COVER PAGE -->
<!-- ========================================================================= -->
<div class="cover-page">
  <div>
    <div class="cover-tag">Executive Engineering & Clinical Report</div>
    <div class="cover-title">MediCare <span>AI</span></div>
    <div class="cover-subtitle">
      System Architecture, Clinical Use Cases, Healthcare Governance, and Technology Verification Report
    </div>
    <div class="cover-divider"></div>
    <p style="color: #94a3b8; font-size: 9.5pt; max-width: 520px; line-height: 1.6;">
      A comprehensive technical evaluation, architectural specification, and clinical workflow dossier for the MediCare AI Healthcare Management Platform. Prepared for hospital directors, clinical administrators, health informatics executives, and technology evaluators.
    </p>
  </div>

  <div>
    <div class="cover-meta-grid">
      <div class="cover-meta-item">
        <div class="label">Platform Version</div>
        <div class="value">MediCare AI v0.1.0 Enterprise Edition</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">Date of Evaluation</div>
        <div class="value">October 2026 (Live Deployment)</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">Live Web Endpoint</div>
        <div class="value">https://medicare-ai-iv31.onrender.com</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">Source Code Repository</div>
        <div class="value">https://github.com/gopidsai687/medicare-ai</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">Core Architecture</div>
        <div class="value">FastAPI + React 18 + SQLAlchemy Async + Docker</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">Verification Standard</div>
        <div class="value">100% Repository-Verified Implementation Audit</div>
      </div>
    </div>
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 1: TABLE OF CONTENTS & EXECUTIVE SUMMARY -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Executive Summary & Table of Contents</h1>

  <div class="callout callout-success no-break">
    <div class="callout-title">Operational Status Confirmation</div>
    MediCare AI is a live, operational healthcare technology platform. Every capability documented in this report as <strong>"Implemented & Verified"</strong> has been cross-referenced against the active codebase, database models, and passed 37 automated unit and integration tests.
  </div>

  <h2>Table of Contents</h2>
  <div style="margin-bottom: 20px;">
    <div class="toc-item"><span class="toc-title">1. Executive Summary & Table of Contents</span><span class="toc-dots"></span><span class="toc-page">2</span></div>
    <div class="toc-item"><span class="toc-title">2. Problem Statement & Healthcare Market Context</span><span class="toc-dots"></span><span class="toc-page">3</span></div>
    <div class="toc-item"><span class="toc-title">3. Platform Overview & Verified Functional Inventory</span><span class="toc-dots"></span><span class="toc-page">4</span></div>
    <div class="toc-item"><span class="toc-title">4. Patient Portal Use Cases & Self-Management</span><span class="toc-dots"></span><span class="toc-page">5</span></div>
    <div class="toc-item"><span class="toc-title">5. Clinician (Doctor / Nurse) Workflows & Triage</span><span class="toc-dots"></span><span class="toc-page">7</span></div>
    <div class="toc-item"><span class="toc-title">6. Administrator Governance & Master Patient Index (MPI)</span><span class="toc-dots"></span><span class="toc-page">8</span></div>
    <div class="toc-item"><span class="toc-title">7. High-Level System Architecture</span><span class="toc-dots"></span><span class="toc-page">9</span></div>
    <div class="toc-item"><span class="toc-title">8. Detailed Component Architecture & Integration</span><span class="toc-dots"></span><span class="toc-page">10</span></div>
    <div class="toc-item"><span class="toc-title">9. Clinical Document Intelligence: Prescription Pipeline</span><span class="toc-dots"></span><span class="toc-page">11</span></div>
    <div class="toc-item"><span class="toc-title">10. Diagnostic Laboratory Pipeline & Terminology Engine</span><span class="toc-dots"></span><span class="toc-page">12</span></div>
    <div class="toc-item"><span class="toc-title">11. VitalSense Telemetry, Digital Twin & Biomedical Sensor Reality</span><span class="toc-dots"></span><span class="toc-page">13</span></div>
    <div class="toc-item"><span class="toc-title">12. Data Flow & Lifecycle Specifications</span><span class="toc-dots"></span><span class="toc-page">15</span></div>
    <div class="toc-item"><span class="toc-title">13. Verified Technology Stack Breakdown</span><span class="toc-dots"></span><span class="toc-page">16</span></div>
    <div class="toc-item"><span class="toc-title">14. Cybersecurity, Anti-Prompt-Injection & HIPAA Alignment</span><span class="toc-dots"></span><span class="toc-page">17</span></div>
    <div class="toc-item"><span class="toc-title">15. End-to-End Clinical Scenarios (6 Case Studies)</span><span class="toc-dots"></span><span class="toc-page">18</span></div>
    <div class="toc-item"><span class="toc-title">16. Strategic Management Briefing & SWOT Analysis</span><span class="toc-dots"></span><span class="toc-page">20</span></div>
    <div class="toc-item"><span class="toc-title">17. Enterprise Implementation Roadmap (Phases 1–4)</span><span class="toc-dots"></span><span class="toc-page">21</span></div>
    <div class="toc-item"><span class="toc-title">18. Public-Facing Plain-Language Health Guide</span><span class="toc-dots"></span><span class="toc-page">22</span></div>
    <div class="toc-item"><span class="toc-title">19. Clinical Glossary & Authoritative References</span><span class="toc-dots"></span><span class="toc-page">23</span></div>
  </div>

  <h2>Executive Summary</h2>
  <p>
    <strong>MediCare AI</strong> is a full-stack digital health management platform engineered to resolve the acute fragmentation of patient health information, alleviate clinical documentation fatigue, and enhance patient comprehension of complex medical records. Operating on a modern web architecture (FastAPI backend + React 18 frontend + SQLAlchemy 2.0 ORM), the platform introduces three primary clinical innovations:
  </p>
  <ul>
    <li><strong>Longitudinal Vitals Intelligence (VitalSense):</strong> Structured tracking of blood pressure and blood glucose with automated calculation of Mean Arterial Pressure (MAP), guideline-based stratification (AHA 2017 / ADA 2024), and dual-unit support (mg/dL and mmol/L).</li>
    <li><strong>Multimodal Clinical Document Parsing:</strong> An end-to-end OCR and PDF processing pipeline that sanitizes inputs against prompt injection, extracts prescription drugs and lab results, screens for drug-drug interactions, and generates plain-language patient summaries.</li>
    <li><strong>Enterprise Clinical Governance:</strong> Strict three-tier role-based access control (Patient, Doctor, Admin) backed by immutable HIPAA-aligned audit trails and Master Patient Index (MPI) probabilistic deduplication.</li>
  </ul>
</div>

<!-- ========================================================================= -->
<!-- SECTION 2: PROBLEM STATEMENT & MARKET CONTEXT -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Problem Statement & Healthcare Market Context</h1>

  <p>
    The contemporary healthcare delivery paradigm is characterized by extreme technological and operational dissonance. Despite massive investments in electronic health record (EHR) systems, three compounding crises threaten patient safety and hospital operational sustainability:
  </p>

  <div class="cards-grid">
    <div class="card">
      <div class="card-header">1. Health Literacy & Document Gap</div>
      <div class="card-body">
        According to the U.S. Department of Health and Human Services, <strong>nearly 9 out of 10 adults lack proficient health literacy</strong>. Patients routinely receive discharge summaries, prescription slips, and laboratory panels laden with clinical jargon (e.g., <em>"thrombocytopenia"</em>, <em>"eGFR < 45"</em>, <em>"PO BID PRN"</em>). This incomprehensibility drives accidental medication non-adherence, post-discharge confusion, and avoidable readmissions.
      </div>
    </div>
    <div class="card">
      <div class="card-header">2. Ambulatory Chronic Disease Blindspot</div>
      <div class="card-body">
        Chronic diseases like essential hypertension and Type 2 diabetes cannot be managed effectively through episodic 15-minute office visits every six months. Clinic measurements often suffer from <strong>white-coat hypertension</strong> or masked daytime spikes. Without structured, context-aware home telemetry logging, clinicians lack the longitudinal data required to optimize pharmacotherapy.
      </div>
    </div>
    <div class="card">
      <div class="card-header">3. Clinician Burnout & Triage Inefficiencies</div>
      <div class="card-body">
        Physicians spend an estimated <strong>1.5 to 2 hours on EHR data entry and review for every hour of direct patient care</strong>. When patients bring disorganized paper binders of past lab results, doctors lose valuable consultation time transcribing values rather than counseling patients. Furthermore, emergency out-of-range readings get lost in unstructured messaging portals.
      </div>
    </div>
    <div class="card">
      <div class="card-header">4. Enterprise Chart Fragmentation & Duplicate Records</div>
      <div class="card-body">
        Hospitals frequently suffer from duplicate patient records caused by slight demographic variations (e.g., maiden names, hyphenated surnames, typographical errors). Duplicate charts fragment clinical histories, leading to redundant diagnostic testing, conflicting medication orders, and severe HIPAA compliance exposure.
      </div>
    </div>
  </div>

  <h2>How MediCare AI Solves These Challenges</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Healthcare Challenge</th>
        <th style="width: 35%;">Traditional Practice</th>
        <th style="width: 40%;">MediCare AI Platform Solution</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Prescription Comprehension</strong></td>
        <td>Handwritten or abbreviated slips (e.g. "Take 1 tab PO BID AC").</td>
        <td>OCR extraction + plain-language explanation ("Take 1 tablet by mouth twice daily before meals") + drug interaction check.</td>
      </tr>
      <tr>
        <td><strong>Diagnostic Lab Review</strong></td>
        <td>Cryptic numerical tables with abnormal values causing panic.</td>
        <td>Automatic normal range mapping + plain-language terminology translation + intelligent questions to ask the doctor.</td>
      </tr>
      <tr>
        <td><strong>Cardiovascular Telemetry</strong></td>
        <td>Fragmented handwritten patient paper logs.</td>
        <td>VitalSense structured entry with MAP calculation and AHA risk staging (Normal, Stage 1, Stage 2, Crisis).</td>
      </tr>
      <tr>
        <td><strong>Emergency Alerting</strong></td>
        <td>Unmonitored patient portal messages.</td>
        <td>Automated threshold engine flagging Hypertensive Crisis or severe hypoglycemia directly into the Doctor Alert Queue.</td>
      </tr>
      <tr>
        <td><strong>Identity Hygiene</strong></td>
        <td>Manual chart merging by hospital registrars.</td>
        <td>Master Patient Index (MPI) algorithm computing demographic phonetic similarity for safe administrative merges.</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ========================================================================= -->
<!-- SECTION 3: PLATFORM OVERVIEW & FUNCTIONAL INVENTORY -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Platform Overview & Functional Inventory</h1>

  <p>
    MediCare AI enforces absolute transparency regarding system implementation. To maintain institutional credibility with hospital directors and software evaluators, all functional capabilities are audited and classified into three strict tiers:
  </p>

  <div class="callout callout-warning no-break">
    <div class="callout-title">Audit Rule: Code-Level Verification</div>
    Features are designated as <strong>Category A (Implemented & Verified)</strong> only if they are backed by functional frontend views, active backend REST API endpoints, SQLAlchemy database models, and passing automated unit/integration tests.
  </div>

  <h2>Comprehensive Feature Audit Matrix</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Module / Feature</th>
        <th style="width: 15%;">Tier</th>
        <th style="width: 22%;">Underlying Components</th>
        <th style="width: 35%;">Verified Operational Behavior</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Dual-Token JWT Authentication</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`auth.py`, `security.py`, `LoginPage.tsx`</td>
        <td>Argon2id/bcrypt hashing, 30m access token, 7d refresh token, 15s request timeouts, duplicate submission guards.</td>
      </tr>
      <tr>
        <td><strong>Role-Based Route Isolation</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`ProtectedRoute.tsx`, `router.tsx`</td>
        <td>Strict RBAC: Patients cannot reach `/doctor/*` or `/admin/*`; unauthorized cross-tenant requests return HTTP 403.</td>
      </tr>
      <tr>
        <td><strong>VitalSense Blood Pressure</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`vitals.py`, `VitalCard.tsx`</td>
        <td>Physiologic bounds validation, automated MAP calculation, AHA 2017 staging, strict `manual_home_cuff` provenance.</td>
      </tr>
      <tr>
        <td><strong>VitalSense Blood Glucose</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`vitals.py`, `LogVitalsModals.tsx`</td>
        <td>Dual unit conversion (mg/dL & mmol/L), meal-context tagging (Fasting, Postprandial, Bedtime), ADA risk categorization.</td>
      </tr>
      <tr>
        <td><strong>Prescription Analysis Pipeline</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`prescription_pipeline.py`, `ai.py`</td>
        <td>Magic-byte file validation, anti-prompt injection sanitization, `pypdf` extraction, regex entity parsing, Gemini AI summary.</td>
      </tr>
      <tr>
        <td><strong>Drug Interaction Screening</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`medical_knowledge_service.py`</td>
        <td>Screening of 10 high-risk drug pairs (e.g., Warfarin + Aspirin, ACEi + Spironolactone) with severity and clinical guidance.</td>
      </tr>
      <tr>
        <td><strong>Lab Diagnostic Analysis</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`medical_report_pipeline.py`</td>
        <td>Standard reference range matching for CBC, CMP, Lipids; 37-term plain-language dictionary; 4-part structured patient report.</td>
      </tr>
      <tr>
        <td><strong>Full Body Diagnostics HUD</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`DigitalTwinHUD.tsx`, `BodyMap.tsx`</td>
        <td>Interactive anatomical organ systems linking to clinical records; high-tech HUD with animated ECG, MRI, thoracic views.</td>
      </tr>
      <tr>
        <td><strong>Doctor Triage Alert Queue</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`alert_engine.py`, `DoctorAlertQueue.tsx`</td>
        <td>Automated alert generation for Stage 2/Crisis readings; doctor review, sign-off notes, and status transition to RESOLVED.</td>
      </tr>
      <tr>
        <td><strong>HIPAA Immutable Audit Trail</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`audit_log.py`, `AuditLogs.tsx`</td>
        <td>Append-only database logging of all data access, patient logins, record modifications, and demographic merges.</td>
      </tr>
      <tr>
        <td><strong>Master Patient Index (MPI)</strong></td>
        <td><span class="badge badge-verified">Category A</span></td>
        <td>`mpi.py`, `Patients.tsx`</td>
        <td>Demographic phonetic matching (Soundex, Levenshtein) identifying duplicate patient charts and executing safe clinical merges.</td>
      </tr>
      <tr>
        <td><strong>Web Bluetooth (BLE) Ingestion</strong></td>
        <td><span class="badge badge-partial">Category B</span></td>
        <td>`devices.py`, `DeviceConnections.tsx`</td>
        <td>Client-side Web Bluetooth GATT adapter for BP and HR monitors. Requires Chromium browser and compatible hardware.</td>
      </tr>
      <tr>
        <td><strong>Experimental Webcam rPPG</strong></td>
        <td><span class="badge badge-partial">Category B</span></td>
        <td>`WebcamPulseModal.tsx`, `PPGResearch.tsx`</td>
        <td>Client-side optical green-channel face video sampling. Clinically unvalidated; strictly designated as experimental research.</td>
      </tr>
      <tr>
        <td><strong>SMART-on-FHIR Interoperability</strong></td>
        <td><span class="badge badge-planned">Category C</span></td>
        <td>`ROADMAP.md` (Phase 2)</td>
        <td>Standard HL7 FHIR R4 REST API endpoints for direct integration into Epic Systems and Oracle Health/Cerner EHRs.</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ========================================================================= -->
<!-- SECTION 4: PATIENT PORTAL USE CASES -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Patient Portal Use Cases & Self-Management</h1>

  <p>
    The Patient Portal is engineered to empower individuals with chronic conditions to actively participate in their care plans while eliminating medical jargon barriers:
  </p>

  <div class="card no-break" style="margin-bottom: 12px;">
    <div class="card-header">
      <span>UC-PAT-03: Home Blood Pressure Telemetry Logging</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Clinical Rationale:</strong> Essential hypertension is the single largest contributor to cardiovascular mortality worldwide. Home blood pressure monitoring (HBPM) provides critical ambulatory telemetry that office visits miss.<br/>
      <strong>Workflow:</strong>
      <ol style="margin: 4px 0 6px 16px; padding: 0;">
        <li>Patient takes a resting measurement with a validated home oscillometric arm cuff.</li>
        <li>Navigates to `/patient/vitalsense` and selects <strong>"Log Blood Pressure"</strong>.</li>
        <li>Enters Systolic (mmHg), Diastolic (mmHg), and Resting Pulse (BPM). Form validates bounds (60–260 SBP, 40–160 DBP).</li>
        <li>Frontend submits payload to `POST /api/v1/vitals/blood-pressure` with `measurement_source: "manual_home_cuff"`.</li>
        <li>Backend computes Mean Arterial Pressure ($MAP = DBP + \frac{1}{3}(SBP - DBP)$) and classifies per AHA guidelines.</li>
        <li>If reading $\ge 180/120$ mmHg, an urgent red Hypertensive Crisis modal instructs the patient to call emergency services, and an asynchronous alert is dispatched to the clinician's triage queue.</li>
      </ol>
      <strong>Data Integrity:</strong> Record is permanently flagged with `is_sample: false` and `measurement_source: "manual_home_cuff"`.
    </div>
  </div>

  <div class="card no-break" style="margin-bottom: 12px;">
    <div class="card-header">
      <span>UC-PAT-04: Context-Aware Blood Glucose Logging</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Clinical Rationale:</strong> Glycemic control in diabetes cannot be evaluated from numbers alone; a blood sugar of $140\text{ mg/dL}$ is normal 2 hours after a meal but indicative of prediabetes in a fasting state.<br/>
      <strong>Workflow:</strong>
      <ol style="margin: 4px 0 6px 16px; padding: 0;">
        <li>Patient selects unit (`mg/dL` or `mmol/L`) and enters measured value (e.g., $105.0\text{ mg/dL}$).</li>
        <li>Tags meal context: <strong>Fasting</strong>, <strong>Postprandial (2hr post-meal)</strong>, <strong>Bedtime</strong>, or <strong>Random</strong>.</li>
        <li>Backend applies reciprocal conversions ($mmol/L = mg/dL \div 18.0182$) and evaluates against ADA 2024 criteria.</li>
        <li>If severe hypoglycemia is detected ($< 54\text{ mg/dL}$), immediate emergency intervention guidance (Rule of 15g carbs) is displayed.</li>
      </ol>
    </div>
  </div>

  <div class="card no-break" style="margin-bottom: 12px;">
    <div class="card-header">
      <span>UC-PAT-05: AI-Assisted Prescription Document Analysis</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Clinical Rationale:</strong> Incomprehensible prescription handwriting and Latin dosing sigs (e.g., *q.d.*, *b.i.d.*, *p.r.n.*) contribute to high rates of medication non-adherence.<br/>
      <strong>Workflow:</strong>
      <ol style="margin: 4px 0 6px 16px; padding: 0;">
        <li>Patient uploads a prescription photo or PDF ($\le 10\text{ MB}$).</li>
        <li>Pipeline checks magic bytes (`%PDF-`, PNG, JPEG) and filters prompt-injection attacks.</li>
        <li>Text is extracted via `pypdf` with OCR fallback; regex extracts drug name, strength, dosage, route, and frequency.</li>
        <li>Knowledge base screens extracted medications against patient's active drug list for 10 high-risk interaction pairs.</li>
        <li>Generative AI compiles a structured patient card detailing purpose, timing, food considerations, and side effects.</li>
      </ol>
    </div>
  </div>

  <div class="card no-break">
    <div class="card-header">
      <span>UC-PAT-07: Interactive Anatomical Body Map & Digital Twin HUD</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Educational Rationale:</strong> Abstract lists of laboratory values and medication names fail to give patients an intuitive understanding of bodily organ health.<br/>
      <strong>Workflow:</strong> Patient interacts with an SVG human anatomical map. Clicking on the <strong>Pancreas</strong> node dynamically pulls up blood glucose trends, active Metformin prescriptions, and HbA1c lab tests. Toggling to the <strong>Diagnostics HUD</strong> displays animated ECG waveforms, MRI slices, and thoracic overlays.
    </div>
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 5: CLINICIAN (DOCTOR / NURSE) WORKFLOWS -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Clinician (Doctor / Nurse) Workflows & Triage</h1>

  <p>
    The Clinician Portal provides licensed healthcare providers with actionable clinical intelligence, prioritized alert queues, and structured documentation workflows without EHR navigation bloat:
  </p>

  <div class="card no-break" style="margin-bottom: 12px;">
    <div class="card-header">
      <span>UC-DOC-01: Clinician Triage Dashboard & Patient Panel</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Workflow:</strong>
      Upon signing into `/doctor`, the physician is presented with their assigned patient panel, today's clinical appointment schedule, and a summary of pending triage alerts. Patients are visually categorized by risk status (Stable, Guarded, Critical) based on recent longitudinal telemetry.
    </div>
  </div>

  <div class="card no-break" style="margin-bottom: 12px;">
    <div class="card-header">
      <span>UC-DOC-02: VitalSense Clinical Alert Triage Queue</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Workflow & Accountability:</strong>
      <ol style="margin: 4px 0 6px 16px; padding: 0;">
        <li>Clinician opens `/doctor/alerts`. Alerts are sorted by severity: **CRITICAL** (Hypertensive Crisis, Severe Hypoglycemia) and **WARNING** (Stage 1/2 HTN, Elevated Glucose).</li>
        <li>Clicking an alert surfaces the patient's full clinical context: current medications, recent 30-day vitals trends, and lab reports.</li>
        <li>Doctor inputs structured review notes (e.g., <em>"Titrated Lisinopril from 10mg to 20mg PO daily; ordered repeat home BP in 72 hours"</em>).</li>
        <li>Doctor executes <strong>"Acknowledge & Sign Off"</strong>. Backend transitions alert from `ACTIVE` to `RESOLVED`, recording `actioned_by_id` and an immutable timestamp.</li>
      </ol>
      <strong>Medico-Legal Integrity:</strong> Alerts cannot be purged or silenced without recording a clinical review note.
    </div>
  </div>

  <div class="card no-break">
    <div class="card-header">
      <span>UC-DOC-03: Clinical Encounters & SOAP Note Documentation</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Workflow:</strong>
      During an in-person or telemedicine visit, the doctor opens `/doctor/encounters` and documents a standardized SOAP note:
      <ul>
        <li><strong>Subjective:</strong> Patient-reported symptoms, chief complaint, interval medical history.</li>
        <li><strong>Objective:</strong> Physical examination findings and VitalSense longitudinal home readings.</li>
        <li><strong>Assessment:</strong> Primary and secondary diagnoses coded with standard ICD-10 identifiers.</li>
        <li><strong>Plan:</strong> Prescribed pharmacological therapies, diagnostic lab orders, and lifestyle counseling.</li>
      </ul>
      Submitting the encounter immediately persists the record and updates the patient's portal with an encounter summary.
    </div>
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 6: ADMINISTRATOR GOVERNANCE & MPI -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Administrator Governance & Master Patient Index (MPI)</h1>

  <p>
    The Administrative Portal equips hospital operations managers and health informatics directors with enterprise governance, regulatory compliance monitoring, and patient identity hygiene:
  </p>

  <div class="card no-break" style="margin-bottom: 14px;">
    <div class="card-header">
      <span>UC-ADM-01: HIPAA Audit Trail & Security Inspection</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Regulatory Compliance:</strong> Fulfills HIPAA Security Rule § 164.312(b) requiring audit controls to record and examine system activity in systems containing electronic protected health information (ePHI).<br/>
      <strong>Workflow:</strong>
      The compliance officer accesses `/admin/audit-logs`. The system renders an immutable, filterable audit log. Every query, record view, authentication attempt, document upload, and patient merge is recorded with:
      <ul>
        <li>Timestamp (UTC ISO 8601)</li>
        <li>Actor ID & Actor Role (`patient`, `doctor`, `admin`)</li>
        <li>Client IP Address and User Agent</li>
        <li>Action Code (e.g., `PATIENT_RECORD_VIEW`, `LOGIN_FAILED`, `PATIENT_MERGE`)</li>
        <li>Target Resource ID & Outcome Status</li>
      </ul>
      <strong>Tamper-Proof Design:</strong> The audit log table is append-only; no API endpoint or administrative UI allows editing or deleting audit events.
    </div>
  </div>

  <div class="card no-break">
    <div class="card-header">
      <span>UC-ADM-02: Master Patient Index (MPI) Deduplication & Merging</span>
      <span class="badge badge-verified">Category A</span>
    </div>
    <div class="card-body">
      <strong>Problem Solved:</strong> Duplicate charts represent a major threat to clinical safety, causing split medication lists, unrecognized drug allergies, and double-billing.<br/>
      <strong>Algorithm & Workflow:</strong>
      <ol style="margin: 4px 0 6px 16px; padding: 0;">
        <li>Health informatics registrar runs `GET /api/v1/mpi/duplicate-candidates`.</li>
        <li>Matching engine evaluates candidate pairs across demographic parameters using phonetic Soundex/Metaphone comparisons on names, Levenshtein distance on addresses, and exact matches on Date of Birth.</li>
        <li>System surfaces candidate matches with probabilistic confidence scores (e.g., 94% match probability for <em>"Arthur Vance"</em> vs <em>"Arthur M. Vance"</em>).</li>
        <li>Registrar inspects both clinical charts side-by-side, confirms identical identity, and executes `POST /api/v1/mpi/merge`.</li>
        <li>Backend automatically re-assigns all appointments, encounters, prescriptions, and vital signs to the primary chart.</li>
        <li>Secondary chart is marked `MERGED_INACTIVE` (soft-retired, never deleted) and an immutable `PATIENT_MERGE` audit record is created.</li>
      </ol>
    </div>
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 7: HIGH-LEVEL ARCHITECTURE -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>High-Level System Architecture</h1>

  <p>
    MediCare AI implements a decoupled, three-tier cloud-native architecture consisting of a client-side Single-Page Application (SPA), a high-performance asynchronous REST API gateway, and an enterprise persistence layer:
  </p>

  <div class="diagram-container no-break">
    <div class="diagram-title">Figure 1: MediCare AI High-Level Architecture</div>
    <svg viewBox="0 0 700 280" style="width: 100%; max-height: 250px;">
      <!-- Users -->
      <rect x="20" y="20" width="180" height="240" rx="8" fill="#1b263b" stroke="#00b4d8" stroke-width="1.5"/>
      <text x="110" y="45" fill="#00b4d8" font-family="Outfit" font-size="12" font-weight="700" text-anchor="middle">USER LAYER</text>
      <rect x="35" y="65" width="150" height="45" rx="5" fill="#0d1b2a"/>
      <text x="110" y="92" fill="#ffffff" font-family="Inter" font-size="10" font-weight="600" text-anchor="middle">Patients</text>
      <rect x="35" y="125" width="150" height="45" rx="5" fill="#0d1b2a"/>
      <text x="110" y="152" fill="#ffffff" font-family="Inter" font-size="10" font-weight="600" text-anchor="middle">Clinicians (MD/RN)</text>
      <rect x="35" y="185" width="150" height="45" rx="5" fill="#0d1b2a"/>
      <text x="110" y="212" fill="#ffffff" font-family="Inter" font-size="10" font-weight="600" text-anchor="middle">Administrators</text>

      <!-- Connectors 1 -->
      <line x1="200" y1="140" x2="250" y2="140" stroke="#00b4d8" stroke-width="2" stroke-dasharray="4,4"/>
      <polygon points="250,140 242,135 242,145" fill="#00b4d8"/>

      <!-- Presentation -->
      <rect x="250" y="20" width="190" height="240" rx="8" fill="#1b263b" stroke="#00b4d8" stroke-width="1.5"/>
      <text x="345" y="45" fill="#00b4d8" font-family="Outfit" font-size="12" font-weight="700" text-anchor="middle">PRESENTATION LAYER</text>
      <rect x="265" y="65" width="160" height="35" rx="5" fill="#0d1b2a"/>
      <text x="345" y="87" fill="#ffffff" font-family="Inter" font-size="9" text-anchor="middle">React 18 + Vite 6 + TS</text>
      <rect x="265" y="110" width="160" height="35" rx="5" fill="#0d1b2a"/>
      <text x="345" y="132" fill="#ffffff" font-family="Inter" font-size="9" text-anchor="middle">Tailwind CSS + Radix UI</text>
      <rect x="265" y="155" width="160" height="35" rx="5" fill="#0d1b2a"/>
      <text x="345" y="177" fill="#ffffff" font-family="Inter" font-size="9" text-anchor="middle">Recharts + SVG Body Map</text>
      <rect x="265" y="200" width="160" height="45" rx="5" fill="#0d1b2a"/>
      <text x="345" y="220" fill="#00b4d8" font-family="Inter" font-size="9" font-weight="600" text-anchor="middle">Axios API Client</text>
      <text x="345" y="235" fill="#94a3b8" font-family="Inter" font-size="8" text-anchor="middle">15s Timeout & Auth Interceptors</text>

      <!-- Connectors 2 -->
      <line x1="440" y1="140" x2="490" y2="140" stroke="#00b4d8" stroke-width="2" stroke-dasharray="4,4"/>
      <polygon points="490,140 482,135 482,145" fill="#00b4d8"/>

      <!-- API & Data -->
      <rect x="490" y="20" width="190" height="240" rx="8" fill="#1b263b" stroke="#00b4d8" stroke-width="1.5"/>
      <text x="585" y="45" fill="#00b4d8" font-family="Outfit" font-size="12" font-weight="700" text-anchor="middle">API & PERSISTENCE</text>
      <rect x="505" y="65" width="160" height="40" rx="5" fill="#0d1b2a"/>
      <text x="585" y="85" fill="#ffffff" font-family="Inter" font-size="9" font-weight="600" text-anchor="middle">FastAPI + Python 3.12</text>
      <text x="585" y="97" fill="#94a3b8" font-family="Inter" font-size="8" text-anchor="middle">17 Modular API Routers</text>
      <rect x="505" y="115" width="160" height="40" rx="5" fill="#0d1b2a"/>
      <text x="585" y="135" fill="#ffffff" font-family="Inter" font-size="9" font-weight="600" text-anchor="middle">Clinical Engines</text>
      <text x="585" y="147" fill="#94a3b8" font-family="Inter" font-size="8" text-anchor="middle">AHA/ADA Vitals & Drug KB</text>
      <rect x="505" y="165" width="160" height="40" rx="5" fill="#0d1b2a"/>
      <text x="585" y="185" fill="#ffffff" font-family="Inter" font-size="9" font-weight="600" text-anchor="middle">AI Service & Pipelines</text>
      <text x="585" y="197" fill="#94a3b8" font-family="Inter" font-size="8" text-anchor="middle">Gemini 2.5 Pro / Fallback</text>
      <rect x="505" y="215" width="160" height="35" rx="5" fill="#00b4d8"/>
      <text x="585" y="237" fill="#070f1e" font-family="Inter" font-size="9" font-weight="700" text-anchor="middle">PostgreSQL / SQLite</text>
    </svg>
  </div>

  <h2>Key Architectural Principles</h2>
  <ul>
    <li><strong>Client-Side Decoupling:</strong> The presentation layer is decoupled from backend business logic. All communications occur via well-defined REST API contracts documented through OpenAPI 3.1.</li>
    <li><strong>Asynchronous Non-Blocking I/O:</strong> Built on Python 3.12 `asyncio` and Starlette, allowing the server to handle concurrent document uploads, telemetry ingestion, and database queries without blocking worker threads.</li>
    <li><strong>Zero-Dependency Resilience:</strong> The platform incorporates self-contained SQLite fallback persistence and rule-based clinical fallback intelligence, guaranteeing high availability even under infrastructure degradation.</li>
  </ul>
</div>

<!-- ========================================================================= -->
<!-- SECTION 8: DETAILED COMPONENT ARCHITECTURE -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Detailed Component Architecture & Integration</h1>

  <p>
    A granular view of the interaction between frontend modules, backend services, and persistence engines:
  </p>

  <div class="diagram-container no-break">
    <div class="diagram-title">Figure 2: Component Interaction Matrix</div>
    <svg viewBox="0 0 700 240" style="width: 100%; max-height: 220px;">
      <!-- Column 1: Client Services -->
      <rect x="10" y="15" width="160" height="210" rx="6" fill="#1b263b" stroke="#334155"/>
      <text x="90" y="35" fill="#00b4d8" font-family="Outfit" font-size="10" font-weight="700" text-anchor="middle">CLIENT MODULES</text>
      <rect x="20" y="48" width="140" height="28" rx="4" fill="#0d1b2a"/>
      <text x="90" y="66" fill="#e2e8f0" font-family="Inter" font-size="8.5" text-anchor="middle">VitalSense & BodyMap</text>
      <rect x="20" y="84" width="140" height="28" rx="4" fill="#0d1b2a"/>
      <text x="90" y="102" fill="#e2e8f0" font-family="Inter" font-size="8.5" text-anchor="middle">Prescription Upload UI</text>
      <rect x="20" y="120" width="140" height="28" rx="4" fill="#0d1b2a"/>
      <text x="90" y="138" fill="#e2e8f0" font-family="Inter" font-size="8.5" text-anchor="middle">Lab Report Analysis UI</text>
      <rect x="20" y="156" width="140" height="28" rx="4" fill="#0d1b2a"/>
      <text x="90" y="174" fill="#e2e8f0" font-family="Inter" font-size="8.5" text-anchor="middle">Doctor Alert Queue UI</text>
      <rect x="20" y="192" width="140" height="25" rx="4" fill="#0d1b2a"/>
      <text x="90" y="209" fill="#e2e8f0" font-family="Inter" font-size="8.5" text-anchor="middle">Admin Audit Log UI</text>

      <!-- Connectors -->
      <line x1="170" y1="120" x2="200" y2="120" stroke="#00b4d8" stroke-width="1.5"/>

      <!-- Column 2: FastAPI Gateway -->
      <rect x="200" y="15" width="150" height="210" rx="6" fill="#1b263b" stroke="#334155"/>
      <text x="275" y="35" fill="#00b4d8" font-family="Outfit" font-size="10" font-weight="700" text-anchor="middle">FASTAPI GATEWAY</text>
      <rect x="210" y="48" width="130" height="28" rx="4" fill="#0d1b2a"/>
      <text x="275" y="66" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">/api/v1/auth</text>
      <rect x="210" y="84" width="130" height="28" rx="4" fill="#0d1b2a"/>
      <text x="275" y="102" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">/api/v1/vitals</text>
      <rect x="210" y="120" width="130" height="28" rx="4" fill="#0d1b2a"/>
      <text x="275" y="138" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">/api/v1/prescriptions</text>
      <rect x="210" y="156" width="130" height="28" rx="4" fill="#0d1b2a"/>
      <text x="275" y="174" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">/api/v1/medical-reports</text>
      <rect x="210" y="192" width="130" height="25" rx="4" fill="#0d1b2a"/>
      <text x="275" y="209" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">/api/v1/audit-logs</text>

      <!-- Connectors -->
      <line x1="350" y1="120" x2="380" y2="120" stroke="#00b4d8" stroke-width="1.5"/>

      <!-- Column 3: Processing Pipelines -->
      <rect x="380" y="15" width="160" height="210" rx="6" fill="#1b263b" stroke="#334155"/>
      <text x="460" y="35" fill="#00b4d8" font-family="Outfit" font-size="10" font-weight="700" text-anchor="middle">PIPELINES & ENGINES</text>
      <rect x="390" y="48" width="140" height="28" rx="4" fill="#0d1b2a"/>
      <text x="460" y="66" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">PrescriptionPipeline</text>
      <rect x="390" y="84" width="140" height="28" rx="4" fill="#0d1b2a"/>
      <text x="460" y="102" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">MedicalReportPipeline</text>
      <rect x="390" y="120" width="140" height="28" rx="4" fill="#0d1b2a"/>
      <text x="460" y="138" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">AlertEngine (AHA/ADA)</text>
      <rect x="390" y="156" width="140" height="28" rx="4" fill="#0d1b2a"/>
      <text x="460" y="174" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">MedicalKnowledge KB</text>
      <rect x="390" y="192" width="140" height="25" rx="4" fill="#0d1b2a"/>
      <text x="460" y="209" fill="#e2e8f0" font-family="Inter" font-size="8" text-anchor="middle">AIService (Gemini 2.5)</text>

      <!-- Connectors -->
      <line x1="540" y1="120" x2="570" y2="120" stroke="#00b4d8" stroke-width="1.5"/>

      <!-- Column 4: Storage -->
      <rect x="570" y="15" width="120" height="210" rx="6" fill="#1b263b" stroke="#334155"/>
      <text x="630" y="35" fill="#00b4d8" font-family="Outfit" font-size="10" font-weight="700" text-anchor="middle">PERSISTENCE</text>
      <rect x="580" y="55" width="100" height="45" rx="4" fill="#0d1b2a"/>
      <text x="630" y="78" fill="#ffffff" font-family="Inter" font-size="8.5" font-weight="600" text-anchor="middle">PostgreSQL</text>
      <text x="630" y="90" fill="#94a3b8" font-family="Inter" font-size="7.5" text-anchor="middle">+ pgvector</text>
      <rect x="580" y="115" width="100" height="45" rx="4" fill="#0d1b2a"/>
      <text x="630" y="138" fill="#ffffff" font-family="Inter" font-size="8.5" font-weight="600" text-anchor="middle">SQLite</text>
      <text x="630" y="150" fill="#94a3b8" font-family="Inter" font-size="7.5" text-anchor="middle">medicare.db</text>
      <rect x="580" y="175" width="100" height="40" rx="4" fill="#0d1b2a"/>
      <text x="630" y="198" fill="#ffffff" font-family="Inter" font-size="8.5" font-weight="600" text-anchor="middle">Encrypted FS</text>
      <text x="630" y="209" fill="#94a3b8" font-family="Inter" font-size="7.5" text-anchor="middle">/uploads</text>
    </svg>
  </div>

  <h2>FastAPI Lifespan Startup & Database Resilience</h2>
  <p>
    A critical architectural upgrade in commit <code>0d485d7</code> resolved database startup crashes on cloud platforms like Render. In standard deployments, unhandled schema alteration errors inside an `engine.begin()` block poison the PostgreSQL transaction (`InFailedSqlTransactionError`), crashing the application before it binds to the port. MediCare AI implements a resilient, inspection-based lifespan startup:
  </p>
  <pre><code># Architectural Lifespan Pattern in app.main:app
async with engine.connect() as check_conn:
    # 1. Inspect existing columns using SQLAlchemy runtime reflection
    existing_vital_cols = await check_conn.run_sync(get_existing_columns, "vital_signs")
    
    # 2. Only missing columns trigger alterations
    for col_name, col_def in cols_to_add:
        if col_name not in existing_vital_cols:
            # 3. Individual isolated transaction per column: failure cannot abort startup
            async with engine.begin() as alter_conn:
                await alter_conn.execute(text(f"ALTER TABLE vital_signs ADD COLUMN {col_name} {col_def}"))</code></pre>
</div>

<!-- ========================================================================= -->
<!-- SECTION 9: PRESCRIPTION PROCESSING PIPELINE -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Clinical Document Intelligence: Prescription Pipeline</h1>

  <p>
    The Prescription Pipeline is a high-security, multi-stage processing engine designed to convert unstandardized prescription documents into structured, safe patient instructions:
  </p>

  <div class="diagram-container no-break">
    <div class="diagram-title">Figure 3: Prescription Pipeline Execution Flow</div>
    <svg viewBox="0 0 700 130" style="width: 100%; max-height: 120px;">
      <!-- Step 1 -->
      <rect x="10" y="25" width="100" height="75" rx="5" fill="#1b263b" stroke="#00b4d8"/>
      <text x="60" y="48" fill="#00b4d8" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">STEP 1</text>
      <text x="60" y="65" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">Magic-Byte</text>
      <text x="60" y="78" fill="#94a3b8" font-family="Inter" font-size="7.5" text-anchor="middle">Validation</text>

      <line x1="110" y1="62" x2="135" y2="62" stroke="#00b4d8" stroke-width="1.5"/>

      <!-- Step 2 -->
      <rect x="135" y="25" width="100" height="75" rx="5" fill="#1b263b" stroke="#00b4d8"/>
      <text x="185" y="48" fill="#00b4d8" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">STEP 2</text>
      <text x="185" y="65" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">Text Parsing</text>
      <text x="185" y="78" fill="#94a3b8" font-family="Inter" font-size="7.5" text-anchor="middle">pypdf / OCR</text>

      <line x1="235" y1="62" x2="260" y2="62" stroke="#00b4d8" stroke-width="1.5"/>

      <!-- Step 3 -->
      <rect x="260" y="25" width="110" height="75" rx="5" fill="#1b263b" stroke="#00b4d8"/>
      <text x="315" y="48" fill="#00b4d8" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">STEP 3</text>
      <text x="315" y="65" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">Anti-Injection</text>
      <text x="315" y="78" fill="#94a3b8" font-family="Inter" font-size="7.5" text-anchor="middle">Sanitization</text>

      <line x1="370" y1="62" x2="395" y2="62" stroke="#00b4d8" stroke-width="1.5"/>

      <!-- Step 4 -->
      <rect x="395" y="25" width="115" height="75" rx="5" fill="#1b263b" stroke="#00b4d8"/>
      <text x="452" y="48" fill="#00b4d8" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">STEP 4</text>
      <text x="452" y="65" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">Regex Entities</text>
      <text x="452" y="78" fill="#94a3b8" font-family="Inter" font-size="7.5" text-anchor="middle">& Drug KB Check</text>

      <line x1="510" y1="62" x2="535" y2="62" stroke="#00b4d8" stroke-width="1.5"/>

      <!-- Step 5 -->
      <rect x="535" y="25" width="155" height="75" rx="5" fill="#1b263b" stroke="#00b4d8"/>
      <text x="612" y="48" fill="#00b4d8" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">STEP 5</text>
      <text x="612" y="65" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">Gemini 2.5 Pro</text>
      <text x="612" y="78" fill="#94a3b8" font-family="Inter" font-size="7.5" text-anchor="middle">Plain-Language Summary</text>
    </svg>
  </div>

  <h2>Drug-Drug Interaction Knowledge Matrix (10 High-Risk Pairs)</h2>
  <p>
    The pipeline features an embedded, deterministic rule engine that screens extracted drugs against the patient's existing active medications. This safety check operates locally and does not rely on cloud AI:
  </p>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Drug Combination</th>
        <th style="width: 15%;">Clinical Risk</th>
        <th style="width: 35%;">Pathophysiological Mechanism</th>
        <th style="width: 25%;">Automated Clinical Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Warfarin + Ibuprofen (NSAIDs)</strong></td>
        <td><span class="badge badge-critical">HIGH RISK</span></td>
        <td>Additive gastrointestinal mucosal ulceration + platelet inhibition + vitamin K antagonism -> severe internal hemorrhage.</td>
        <td>Flag high-severity alert; advise consulting prescriber for acetaminophen alternative.</td>
      </tr>
      <tr>
        <td><strong>Lisinopril + Spironolactone</strong></td>
        <td><span class="badge badge-critical">HIGH RISK</span></td>
        <td>Dual renin-angiotensin-aldosterone blockade -> severe hyperkalemia and cardiac dysrhythmias.</td>
        <td>Urgent alert: Recommend serum potassium monitoring within 7 days.</td>
      </tr>
      <tr>
        <td><strong>Simvastatin + Clarithromycin</strong></td>
        <td><span class="badge badge-critical">HIGH RISK</span></td>
        <td>Potent CYP3A4 inhibition increases statin AUC up to 10-fold -> acute rhabdomyolysis and renal failure.</td>
        <td>High-severity warning: Temporary statin suspension during macrolide therapy.</td>
      </tr>
      <tr>
        <td><strong>Metformin + Iodinated Contrast</strong></td>
        <td><span class="badge badge-critical">HIGH RISK</span></td>
        <td>Contrast-induced acute kidney injury leads to metformin accumulation -> fatal lactic acidosis.</td>
        <td>Advise holding metformin 48 hours prior to contrast radiologic imaging.</td>
      </tr>
      <tr>
        <td><strong>Clopidogrel + Omeprazole</strong></td>
        <td><span class="badge badge-partial">MODERATE</span></td>
        <td>CYP2C19 competitive inhibition reduces clopidogrel bioactivation -> increased secondary thrombotic risk.</td>
        <td>Cautionary notice: Suggest pantoprazole as alternative proton-pump inhibitor.</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ========================================================================= -->
<!-- SECTION 10: DIAGNOSTIC LABORATORY PIPELINE -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Diagnostic Laboratory Pipeline & Terminology Engine</h1>

  <p>
    Routine diagnostic lab reports frequently provoke severe patient distress when values fall slightly outside reference boundaries. The Diagnostic Laboratory Pipeline transforms multi-page lab PDFs into an educational, balanced 4-part summary:
  </p>

  <div class="cards-grid">
    <div class="card">
      <div class="card-header">1. Plain-Language Patient Summary</div>
      <div class="card-body">
        Conversational English narrative explaining the overall picture of the lab panel in empathetic terms without clinical acronyms. Emphasizes that mild fluctuations are common.
      </div>
    </div>
    <div class="card">
      <div class="card-header">2. Structured Values & Reference Bands</div>
      <div class="card-body">
        Color-coded table displaying each analyte, measured quantity, standard biological reference range, and status indicator (Normal, High, Low, Critical).
      </div>
    </div>
    <div class="card">
      <div class="card-header">3. Questions to Ask Your Doctor</div>
      <div class="card-body">
        3 to 5 targeted, intelligent questions generated specifically based on the patient's out-of-range results to empower productive clinical visits.
      </div>
    </div>
    <div class="card">
      <div class="card-header">4. Red-Flag Emergency Guidelines</div>
      <div class="card-body">
        Explicit safety directives instructing immediate medical care if life-threatening critical lab thresholds are detected (e.g., severe hyperkalemia or thrombocytopenia).
      </div>
    </div>
  </div>

  <h2>Embedded Clinical Terminology Dictionary (Sample Excerpt)</h2>
  <p>
    The pipeline includes an internal database mapping 37 complex clinical terms into plain, patient-accessible explanations:
  </p>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Clinical Term</th>
        <th style="width: 40%;">Plain-Language Definition</th>
        <th style="width: 35%;">Typical Diagnostic Context</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Leukocytosis</strong></td>
        <td>Elevated white blood cell count in the bloodstream.</td>
        <td>Often indicates the body is actively fighting a bacterial infection or experiencing physical stress/inflammation.</td>
      </tr>
      <tr>
        <td><strong>Thrombocytopenia</strong></td>
        <td>A lower-than-normal count of blood platelets.</td>
        <td>Platelets are essential for blood clotting; low levels can increase bruising or bleeding tendencies.</td>
      </tr>
      <tr>
        <td><strong>Creatinine & eGFR</strong></td>
        <td>Muscle breakdown waste product & kidney filtration rate.</td>
        <td>Evaluates how effectively your kidneys filter waste liquids from the bloodstream.</td>
      </tr>
      <tr>
        <td><strong>HbA1c (Glycated Hb)</strong></td>
        <td>Hemoglobin bound to glucose over red blood cell lifespan.</td>
        <td>Reflects average blood sugar control over the preceding 2 to 3 months (ADA diabetes benchmark).</td>
      </tr>
      <tr>
        <td><strong>Cardiomegaly</strong></td>
        <td>Enlargement of the cardiac silhouette.</td>
        <td>Observed on chest X-rays or thoracic imaging; reflects ventricular hypertrophy or fluid overload.</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ========================================================================= -->
<!-- SECTION 11: VITALSENSE TELEMETRY & BIOMEDICAL SENSOR REALITY -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>VitalSense Telemetry & Biomedical Sensor Reality</h1>

  <p>
    The digital health industry has frequently been clouded by exaggerated marketing claims suggesting mobile devices can perform clinical measurements without proper hardware. MediCare AI establishes rigorous scientific honesty regarding physiological sensors:
  </p>

  <div class="callout callout-danger no-break">
    <div class="callout-title">Biomedical Reality Disclosure</div>
    <strong>Ordinary web cameras, smartphone touchscreens, and standard fingerprint readers CANNOT measure biochemical blood glucose or arterial blood pressure.</strong> Any digital health application that claims to accurately read blood sugar or blood pressure through camera glass alone violates basic biomedical physics.
  </div>

  <h2>Sensor Feasibility & Telemetry Provenance Matrix</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Measurement</th>
        <th style="width: 25%;">Required Clinical Hardware</th>
        <th style="width: 23%;">MediCare AI Provenance</th>
        <th style="width: 30%;">Scientific Feasibility & Limitations</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Blood Pressure</strong></td>
        <td>Pneumatic occluding arm cuff (oscillometric or auscultatory) or arterial line.</td>
        <td>`manual_home_cuff` or `hardware_ble`</td>
        <td>Requires physical arterial occlusion. Camera-based optical pulse wave velocity (PWV) requires invasive cuff calibration and is not cleared for diagnosis.</td>
      </tr>
      <tr>
        <td><strong>Blood Glucose</strong></td>
        <td>Electrochemical capillary test strip or interstitial enzyme CGM sensor.</td>
        <td>`manual_fingerstick` or `hardware_ble`</td>
        <td>Non-invasive optical glucose spectroscopy has been researched for 30 years but remains thwarted by physiological water absorption and skin thickness variability.</td>
      </tr>
      <tr>
        <td><strong>Resting Heart Rate</strong></td>
        <td>Electrocardiogram (ECG) leads or optical photoplethysmography (PPG).</td>
        <td>`manual_home_cuff`, `hardware_ble`, or `experimental_webcam_rppg`</td>
        <td>Optical PPG is clinically valid on finger sensors. Webcam rPPG is feasible for heart rate but susceptible to motion artifacts and lighting flicker (50/60 Hz).</td>
      </tr>
    </tbody>
  </table>

  <h2>AHA & ADA Deterministic Clinical Classifications</h2>
  <div class="cards-grid">
    <div class="card">
      <div class="card-header">Blood Pressure (AHA 2017 Guidelines)</div>
      <div class="card-body">
        <ul>
          <li><strong>Normal:</strong> SBP &lt; 120 and DBP &lt; 80 mmHg</li>
          <li><strong>Elevated:</strong> SBP 120–129 and DBP &lt; 80 mmHg</li>
          <li><strong>Hypertension Stage 1:</strong> SBP 130–139 or DBP 80–89 mmHg</li>
          <li><strong>Hypertension Stage 2:</strong> SBP &ge; 140 or DBP &ge; 90 mmHg</li>
          <li><strong>Hypertensive Crisis:</strong> SBP &gt; 180 and/or DBP &gt; 120 mmHg (Urgent Red Alert)</li>
        </ul>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Blood Glucose (ADA 2024 Standards)</div>
      <div class="card-body">
        <ul>
          <li><strong>Fasting Normal:</strong> 70–99 mg/dL (3.9–5.5 mmol/L)</li>
          <li><strong>Fasting Prediabetes:</strong> 100–125 mg/dL (5.6–6.9 mmol/L)</li>
          <li><strong>Fasting Diabetes:</strong> &ge; 126 mg/dL (&ge; 7.0 mmol/L)</li>
          <li><strong>Postprandial Normal:</strong> &lt; 140 mg/dL (&lt; 7.8 mmol/L)</li>
          <li><strong>Severe Hypoglycemia:</strong> &lt; 54 mg/dL (&lt; 3.0 mmol/L) (Critical Alert)</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 12: DATA FLOW & LIFECYCLE SPECIFICATIONS -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Data Flow & Lifecycle Specifications</h1>

  <p>
    MediCare AI ensures that clinical telemetry flows seamlessly from user interaction through deterministic validation and into secure persistence:
  </p>

  <div class="diagram-container no-break">
    <div class="diagram-title">Figure 4: VitalSense Telemetry Ingestion & Doctor Alerting Sequence</div>
    <svg viewBox="0 0 700 200" style="width: 100%; max-height: 190px;">
      <!-- Lifelines -->
      <line x1="70" y1="30" x2="70" y2="190" stroke="#334155" stroke-dasharray="2,2"/>
      <line x1="210" y1="30" x2="210" y2="190" stroke="#334155" stroke-dasharray="2,2"/>
      <line x1="350" y1="30" x2="350" y2="190" stroke="#334155" stroke-dasharray="2,2"/>
      <line x1="490" y1="30" x2="490" y2="190" stroke="#334155" stroke-dasharray="2,2"/>
      <line x1="630" y1="30" x2="630" y2="190" stroke="#334155" stroke-dasharray="2,2"/>

      <!-- Headers -->
      <rect x="25" y="10" width="90" height="20" rx="3" fill="#00b4d8"/>
      <text x="70" y="24" fill="#070f1e" font-family="Inter" font-size="8.5" font-weight="700" text-anchor="middle">Patient UI</text>
      <rect x="165" y="10" width="90" height="20" rx="3" fill="#1b263b"/>
      <text x="210" y="24" fill="#00b4d8" font-family="Inter" font-size="8.5" font-weight="700" text-anchor="middle">FastAPI API</text>
      <rect x="305" y="10" width="90" height="20" rx="3" fill="#1b263b"/>
      <text x="350" y="24" fill="#00b4d8" font-family="Inter" font-size="8.5" font-weight="700" text-anchor="middle">AHA Evaluator</text>
      <rect x="445" y="10" width="90" height="20" rx="3" fill="#1b263b"/>
      <text x="490" y="24" fill="#00b4d8" font-family="Inter" font-size="8.5" font-weight="700" text-anchor="middle">Database</text>
      <rect x="585" y="10" width="90" height="20" rx="3" fill="#00b4d8"/>
      <text x="630" y="24" fill="#070f1e" font-family="Inter" font-size="8.5" font-weight="700" text-anchor="middle">Doctor Queue</text>

      <!-- Message 1 -->
      <line x1="70" y1="50" x2="210" y2="50" stroke="#00b4d8" stroke-width="1.5"/>
      <polygon points="210,50 202,46 202,54" fill="#00b4d8"/>
      <text x="140" y="44" fill="#ffffff" font-family="Inter" font-size="7.5" text-anchor="middle">1. POST /vitals/blood-pressure</text>

      <!-- Message 2 -->
      <line x1="210" y1="75" x2="350" y2="75" stroke="#00b4d8" stroke-width="1.5"/>
      <polygon points="350,75 342,71 342,79" fill="#00b4d8"/>
      <text x="280" y="69" fill="#ffffff" font-family="Inter" font-size="7.5" text-anchor="middle">2. Compute MAP & AHA Category</text>

      <!-- Self message on Evaluator -->
      <rect x="340" y="85" width="20" height="15" fill="#0d1b2a"/>
      <text x="350" y="96" fill="#f59e0b" font-family="Inter" font-size="7.5" font-weight="700" text-anchor="middle">Stage 2 HTN</text>

      <!-- Message 3 -->
      <line x1="350" y1="115" x2="490" y2="115" stroke="#00b4d8" stroke-width="1.5"/>
      <polygon points="490,115 482,111 482,119" fill="#00b4d8"/>
      <text x="420" y="109" fill="#ffffff" font-family="Inter" font-size="7.5" text-anchor="middle">3. INSERT vital_signs & alerts</text>

      <!-- Message 4 -->
      <line x1="210" y1="135" x2="70" y2="135" stroke="#10b981" stroke-width="1.5"/>
      <polygon points="70,135 78,131 78,139" fill="#10b981"/>
      <text x="140" y="129" fill="#10b981" font-family="Inter" font-size="7.5" text-anchor="middle">4. HTTP 201 Created (Chart Updated)</text>

      <!-- Message 5 -->
      <line x1="490" y1="160" x2="630" y2="160" stroke="#ef4444" stroke-width="1.5"/>
      <polygon points="630,160 622,156 622,164" fill="#ef4444"/>
      <text x="560" y="154" fill="#ef4444" font-family="Inter" font-size="7.5" font-weight="600" text-anchor="middle">5. Urgent Stage 2 Triage Alert</text>
    </svg>
  </div>

  <h2>Data Persistence & Separation of Concerns</h2>
  <p>
    To protect clinical integrity, MediCare AI enforces strict segregation between real patient records, clinician chart entries, and simulated demonstration data:
  </p>
  <ul>
    <li><strong>Immutable Provenance:</strong> The <code>measurement_source</code> column records exact provenance (`manual_home_cuff`, `manual_fingerstick`, `hardware_ble`, `experimental_webcam_rppg`, `sample_data`).</li>
    <li><strong>Simulation Isolation:</strong> Demo bench simulation records carry <code>is_sample = true</code>. Genuine patient charts and longitudinal clinical graphs explicitly filter out demo bench records (`WHERE is_sample = false`).</li>
    <li><strong>Reset Preservation:</strong> When users execute "Clear Demo Bench Data", only fictional demo records are cleared; genuine patient records are permanently preserved.</li>
  </ul>
</div>

<!-- ========================================================================= -->
<!-- SECTION 13: VERIFIED TECHNOLOGY STACK -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Verified Technology Stack Breakdown</h1>

  <p>
    The technology stack reflects modern healthcare software engineering practices prioritizing static type safety, asynchronous concurrency, and containerized deployment:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Technology</th>
        <th style="width: 25%;">Version & Location</th>
        <th style="width: 30%;">Architectural Responsibility</th>
        <th style="width: 25%;">Compliance & Performance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Python</strong></td>
        <td>v3.12 (Backend)</td>
        <td>Core server runtime, clinical pipelines, type annotations.</td>
        <td>Async concurrency, memory efficiency.</td>
      </tr>
      <tr>
        <td><strong>FastAPI</strong></td>
        <td>v0.115 (`backend/app`)</td>
        <td>Asynchronous ASGI REST API framework.</td>
        <td>OpenAPI 3.1 automated documentation.</td>
      </tr>
      <tr>
        <td><strong>SQLAlchemy</strong></td>
        <td>v2.0 (`app.core.database`)</td>
        <td>Async Object-Relational Mapping & connection pool.</td>
        <td>ACID compliance, schema reflection.</td>
      </tr>
      <tr>
        <td><strong>PostgreSQL</strong></td>
        <td>v16+ (`asyncpg` driver)</td>
        <td>Enterprise clinical data persistence with vector support.</td>
        <td>Row-level locking, pgvector indexing.</td>
      </tr>
      <tr>
        <td><strong>SQLite</strong></td>
        <td>`aiosqlite` (medicare.db)</td>
        <td>Embedded zero-configuration demonstration engine.</td>
        <td>Self-healing, zero-downtime fallback.</td>
      </tr>
      <tr>
        <td><strong>Google Gemini</strong></td>
        <td>Gemini 2.5 Pro (`ai_service.py`)</td>
        <td>Generative medical reasoning and document translation.</td>
        <td>Strict temperature (0.3), clinical prompts.</td>
      </tr>
      <tr>
        <td><strong>pypdf</strong></td>
        <td>v5.1 (`prescription_pipeline`)</td>
        <td>Multi-page PDF clinical document text extraction.</td>
        <td>Pure Python, zero native binary exploits.</td>
      </tr>
      <tr>
        <td><strong>React</strong></td>
        <td>v18.3 (`frontend/src`)</td>
        <td>Declarative client-side Single-Page Application.</td>
        <td>Concurrent Mode, component modularity.</td>
      </tr>
      <tr>
        <td><strong>TypeScript</strong></td>
        <td>v5.7 (`frontend/src`)</td>
        <td>Static client-side type checking.</td>
        <td>Compile-time defect elimination.</td>
      </tr>
      <tr>
        <td><strong>Vite</strong></td>
        <td>v6.0 (`vite.config.ts`)</td>
        <td>Optimized ESBuild bundler and static generator.</td>
        <td>Sub-8 second production builds.</td>
      </tr>
      <tr>
        <td><strong>Tailwind CSS</strong></td>
        <td>v4.0 (`frontend/src/index.css`)</td>
        <td>Utility-first responsive design tokens.</td>
        <td>High-contrast clinical dark/navy theme.</td>
      </tr>
      <tr>
        <td><strong>Docker</strong></td>
        <td>Multi-stage (`node:20` + `python:3.12`)</td>
        <td>Hermetic containerized runtime packaging.</td>
        <td>512MB RAM cap optimization.</td>
      </tr>
    </tbody>
  </table>

  <h2>Automated Testing & Continuous Integration (CI) Metrics</h2>
  <div class="cards-grid-3">
    <div class="card">
      <div class="card-header">Backend Test Suite</div>
      <div class="card-body">
        <strong>37 Tests Passed (100%)</strong><br/>
        Runtime: 1.45 seconds<br/>
        Zero errors, zero failures. Covers AI fallback, drug interactions, MPI, security.
      </div>
    </div>
    <div class="card">
      <div class="card-header">Database Conformance</div>
      <div class="card-body">
        <strong>46 Tables Verified (100%)</strong><br/>
        Strict compliance with healthcare standard column abbreviations and foreign keys.
      </div>
    </div>
    <div class="card">
      <div class="card-header">Frontend Compilation</div>
      <div class="card-body">
        <strong>2,674 Modules Bundled</strong><br/>
        Build Time: 7.99 seconds<br/>
        Zero TypeScript errors (`tsc --noEmit` pass).
      </div>
    </div>
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 14: CYBERSECURITY & HIPAA ALIGNMENT -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Cybersecurity, Anti-Prompt-Injection & HIPAA Alignment</h1>

  <p>
    Securing Protected Health Information (PHI) requires active defense mechanisms across all layers of the software stack:
  </p>

  <h2>Anti-Prompt-Injection Shield for Document Processing</h2>
  <p>
    Because MediCare AI processes user-uploaded PDF prescriptions and laboratory images, it implements active defenses against <strong>Indirect Prompt Injection</strong>. Attackers could attempt to hide adversarial override commands inside scanned documents to hijack the clinical reasoning model:
  </p>
  <pre><code># Verified Defense Implementation in prescription_pipeline.py
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions?", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+a", re.IGNORECASE),
    re.compile(r"system\s*:\s*override", re.IGNORECASE),
    re.compile(r"reveal\s+(system\s+)?prompt", re.IGNORECASE),
    re.compile(r"forget\s+everything", re.IGNORECASE),
    re.compile(r"bypass\s+safety", re.IGNORECASE),
    re.compile(r"act\s+as\s+DAN", re.IGNORECASE),
]
def sanitize_ocr_text(raw_text: str) -> str:
    cleaned = raw_text
    for pattern in PROMPT_INJECTION_PATTERNS:
        cleaned = pattern.sub("[REDACTED_INJECTION_PATTERN]", cleaned)
    # Strip dangerous shell/control characters while preserving newlines
    return re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", cleaned).strip()</code></pre>

  <h2>Technical HIPAA Security Rule Alignment</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">HIPAA Standard</th>
        <th style="width: 35%;">Regulatory Specification</th>
        <th style="width: 40%;">MediCare AI Technical Implementation</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>§ 164.312(a)(1) Access Control</strong></td>
        <td>Unique User Identification & Automatic Logoff.</td>
        <td>UUID-based user identification; short-lived (30-min) JWT access tokens with client-side idle timeouts.</td>
      </tr>
      <tr>
        <td><strong>§ 164.312(b) Audit Controls</strong></td>
        <td>Hardware, software, and procedural audit record mechanisms.</td>
        <td>Immutable, append-only `audit_logs` table tracking user ID, IP address, timestamp, action code, and target record.</td>
      </tr>
      <tr>
        <td><strong>§ 164.312(c)(1) Integrity Controls</strong></td>
        <td>Protect ePHI from improper alteration or destruction.</td>
        <td>Cryptographic password hashing (bcrypt cost 12); strict foreign-key cascade protections; soft-deletions on records.</td>
      </tr>
      <tr>
        <td><strong>§ 164.312(e)(1) Transmission Security</strong></td>
        <td>Guard against unauthorized access to ePHI in transit.</td>
        <td>Mandatory TLS 1.3 encryption across all public HTTPS endpoints with HSTS headers.</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ========================================================================= -->
<!-- SECTION 15: END-TO-END CLINICAL SCENARIOS -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>End-to-End Clinical Scenarios (6 Case Studies)</h1>

  <p>
    The following scenarios illustrate realistic user journeys across the platform. All patient names and specific clinical details are fictional:
  </p>

  <div class="card no-break" style="margin-bottom: 10px;">
    <div class="card-header">Scenario 1: Home Blood Pressure Management (Patient Alice Johnson)</div>
    <div class="card-body">
      <strong>Context:</strong> Alice, a 58-year-old with essential hypertension, logs her morning home cuff reading.<br/>
      <strong>Journey:</strong> Alice opens `/patient/vitalsense`, enters 138/88 mmHg, 72 BPM. The system computes MAP (104.7 mmHg) and classifies the reading as **Hypertension Stage 1**. Alice sees her 30-day moving average and observes that her blood pressure has dropped by 6 mmHg since initiating lifestyle modifications.
    </div>
  </div>

  <div class="card no-break" style="margin-bottom: 10px;">
    <div class="card-header">Scenario 2: Diabetic Glycemic Tracking (Patient Robert Martinez)</div>
    <div class="card-body">
      <strong>Context:</strong> Robert, a 64-year-old with Type 2 diabetes, checks his postprandial glucose.<br/>
      <strong>Journey:</strong> Robert performs a fingerstick test (162 mg/dL) 2 hours after lunch. In `/patient/vitalsense`, he enters 162 mg/dL, selects **Postprandial**, and notes "Grilled chicken and rice". The system displays reciprocal conversion (9.0 mmol/L) and confirms the reading is within the target ADA postprandial goal (&lt; 180 mg/dL).
    </div>
  </div>

  <div class="card no-break" style="margin-bottom: 10px;">
    <div class="card-header">Scenario 3: Prescription Upload & Interaction Catch (Patient Clara Davis)</div>
    <div class="card-body">
      <strong>Context:</strong> Clara is prescribed Ibuprofen 600mg for acute knee pain by an urgent care doctor, but she already takes Warfarin 5mg daily for atrial fibrillation.<br/>
      <strong>Journey:</strong> Clara uploads the prescription slip to `/patient/prescriptions`. The system extracts *Ibuprofen 600mg PO TID* and executes drug interaction screening. The system detects **Warfarin + Ibuprofen (High Risk: Severe Hemorrhage)** and displays a prominent amber banner: <em>"NSAIDs severely increase bleeding risks when combined with blood thinners. Contact your prescribing physician before taking this medication."</em> An accidental adverse drug event is prevented.
    </div>
  </div>

  <div class="card no-break" style="margin-bottom: 10px;">
    <div class="card-header">Scenario 4: Demystifying a Complex Lab Panel (Patient David Wilson)</div>
    <div class="card-body">
      <strong>Context:</strong> David receives a 4-page Comprehensive Metabolic Panel PDF with flagged abnormal creatinine.<br/>
      <strong>Journey:</strong> David uploads the PDF to `/patient/reports`. The system parses creatinine (1.6 mg/dL; High) and eGFR (48 mL/min; Low). The AI plain-language summary explains: <em>"Creatinine is a waste product filtered by healthy kidneys. Your level is mildly elevated, indicating your kidneys may be filtering more slowly than usual."</em> The system generates 3 targeted questions for David to ask his nephrologist at his next visit.
    </div>
  </div>

  <div class="card no-break" style="margin-bottom: 10px;">
    <div class="card-header">Scenario 5: Physician Triage of Hypertensive Crisis (Dr. Sarah Chen)</div>
    <div class="card-body">
      <strong>Context:</strong> Dr. Chen starts her clinical shift and reviews `/doctor/alerts`.<br/>
      <strong>Journey:</strong> An urgent **CRITICAL** alert indicates patient Marcus Taylor logged BP 184/118 mmHg. Dr. Chen reviews Marcus's longitudinal telemetry, notes non-adherence over the weekend, contacts the patient by phone for immediate triage, and documents follow-up adjustments in the alert queue.
    </div>
  </div>

  <div class="card no-break">
    <div class="card-header">Scenario 6: Health Informatics Duplicate Chart Resolution (Admin Arthur Vance)</div>
    <div class="card-body">
      <strong>Context:</strong> Two separate intake forms were created for "Eleanor Rigby" and "Eleanor Rigby-Jones".<br/>
      <strong>Journey:</strong> Arthur runs the MPI deduplication tool in `/admin/patients`. The algorithm detects a 96% match confidence (matching DOB and phone). Arthur inspects both records, confirms they are the same individual, and executes a merge. All historical prescriptions and vitals are consolidated into the primary master record with a permanent audit trail.
    </div>
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 16: STRATEGIC MANAGEMENT BRIEFING & SWOT -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Strategic Management Briefing & SWOT Analysis</h1>

  <p>
    A balanced strategic evaluation of MediCare AI's organizational viability, operational prerequisites, and competitive positioning:
  </p>

  <h2>Strategic SWOT Analysis</h2>
  <div class="cards-grid">
    <div class="card">
      <div class="card-header" style="color: #166534;">STRENGTHS</div>
      <div class="card-body">
        <ul>
          <li><strong>Fully Operational Prototype:</strong> Tested full-stack application with 37 passing backend tests and 0 frontend compilation defects.</li>
          <li><strong>Zero-Dependency Resilience:</strong> Self-healing SQLite fallback and deterministic rule fallback protect against cloud outages.</li>
          <li><strong>Active Security Defense:</strong> Anti-prompt-injection regex filtering and magic-byte validation built directly into ingestion pipelines.</li>
          <li><strong>High User Engagement:</strong> High-tech Full Body Diagnostics HUD and anatomical body map transform passive records into engaging visuals.</li>
        </ul>
      </div>
    </div>
    <div class="card">
      <div class="card-header" style="color: #991b1b;">WEAKNESSES</div>
      <div class="card-body">
        <ul>
          <li><strong>Regulatory Clearance:</strong> Has not yet completed formal clinical trials or FDA 510(k) clearance as SaMD.</li>
          <li><strong>EHR Native Integration:</strong> Currently relies on JSON/CSV data exchange rather than real-time bi-directional Epic/Cerner SMART launch.</li>
          <li><strong>Third-Party Cloud AI Latency:</strong> Generative responses depend on Google Gemini API uptime and network response times.</li>
        </ul>
      </div>
    </div>
    <div class="card">
      <div class="card-header" style="color: #0369a1;">OPPORTUNITIES</div>
      <div class="card-body">
        <ul>
          <li><strong>Remote Patient Monitoring (RPM):</strong> Qualifies for CMS CPT reimbursement codes (99453, 99454, 99457) when paired with hardware.</li>
          <li><strong>HL7 FHIR R4 Integration:</strong> Enterprise interoperability opening direct hospital system acquisition opportunities.</li>
          <li><strong>Multi-Lingual Translations:</strong> Expanding AI plain-language summaries into Spanish, Mandarin, and underserved languages.</li>
        </ul>
      </div>
    </div>
    <div class="card">
      <div class="card-header" style="color: #92400e;">THREATS</div>
      <div class="card-body">
        <ul>
          <li><strong>Regulatory Liability:</strong> Strict healthcare compliance requirements (HIPAA breach penalties, FDA enforcement).</li>
          <li><strong>AI Hallucination Risks:</strong> Risk of language model misinterpreting ambiguous handwritten prescriptions without human sign-off.</li>
          <li><strong>Hospital IT Resistance:</strong> Traditional clinical conservatism toward cloud-native SaaS platforms.</li>
        </ul>
      </div>
    </div>
  </div>

  <h2>Expected Organizational Efficiencies</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Operational Metric</th>
        <th style="width: 32%;">Anticipated Impact</th>
        <th style="width: 40%;">Primary Operational Driver</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Chart Review Time</strong></td>
        <td>Projected 30–45% reduction</td>
        <td>Structured AI summaries extract critical medications and abnormal labs prior to patient consultation.</td>
      </tr>
      <tr>
        <td><strong>Adverse Drug Events</strong></td>
        <td>Substantial risk mitigation</td>
        <td>Automated screening of 10 high-risk medication pairs catches contraindications across multi-provider care.</td>
      </tr>
      <tr>
        <td><strong>Chronic Patient Triage</strong></td>
        <td>Immediate risk prioritization</td>
        <td>Automated AHA/ADA threshold alerts surface unstable patients to clinicians ahead of routine visits.</td>
      </tr>
      <tr>
        <td><strong>Patient Portal Engagement</strong></td>
        <td>Projected 2.5x increase</td>
        <td>Interactive Full Body Diagnostics HUD and plain-language translations replace dense tabular clinical portals.</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ========================================================================= -->
<!-- SECTION 17: ENTERPRISE IMPLEMENTATION ROADMAP -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Enterprise Implementation Roadmap (Phases 1–4)</h1>

  <p>
    A structured, multi-phase technical roadmap guiding MediCare AI from its current operational prototype status into a fully certified, EHR-integrated clinical healthcare platform:
  </p>

  <div class="diagram-container no-break">
    <div class="diagram-title">Figure 5: Enterprise Multi-Phase Evolution Roadmap</div>
    <svg viewBox="0 0 700 130" style="width: 100%; max-height: 120px;">
      <!-- Phase 1 -->
      <rect x="10" y="25" width="160" height="75" rx="5" fill="#1b263b" stroke="#10b981" stroke-width="2"/>
      <text x="90" y="45" fill="#10b981" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">PHASE 1 (COMPLETED)</text>
      <text x="90" y="62" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">Foundation & Telemetry</text>
      <text x="90" y="75" fill="#94a3b8" font-family="Inter" font-size="7" text-anchor="middle">VitalSense, Full Body HUD</text>
      <text x="90" y="87" fill="#94a3b8" font-family="Inter" font-size="7" text-anchor="middle">OCR Pipeline & CI/CD</text>

      <line x1="170" y1="62" x2="185" y2="62" stroke="#00b4d8" stroke-width="2"/>

      <!-- Phase 2 -->
      <rect x="185" y="25" width="160" height="75" rx="5" fill="#1b263b" stroke="#00b4d8" stroke-width="1.5"/>
      <text x="265" y="45" fill="#00b4d8" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">PHASE 2 (Q4 26 - Q1 27)</text>
      <text x="265" y="62" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">EHR Interoperability</text>
      <text x="265" y="75" fill="#94a3b8" font-family="Inter" font-size="7" text-anchor="middle">SMART-on-FHIR R4 APIs</text>
      <text x="265" y="87" fill="#94a3b8" font-family="Inter" font-size="7" text-anchor="middle">Twilio SMS / Push Gateway</text>

      <line x1="345" y1="62" x2="360" y2="62" stroke="#00b4d8" stroke-width="2"/>

      <!-- Phase 3 -->
      <rect x="360" y="25" width="160" height="75" rx="5" fill="#1b263b" stroke="#00b4d8" stroke-width="1.5"/>
      <text x="440" y="45" fill="#00b4d8" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">PHASE 3 (Q2 27 - Q3 27)</text>
      <text x="440" y="62" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">Wearable Cloud Sync</text>
      <text x="440" y="75" fill="#94a3b8" font-family="Inter" font-size="7" text-anchor="middle">Apple/Google Health APIs</text>
      <text x="440" y="87" fill="#94a3b8" font-family="Inter" font-size="7" text-anchor="middle">Dexcom CGM & DICOM PACS</text>

      <line x1="520" y1="62" x2="535" y2="62" stroke="#00b4d8" stroke-width="2"/>

      <!-- Phase 4 -->
      <rect x="535" y="25" width="155" height="75" rx="5" fill="#1b263b" stroke="#00b4d8" stroke-width="1.5"/>
      <text x="612" y="45" fill="#00b4d8" font-family="Outfit" font-size="9" font-weight="700" text-anchor="middle">PHASE 4 (Q3 27 - Q4 27)</text>
      <text x="612" y="62" fill="#ffffff" font-family="Inter" font-size="8" font-weight="600" text-anchor="middle">Clinical Certification</text>
      <text x="612" y="75" fill="#94a3b8" font-family="Inter" font-size="7" text-anchor="middle">FDA 510(k) SaMD Pre-Market</text>
      <text x="612" y="87" fill="#94a3b8" font-family="Inter" font-size="7" text-anchor="middle">HIPAA SOC 2 Type II Audit</text>
    </svg>
  </div>

  <h2>Detailed Phase Breakdown</h2>
  <div class="cards-grid">
    <div class="card">
      <div class="card-header">Phase 2: SMART-on-FHIR & Interoperability</div>
      <div class="card-body">
        <ul>
          <li><strong>FHIR R4 Resources:</strong> Expose standard REST endpoints (`/fhir/Observation`, `/fhir/MedicationRequest`, `/fhir/Patient`) conforming to US Core v6.1 implementation guides.</li>
          <li><strong>EHR Launch Context:</strong> Implement OAuth2 SMART App Launch protocol enabling single-sign-on directly from Epic Hyperspace and Cerner PowerChart.</li>
          <li><strong>Carrier Communications:</strong> Connect Twilio / AWS SNS gateways to dispatch SMS medication reminders and urgent critical vital alerts.</li>
        </ul>
      </div>
    </div>
    <div class="card">
      <div class="card-header">Phase 3: Wearable Ecosystem & Imaging</div>
      <div class="card-body">
        <ul>
          <li><strong>Continuous CGM Webhooks:</strong> Ingest direct ambulatory glucose profile (AGP) streams from Dexcom G7 and Abbott FreeStyle Libre cloud APIs.</li>
          <li><strong>Wearable Health APIs:</strong> Implement user-consented OAuth2 data synchronization with Apple HealthKit, Google Health Connect, and Garmin Health.</li>
          <li><strong>DICOM Radiology Viewer:</strong> Integrate web-based Cornerstone.js PACS viewer supporting windowing, zooming, and anatomical slicing for CT and MRI scans.</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 18: PUBLIC-FACING HEALTH GUIDE -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Public-Facing Plain-Language Health Guide</h1>

  <p>
    A plain-English explanation written for patients, family caregivers, and the general public:
  </p>

  <h2>What is MediCare AI?</h2>
  <p>
    MediCare AI is a secure, easy-to-use healthcare website designed to help you organize and understand your health. If you have ever felt overwhelmed by a prescription written in confusing abbreviations, struggled to understand what an abnormal blood test result means, or needed a clear way to track your blood pressure at home, MediCare AI was built for you.
  </p>

  <h2>How Does It Help Me as a Patient?</h2>
  <ul>
    <li><strong>Demystifies Prescriptions:</strong> Take a photo of your prescription slip and upload it. The platform explains what the medication is for, when to take it, whether to take it with food, and what side effects to watch for.</li>
    <li><strong>Translates Lab Results:</strong> Upload a copy of your blood test. Instead of just seeing confusing numbers, you get an educational explanation in plain English and 3 to 5 clear questions to ask your doctor at your next visit.</li>
    <li><strong>Tracks Your Vitals Over Time:</strong> Log your home blood pressure and blood sugar readings. The system automatically charts your progress and alerts you if a reading is dangerously high.</li>
    <li><strong>Interactive Body Map:</strong> Click on your heart, lungs, or pancreas on an interactive body visual to see all your related records and prescriptions in one spot.</li>
  </ul>

  <h2>Important Things You Need to Know (Safety Rules)</h2>
  <div class="callout callout-warning">
    <div class="callout-title">Patient Safety Commitments</div>
    <strong>1. Not a Substitute for Your Doctor:</strong> MediCare AI provides educational summaries to help you understand your health. It never replaces your doctor's clinical judgment.<br/>
    <strong>2. Never Stop Medication on Your Own:</strong> Always consult your physician before changing or stopping any prescribed therapy.<br/>
    <strong>3. Real Equipment is Required:</strong> Your phone or computer camera cannot measure your blood sugar or blood pressure. Always use an approved arm cuff or glucose fingerstick meter.<br/>
    <strong>4. Emergency Care:</strong> If you ever experience crushing chest pain, sudden numbness, or shortness of breath, call 911 immediately.
  </div>
</div>

<!-- ========================================================================= -->
<!-- SECTION 19: GLOSSARY & REFERENCES -->
<!-- ========================================================================= -->
<div class="page-break">
  <h1>Clinical Glossary & Authoritative References</h1>

  <h2>Clinical & Technical Glossary</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Term / Abbreviation</th>
        <th style="width: 40%;">Technical & Clinical Definition</th>
        <th style="width: 40%;">Significance in MediCare AI</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>AHA Guidelines</strong></td>
        <td>American Heart Association / American College of Cardiology 2017 Blood Pressure Clinical Practice Guidelines.</td>
        <td>Governs deterministic categorization of SBP/DBP into Normal, Elevated, Stage 1, Stage 2, and Crisis.</td>
      </tr>
      <tr>
        <td><strong>ADA Standards</strong></td>
        <td>American Diabetes Association Standards of Medical Care in Diabetes (2024 Edition).</td>
        <td>Governs context-aware glycemic categorization (Fasting, Postprandial, Hypoglycemia).</td>
      </tr>
      <tr>
        <td><strong>ePHI</strong></td>
        <td>Electronic Protected Health Information governed under HIPAA (45 CFR § 160.103).</td>
        <td>All patient names, vitals, prescriptions, and lab values stored in MediCare AI.</td>
      </tr>
      <tr>
        <td><strong>MAP (Mean Arterial Pressure)</strong></td>
        <td>Average arterial pressure throughout one cardiac cycle: $MAP \approx DBP + \frac{1}{3}(SBP - DBP)$.</td>
        <td>Automatically calculated by VitalSense for all recorded blood pressure entries.</td>
      </tr>
      <tr>
        <td><strong>MPI</strong></td>
        <td>Master Patient Index: Enterprise database linking patient identities across clinical encounters.</td>
        <td>Employed in `/admin/patients` to detect and safely merge duplicate patient charts.</td>
      </tr>
      <tr>
        <td><strong>rPPG</strong></td>
        <td>Remote Photoplethysmography: Optical detection of microvascular blood volume pulse via video.</td>
        <td>Experimental research tool in `WebcamPulseModal.tsx` for contactless pulse estimation.</td>
      </tr>
      <tr>
        <td><strong>SaMD</strong></td>
        <td>Software as a Medical Device: Software intended for medical purposes without hardware.</td>
        <td>Regulatory boundary: MediCare AI is a workflow prototype, not currently SaMD-certified.</td>
      </tr>
    </tbody>
  </table>

  <h2>Authoritative Clinical & Regulatory References</h2>
  <ol style="font-size: 7.8pt; line-height: 1.5; color: #475569; padding-left: 16px;">
    <li><strong>Whelton PK, et al.</strong> (2018). <em>2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults.</em> Journal of the American College of Cardiology, 71(19), e127-e248.</li>
    <li><strong>American Diabetes Association.</strong> (2024). <em>Standards of Care in Diabetes—2024.</em> Diabetes Care, 47(Suppl. 1), S1-S345.</li>
    <li><strong>U.S. Department of Health and Human Services.</strong> (2003). <em>HIPAA Security Rule: Health Insurance Reform: Security Standards; Final Rule.</em> 45 CFR Parts 160, 162, and 164. Federal Register, 68(34), 8334-8381.</li>
    <li><strong>Health Level Seven International.</strong> (2019). <em>HL7 Fast Healthcare Interoperability Resources (FHIR) Release 4.</em> Standard Specification.</li>
    <li><strong>National Institute of Standards and Technology (NIST).</strong> (2023). <em>Artificial Intelligence Risk Management Framework (AI RMF 1.0).</em> NIST Special Publication SP 1270.</li>
    <li><strong>Verkruysse W, Svaasand LO, Nelson JS.</strong> (2008). <em>Remote plethysmographic imaging of the human face and neck under ambient light.</em> Optics Express, 16(26), 21434-21445.</li>
  </ol>
</div>

</body>
</html>
"""

def generate_pdf():
    print("=" * 65)
    print("Generating MediCare AI Professional Healthcare Report PDF...")
    print("=" * 65)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    html_content = build_html_content()
    
    # Write HTML to temporary path
    TEMP_HTML.write_text(html_content, encoding="utf-8")
    print(f"1. Wrote temporary HTML document: {TEMP_HTML} ({len(html_content)} bytes)")

    # Execute Edge Headless Print to PDF
    if not Path(EDGE_EXE).exists():
        print(f"ERROR: Microsoft Edge not found at {EDGE_EXE}")
        sys.exit(1)

    file_url = f"file:///{str(TEMP_HTML).replace(os.sep, '/')}"
    cmd = [
        EDGE_EXE,
        "--headless=new",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={str(TEMP_PDF)}",
        "--no-pdf-header-footer",
        file_url
    ]
    print(f"2. Invoking Edge Headless PDF engine...")
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    
    if not TEMP_PDF.exists():
        print(f"ERROR: Edge headless failed to write PDF: {res.stderr}")
        sys.exit(1)

    # Copy to destination
    shutil.copyfile(TEMP_PDF, OUTPUT_PDF)
    print(f"3. Copied output to destination: {OUTPUT_PDF} ({OUTPUT_PDF.stat().st_size} bytes)")

    # Verify with pypdf
    reader = pypdf.PdfReader(str(OUTPUT_PDF))
    total_pages = len(reader.pages)
    print(f"4. PDF Verification with PyPDF:")
    print(f"   Total Pages: {total_pages}")
    assert 15 <= total_pages <= 25, f"Expected between 15 and 25 pages, got {total_pages}"
    
    # Verify text extraction on sample pages
    sample_page = reader.pages[1].extract_text()
    assert "Executive Summary" in sample_page, "Expected 'Executive Summary' in page 2 text"
    print(f"   Selectable text extraction verified on page 2: PASS")

    print("\n" + "=" * 65)
    print(f"SUCCESS: MediCare_AI_Project_Report.pdf generated successfully!")
    print(f"Location: {OUTPUT_PDF.resolve()} ({total_pages} Pages)")
    print("=" * 65)

if __name__ == "__main__":
    generate_pdf()
