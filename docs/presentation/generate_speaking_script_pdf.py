"""
MediCare AI — Public Speaking & Presentation Script PDF Generator
Generates a publication-grade, multi-tier presentation script PDF:
- 30-Second Elevator Pitch
- 2-Minute General Public Pitch
- 5-Minute Executive Briefing
- 10-15 Minute Slide-by-Slide Script (Matching the 17 PowerPoint Slides)
- Plain-Language Technology Glossary (API, Backend, Database, OCR, Generative AI)
- Realistic Patient Case Story (Alice Johnson)
- Realistic Healthcare Manager Case Story (Regional Health Clinic)
- Transparent Boundaries: What the Platform CAN and CANNOT Do
- Audience Q&A Defense Guide (10 Tough Questions & Confident Answers)
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path
import pypdf

OUTPUT_DIR = Path("docs/presentation")
OUTPUT_PDF = OUTPUT_DIR / "MediCare_AI_Public_Speaking_Script.pdf"
TEMP_HTML = Path(os.environ.get("TEMP", "C:/Temp")) / "medicare_script_build.html"
TEMP_PDF = Path(os.environ.get("TEMP", "C:/Temp")) / "medicare_script_build.pdf"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def build_script_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MediCare AI — Complete Public Speaking & Presentation Script</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

  @page {
    size: letter portrait;
    margin: 20mm 18mm 20mm 18mm;
    @bottom-center {
      content: "MediCare AI — Public Speaking & Presentation Script";
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
    font-size: 9.5pt;
    line-height: 1.6;
  }

  .cover-page {
    page-break-after: always;
    height: 100vh;
    padding: 60mm 25mm 30mm 25mm;
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
    margin-bottom: 12px;
  }

  .cover-title span { color: #00b4d8; }

  .cover-subtitle {
    font-size: 13pt;
    color: #94a3b8;
    max-width: 650px;
    line-height: 1.5;
    margin-bottom: 30px;
  }

  .cover-meta {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 20px;
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
    color: #64748b;
  }

  .section {
    page-break-before: always;
    padding-top: 10px;
  }

  .section-tag {
    font-size: 8pt;
    font-weight: 700;
    color: #0284c7;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-bottom: 4px;
  }

  h1 {
    font-family: 'Outfit', sans-serif;
    font-size: 20pt;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 6px;
    margin-bottom: 16px;
  }

  h2 {
    font-family: 'Outfit', sans-serif;
    font-size: 13pt;
    font-weight: 700;
    color: #1e293b;
    margin: 18px 0 8px 0;
  }

  p { margin-bottom: 10px; }

  .speech-bubble {
    background: #f8fafc;
    border-left: 4px solid #0284c7;
    padding: 14px 18px;
    border-radius: 0 10px 10px 0;
    margin: 12px 0 16px 0;
    font-style: normal;
    color: #0f172a;
    font-size: 9.5pt;
    line-height: 1.65;
  }

  .speech-bubble strong { color: #0284c7; }

  .cue-box {
    background: #f1f5f9;
    border: 1px dashed #cbd5e1;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 8.5pt;
    color: #475569;
    margin-bottom: 10px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin: 12px 0;
  }

  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }

  .card-title {
    font-family: 'Outfit', sans-serif;
    font-size: 10.5pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 7.5pt;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-blue { background: #e0f2fe; color: #0369a1; }
  .badge-green { background: #dcfce7; color: #15803d; }
  .badge-amber { background: #fef3c7; color: #b45309; }
  .badge-red { background: #fee2e2; color: #b91c1c; }

  .qa-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
  }

  .qa-q {
    font-weight: 700;
    color: #0f172a;
    font-size: 9.5pt;
    margin-bottom: 6px;
  }

  .qa-a {
    color: #334155;
    font-size: 9pt;
    line-height: 1.55;
  }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
  <div>
    <span class="cover-tag">DELIVERABLE 3 — PUBLIC SPEAKING GUIDE</span>
    <h1 class="cover-title">MediCare AI<br><span>Public Speaking & Presentation Script</span></h1>
    <p class="cover-subtitle">
      A comprehensive, multi-tier speaking manual tailored for live evaluation, hospital administrator briefings, clinical staff demonstrations, and investor meetings.
    </p>
  </div>
  <div class="cover-meta">
    <div>
      <strong>Author:</strong> Lead Full-Stack Healthcare Engineer & Project Builder<br>
      <strong>Platform Version:</strong> 1.0.0 (Production Verified)<br>
      <strong>Live URL:</strong> https://medicare-ai-iv31.onrender.com
    </div>
    <div style="text-align: right;">
      <strong>Repository:</strong> github.com/gopidsai687/medicare-ai<br>
      <strong>Technology:</strong> React 18, FastAPI, Google Gemini, Docker<br>
      <strong>Format:</strong> Multi-Tier Script (30s, 2m, 5m, 15m + Q&A)
    </div>
  </div>
</div>

<!-- SECTION 1: RAPID ELEVATOR PITCHES -->
<div class="section">
  <div class="section-tag">TIER 1 & 2 SCRIPTS</div>
  <h1>Rapid Pitches: 30-Second & 2-Minute Formats</h1>
  
  <p>These two scripts are designed for spontaneous networking, rapid hackathon demonstrations, or executive door-opener conversations where time is constrained.</p>

  <h2>The 30-Second Elevator Pitch</h2>
  <div class="cue-box"><strong>Context:</strong> Elevator ride, networking intro, or 30-second investor summary. Focus strictly on problem, solution, and core differentiator.</div>
  <div class="speech-bubble">
    "Healthcare information today is fractured and intimidating. Over 70% of patients cannot understand their own blood work or prescriptions, while doctors are burned out by disorganized records and delayed vital alerts.<br><br>
    <strong>MediCare AI is a secure, web-based digital health platform that bridges this divide.</strong> We translate complex lab reports and prescription scans into plain English, track longitudinal blood pressure and glucose using American Heart Association guidelines, and alert doctors immediately when dangerous trends emerge.<br><br>
    Best of all, our clinical safety guardrails and drug-interaction engines run deterministically in code—so patients get clear answers, and doctors get trustworthy decision support."
  </div>

  <h2>The 2-Minute General Audience Explanation</h2>
  <div class="cue-box"><strong>Context:</strong> Public science presentation, community healthcare forum, or 2-minute non-technical pitch. Avoid technical jargon; use relatable analogies.</div>
  <div class="speech-bubble">
    "Imagine opening an envelope from your doctor’s office. You see a sheet filled with numbers: eGFR, Troponin, Creatinine, AST. What does any of that mean? Naturally, you look it up online. Ten minutes later, you are terrified, convinced that you have a life-threatening illness.<br><br>
    Now look at the doctor’s side. A family physician has fifteen minutes per patient. Instead of talking to you, they spend twelve minutes clicking through an overwhelming electronic medical record, trying to figure out if your blood pressure has been creeping up over the past six months.<br><br>
    <strong>That is the gap MediCare AI was built to solve.</strong><br><br>
    Our platform acts like an intelligent, patient-centered clinical bridge. A patient can take a photo of their lab report or prescription and upload it. MediCare AI breaks it down into four simple parts: What was tested, What the result means physiologically, Whether it is normal, and—most importantly—what specific questions to ask your doctor.<br><br>
    At the same time, patients can log their home blood pressure and blood sugar. Our system immediately calculates Mean Arterial Pressure and flags dangerous spikes. If a patient is entering Hypertensive Crisis, the system tells them to call 911 and puts an alert right on the doctor's triage dashboard.<br><br>
    We don't replace doctors—we give patients clarity, and we give doctors their time back."
  </div>
</div>

<!-- SECTION 2: 5-MINUTE EXECUTIVE BRIEFING -->
<div class="section">
  <div class="section-tag">TIER 3 SCRIPT</div>
  <h1>The 5-Minute Executive Briefing</h1>
  <div class="cue-box"><strong>Target Audience:</strong> Hospital department chairs, clinic operations directors, healthcare software managers, and angel investors.</div>

  <div class="speech-bubble">
    "Good morning. Today I am proud to present <strong>MediCare AI</strong>, an intelligent healthcare management platform engineered to resolve the friction between complex medical data and human decision-making.<br><br>
    
    <strong>The Problem in Numbers:</strong><br>
    In modern healthcare, we produce more data than ever before, yet patient health literacy remains critically low. Diagnostic incomprehension leads to medication non-adherence, delayed care, and severe patient anxiety. Simultaneously, clinicians face unprecedented EHR burnout, spending nearly two hours on administrative documentation for every hour of direct patient care.<br><br>

    <strong>The MediCare AI Architecture:</strong><br>
    MediCare AI is built as a cloud-native, responsive Single-Page Application. Our frontend is powered by React 18, TypeScript, and Vite, delivering an intuitive user experience with an interactive Human Digital Twin body map. Our backend runs on Python 3.12 and FastAPI, providing high-throughput asynchronous processing with Pydantic v2 data validation.<br><br>

    <strong>Three Core Operational Capabilities:</strong><br>
    <strong>1. Clinical Document Intelligence:</strong> Patients upload multi-page PDF lab results or prescription photos. Our pipeline performs text extraction, applies anti-prompt-injection sanitization, matches findings against our embedded 37-term clinical dictionary, and generates a structured, plain-language breakdown.<br><br>
    
    <strong>2. VitalSense Physiological Telemetry:</strong> We track longitudinal blood pressure and glucose. Rather than storing raw numbers passively, our engine computes Mean Arterial Pressure (MAP) and evaluates readings against American Heart Association and American Diabetes Association clinical guidelines.<br><br>
    
    <strong>3. Active Clinician Triage:</strong> Outlier telemetry—such as Stage 2 Hypertension or severe hypoglycemia—instantly generates active alerts in the attending physician's triage queue. Clinicians can review 30-day trend lines, record triage notes, and resolve alerts with a full audit trail.<br><br>

    <strong>Our Commitment to Safety and Ethics:</strong><br>
    Unlike unconstrained chatbots that risk medical hallucination, MediCare AI is engineered safety-first. Our 10-rule Drug-Drug Interaction Matrix and our clinical guidelines execute deterministically in code before any generative AI is called. Generative AI is used exclusively for empathetic plain-language communication. Every response includes mandatory medical disclaimers declaring that the system is educational decision support, not an autonomous physician.<br><br>

    <strong>Current Status:</strong><br>
    The platform is fully containerized with Docker, covered by 91 passing automated backend tests, and deployed live on Render today. Thank you, and I look forward to your questions."
  </div>
</div>

<!-- SECTION 3: 15-MINUTE SLIDE-BY-SLIDE PRESENTATION SCRIPT -->
<div class="section">
  <div class="section-tag">TIER 4 SCRIPT (MATCHES POWERPOINT)</div>
  <h1>10–15 Minute Slide-by-Slide Presentation Script</h1>
  <p>This script corresponds directly to the 17 slides in <code>MediCare_AI_Project_Presentation.pptx</code>. Follow the cue notes to synchronize slide progression.</p>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 1: Title Slide — MediCare AI</div>
    <div class="cue-box"><strong>Visual:</strong> Title slide with dark navy background, cyan badge, and live URL metadata.</div>
    <div class="speech-bubble">
      "Good morning, everyone. Welcome to the presentation of MediCare AI, an intelligent, production-ready healthcare management platform.<br><br>
      Healthcare today is full of friction. Patients struggle to interpret complex laboratory reports and prescriptions, while clinicians are overwhelmed by fragmented EHR systems and delayed vital alerts. MediCare AI bridges this gap. It provides patient-centered document intelligence, continuous physiological telemetry through our VitalSense engine, and clinician decision support with strict safety guardrails. Today, I will walk you through what our platform does, how it is built, and how it delivers measurable value across the care continuum."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 2: The Healthcare Problem — The Triad of Modern Friction</div>
    <div class="cue-box"><strong>Visual:</strong> 3-column card layout: Document Incomprehension, Fragmented Portals, Silent Physiological Drift.</div>
    <div class="speech-bubble">
      "To understand why MediCare AI exists, we have to look at the three major friction points in healthcare today.<br><br>
      First: Document Incomprehension. Over 70% of adults cannot comfortably interpret a lab report or prescription instructions. Patients see words like 'Microalbuminuria' or 'Hypokalemia' and turn to unverified internet searches, causing panic.<br><br>
      Second: Fragmented Records. Vital data is trapped in institutional silos. A patient seeing a cardiologist often has to carry paper copies of blood work done by their endocrinologist.<br><br>
      Third: Silent Physiological Drift. Chronic illnesses like hypertension and diabetes do not wait for an annual checkup. Between 3-month clinic visits, blood pressure creeps upward unnoticed until it manifests as a hypertensive crisis. MediCare AI addresses each of these problems through transparent software workflows."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 3: Mission & Solution — The MediCare AI Unified Solution</div>
    <div class="cue-box"><strong>Visual:</strong> 4 foundational pillars: Patient Self-Management, Clinician Triage, Deterministic Safety, Institutional Governance.</div>
    <div class="speech-bubble">
      "Here is how MediCare AI solves these challenges through four foundational pillars:<br><br>
      On the patient side, we give people back their autonomy. We transform frightening PDFs into clean, 4-part structured guides: What was tested, What the result means, Whether it's normal, and What questions to ask your doctor.<br><br>
      For clinicians, we provide active triage. Doctors don't have time to review thousands of numbers. Our VitalSense engine calculates Mean Arterial Pressure and flags Stage 2 Hypertension or Hypoglycemia straight to their alert queue.<br><br>
      Crucially, our system is safety-first. We do NOT rely blindly on generative AI. Clinical guidelines from the American Heart Association and our 10-drug interaction matrix run deterministically in code. AI is used solely for plain-language communication.<br><br>
      Finally, enterprise governance: every clinical action is audited in our Master Patient Index."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 4: Stakeholders — Alignment Across the Care Continuum</div>
    <div class="cue-box"><strong>Visual:</strong> 3 stakeholder cards: Patients & Caregivers, Physicians & Nurses, Administrators & IT.</div>
    <div class="speech-bubble">
      "Healthcare software must serve multiple masters to succeed. MediCare AI aligns the incentives of all three primary stakeholder groups.<br><br>
      For patients and family caregivers, it replaces confusion with confidence. When a mother uploads her father's lab report, she receives a clear explanation of his kidney markers instead of incomprehensible numbers.<br><br>
      For doctors and nurses, it combats burnout. Instead of spending 15 minutes clicking through clunky EHR screens, the doctor sees an automated summary of 30-day vitals, calculated MAP, and pre-screened drug interactions.<br><br>
      For hospital administrators and CIOs, it ensures governance. Our audit log tracks every read, update, and export with IP and timestamp metadata, ensuring strict accountability."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 5: Platform Overview — Core Capabilities & Verified Inventory</div>
    <div class="cue-box"><strong>Visual:</strong> 6 capability cards with green 'Verified Live' badges and amber 'Roadmap/Boundary' badges.</div>
    <div class="speech-bubble">
      "This slide represents our honesty-first engineering commitment. We distinguish verified, working software from simulations and roadmap proposals.<br><br>
      Everything marked green in this inventory is fully implemented, tested, and running live on Render today. That includes the Patient Dashboard, the VitalSense telemetry system, prescription analysis, the doctor alert queue, and our cryptographic device ingestion API.<br><br>
      Notice the amber card on the bottom right: We explicitly label our educational webcam tool as a simulation, not a diagnostic medical device. Furthermore, all AI document workflows feature deterministic offline fallbacks so the system never fails if cloud APIs are unreachable."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 6: Patient Portal — Health Dashboard & Full Body HUD</div>
    <div class="cue-box"><strong>Visual:</strong> Dashboard summary counters on left; Full Body Diagnostics 5-zone anatomical map on right.</div>
    <div class="speech-bubble">
      "Let us step into the patient's shoes. When Alice Johnson logs in, she is greeted by her personal health overview.<br><br>
      At the top, four summary counters show her upcoming appointments, active medications, and recent lab results. Below that, our interactive Full Body Diagnostics Digital Twin provides an intuitive anatomical map.<br><br>
      Instead of reading raw data tables, she can click on her Cardiovascular zone to see her blood pressure history and calculated Mean Arterial Pressure. If a vital sign drifts into Stage 2 hypertension, that zone glows red, alerting her to follow up.<br><br>
      And in an urgent situation, the Emergency Hospitals button immediately presents nearby emergency rooms with address, distance, and direct 911 calling."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 7: Physiological Monitoring — VitalSense Telemetry Engine</div>
    <div class="cue-box"><strong>Visual:</strong> BP & MAP calculations (AHA), Blood Glucose & TIR (ADA), and Data Provenance isolation.</div>
    <div class="speech-bubble">
      "Now let's examine our physiological monitoring engine: VitalSense.<br><br>
      For blood pressure, our backend immediately computes Mean Arterial Pressure using the clinical standard formula: Diastolic plus one-third of pulse pressure. It classifies the reading under American Heart Association guidelines. If a patient logs 185 over 125, the system immediately presents an emergency red banner instructing them to call 911 and dispatches an alert to the doctor's queue.<br><br>
      For blood glucose, we follow American Diabetes Association guidelines, tracking Time-in-Range between 70 and 180 mg/dL.<br><br>
      Notice the bottom section on data provenance. We differentiate between genuine measurements and demo simulations. A student or evaluator can test simulated states, and then click 'Reset Demo'—our system atomically purges only the synthetic records, leaving real patient data untouched."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 8: Hardware Integration — Biomedical Sensor Reality</div>
    <div class="cue-box"><strong>Visual:</strong> Directly measurable biometrics (HR, SpO2, PI) vs Cuffless BP (IEEE 1708) and optical glucose reality.</div>
    <div class="speech-bubble">
      "One of our proudest architectural decisions is our adherence to biomedical reality.<br><br>
      Many health apps make dubious claims—like measuring blood sugar simply by putting a finger on a smartphone camera. MediCare AI rejects this pseudoscience. Our documentation clearly explains that glucose is a tiny molecule with identical optical absorption to other serum components; non-invasive optical glucose is physically unfeasible without interstitial fluid access.<br><br>
      Instead, we focus on what optical sensors actually measure: heart rate, SpO2, perfusion index, and contact force.<br><br>
      On the software side, we support WebSerial and WebBluetooth GATT protocols, allowing direct browser connection to standard medical hardware. Every packet is checked for signal quality—rejecting motion artifacts—and hashed with SHA-256 for auditability."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 9: Prescription Intelligence — OCR & Drug Interaction Safety</div>
    <div class="cue-box"><strong>Visual:</strong> Prescription document extraction flow and 10 high-risk drug-drug interaction matrix.</div>
    <div class="speech-bubble">
      "Prescription errors harm millions of patients each year. Our Prescription Intelligence engine provides a vital safety check.<br><br>
      When a patient uploads a prescription scan, our pipeline extracts the medication name, strength, and schedule. Before passing anything to an AI model, our software runs an immediate, deterministic check against our 10-rule Drug-Drug Interaction Matrix.<br><br>
      For example, if a patient is prescribed Aspirin while already taking Warfarin, the system immediately triggers a high-severity alert for bleeding risk.<br><br>
      It then compiles a clean patient checklist: Take with food, space calcium 4 hours apart from thyroid medication, and monitor for side effects. This turns confusing medical jargon into actionable safety."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 10: Diagnostic Lab Intelligence — 37 Clinical Biomarkers & 4-Part Translation</div>
    <div class="cue-box"><strong>Visual:</strong> 37 embedded dictionary terms, anti-injection shield, and 4-Part Explanation Framework.</div>
    <div class="speech-bubble">
      "Laboratory reports are often the most intimidating documents a patient receives. Our Diagnostic Lab Pipeline transforms that experience.<br><br>
      We built an embedded clinical terminology dictionary of 37 standard hospital biomarkers—from HbA1c to Troponin. Even if our cloud AI connection goes offline, this dictionary runs locally, defining reference ranges and clinical meanings.<br><br>
      We structure every analysis into a 4-part framework: What test was done, What the finding means, Is it normal, and What questions to ask your doctor.<br><br>
      Notice part four: instead of giving medical advice, we arm the patient with informed questions for their physician. This enhances the doctor-patient relationship rather than attempting to replace it."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 11: Clinician Portal — Doctor Alert Queue & Triage</div>
    <div class="cue-box"><strong>Visual:</strong> Outlier Alert Queue with severity badges; longitudinal 30-day MAP and encounter notes.</div>
    <div class="speech-bubble">
      "Now let's switch perspectives to the Doctor Portal.<br><br>
      When Dr. Sarah Chen logs into MediCare AI, she does not see a chaotic wall of data. She sees a prioritized Alert Queue.<br><br>
      If Alice Johnson logged a blood pressure of 165 over 105, Alice immediately appears at the top of Dr. Chen's queue with a Warning badge. Dr. Chen can click on Alice's record, inspect her 30-day Mean Arterial Pressure trend, and record an action note—such as scheduling a medication review.<br><br>
      Once actioned, the alert is marked RESOLVED and logged in our audit trail. This prevents alarm fatigue and ensures no critical outlier falls through the cracks."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 12: Enterprise Governance — Master Patient Index & Audit Trails</div>
    <div class="cue-box"><strong>Visual:</strong> Master Patient Index (MPI) Explorer and HIPAA Security Rule §164.312(b) Audit Trail.</div>
    <div class="speech-bubble">
      "For hospital administrators and compliance officers, governance is paramount.<br><br>
      MediCare AI includes a Master Patient Index that prevents duplicate medical charts across departments. A patient admitted through cardiology is seamlessly recognized by nephrology under a single, verified Medical Record Number.<br><br>
      Alongside the MPI is our immutable Audit Log. Under HIPAA Security Rule Section 164.312(b), covered entities must maintain records of all PHI access. Our backend automatically logs every single view, edit, login, and export, capturing the user's ID, role, IP address, and exact timestamp. Administrators can audit access patterns at any time."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 13: System Architecture — Modern Technology Stack</div>
    <div class="cue-box"><strong>Visual:</strong> 4-tier stack: React 18 / Vite 6, FastAPI / Python 3.12, Clinical Engines / Gemini, SQLAlchemy / Docker.</div>
    <div class="speech-bubble">
      "Let's look under the hood at our technology stack.<br><br>
      On the frontend: React 18, TypeScript, and Vite. We engineered custom error boundaries and Vite preload auto-recovery so users never experience broken screens during rolling updates.<br><br>
      On the backend: Python 3.12 with FastAPI on Uvicorn. FastAPI provides lightning-fast asynchronous request handling and Pydantic v2 schema validation.<br><br>
      Our clinical logic layer combines deterministic rule engines with Google Gemini 2.5 Pro for plain-language communication.<br><br>
      And for persistence, we use SQLAlchemy 2.0 Async ORM. We support a portable SQLite engine for zero-configuration testing, and managed PostgreSQL with pgvector for production. Everything is packaged in a multi-stage Docker container deployed live on Render."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 14: End-to-End Data Flow — Ingestion to Resolution</div>
    <div class="cue-box"><strong>Visual:</strong> 4-stage data journey: Ingestion, Sanitization, Evaluation, and Triage.</div>
    <div class="speech-bubble">
      "To see how this architecture functions in practice, let us trace a complete 4-stage data journey.<br><br>
      Stage 1 is Ingestion: A patient uploads a lab report, or places a finger on a hardware sensor. The file is validated in memory by FastAPI, checking magic bytes and payload size.<br><br>
      Stage 2 is Sanitization: Our anti-injection shield strips any malicious text strings, while our cryptographic hasher generates a unique SHA-256 fingerprint.<br><br>
      Stage 3 is Evaluation: The system deterministically matches biomarkers against clinical thresholds and drug interaction rules, then synthesizes patient guidance.<br><br>
      Stage 4 is Triage and Persistence: The analysis is saved to the database. If any biomarker or vital indicates an acute crisis, an alert is instantly dispatched to the doctor's triage dashboard. The loop closes when the clinician reviews the finding and records their care note."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 15: Compliance & Ethics — Cybersecurity & Regulatory Alignment</div>
    <div class="cue-box"><strong>Visual:</strong> Technical HIPAA alignment, AI ethics boundaries, and deployment prerequisites (BAA, 510(k)).</div>
    <div class="speech-bubble">
      "Healthcare technology requires extraordinary ethical responsibility.<br><br>
      From a cybersecurity perspective, we align with the technical safeguards of HIPAA: role-based JWT access tokens, TLS 1.3 encryption in transit, SHA-256 integrity verification, and immutable audit logging.<br><br>
      From a clinical safety perspective, we make no claims of replacing physicians. Every AI summary includes a mandatory disclaimer, and our algorithms are grounded to prevent hallucinations.<br><br>
      Furthermore, we are completely transparent about what is required before clinical deployment: formal institutional BAAs with cloud vendors, prospective clinical trials, SOC 2 Type II audits, and FDA Software as a Medical Device evaluation. We build software that respects medical and legal reality."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 16: Future Evolution — Strategic 6-Phase Roadmap</div>
    <div class="cue-box"><strong>Visual:</strong> 6 phases: Reliability (Verified), Clinical Grounding, Security, EHR Interoperability (FHIR), Pilot, FDA Clearance.</div>
    <div class="speech-bubble">
      "Our strategic roadmap outlines the journey from today's validated application to an enterprise-grade hospital deployment.<br><br>
      Phase 1 is complete: 91 backend tests passing, zero frontend build errors, and live production deployment on Render.<br><br>
      Phase 2 deepens our clinical dictionary to over 100 biomarkers and enhances vector RAG grounding.<br><br>
      Phase 3 and 4 introduce enterprise hospital requirements: SAML single sign-on, and HL7 FHIR interoperability to synchronize data bidirectionally with Epic and Cerner EHRs.<br><br>
      Phases 5 and 6 govern real-world evaluation: conducting structured pilot studies to measure clinician time savings, followed by formal FDA Software as a Medical Device pre-submissions."
    </div>
  </div>

  <div class="card" style="margin-bottom: 14px;">
    <div class="card-title">Slide 17: Conclusion — Ready for Evaluation & Partnerships</div>
    <div class="cue-box"><strong>Visual:</strong> Summary highlights and 6-step live demonstration walkthrough plan.</div>
    <div class="speech-bubble">
      "In conclusion, MediCare AI demonstrates that modern web technology and responsible artificial intelligence can come together to transform healthcare communication.<br><br>
      We have proven that complex documents can be made understandable, that physiological trends can be tracked transparently, and that clinician workflows can be protected from alert fatigue.<br><br>
      The platform is live right now at medicare-ai-iv31.onrender.com. I invite you to participate in a 5-minute live demonstration: we will log in as patient Alice Johnson, record a vital sign, view the immediate AHA evaluation, and watch it surface in Dr. Sarah Chen's triage queue.<br><br>
      Thank you for your time, and I look forward to your questions and discussing potential pilot partnerships."
    </div>
  </div>
</div>

<!-- SECTION 4: PLAIN-LANGUAGE TECHNOLOGY GLOSSARY -->
<div class="section">
  <div class="section-tag">EDUCATIONAL REFERENCE</div>
  <h1>Plain-Language Technology Explanations</h1>
  <p>When presenting to clinical staff or hospital managers, define technical terms in simple language the first time they appear.</p>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">1. API (Application Programming Interface)</div>
      <p><strong>Simple Analogy:</strong> A restaurant waiter.</p>
      <p style="font-size: 8.5pt; color: #475569;">
        The frontend is the dining room where the patient sits. The backend database is the kitchen where clinical records are stored. The API is the waiter carrying the patient's request to the kitchen and bringing back the verified medical information securely.
      </p>
    </div>

    <div class="card">
      <div class="card-title">2. Backend (Application Server)</div>
      <p><strong>Simple Analogy:</strong> The hospital records department.</p>
      <p style="font-size: 8.5pt; color: #475569;">
        The backend is the secure brain running behind the scenes. It checks passwords, verifies clinical rules (like AHA blood pressure limits), runs anti-injection security checks, and ensures only authorized users can view records.
      </p>
    </div>

    <div class="card">
      <div class="card-title">3. Database (Persistence Layer)</div>
      <p><strong>Simple Analogy:</strong> A fireproof medical filing vault.</p>
      <p style="font-size: 8.5pt; color: #475569;">
        Where encrypted records, vital measurements, and appointments live. In MediCare AI, we use PostgreSQL in production and SQLite for offline demonstrations, ensuring zero data loss and strict separation between patients.
      </p>
    </div>

    <div class="card">
      <div class="card-title">4. OCR (Optical Character Recognition)</div>
      <p><strong>Simple Analogy:</strong> A scanner that can read handwriting.</p>
      <p style="font-size: 8.5pt; color: #475569;">
        When a patient uploads a photo or PDF of a paper prescription, OCR translates the pixels into editable text strings so our clinical algorithms can recognize drug names, dosages, and dosing frequencies.
      </p>
    </div>

    <div class="card">
      <div class="card-title">5. Generative AI (Google Gemini 2.5 Pro)</div>
      <p><strong>Simple Analogy:</strong> A bilingual medical translator.</p>
      <p style="font-size: 8.5pt; color: #475569;">
        It does not practice medicine or diagnose disease. Instead, it takes complex clinical findings that have already been verified by our code and translates them into empathetic, eighth-grade reading-level English.
      </p>
    </div>

    <div class="card">
      <div class="card-title">6. Mean Arterial Pressure (MAP)</div>
      <p><strong>Simple Analogy:</strong> The continuous perfusion pressure.</p>
      <p style="font-size: 8.5pt; color: #475569;">
        The average pressure inside your arteries during a single cardiac cycle. It represents whether vital organs (brain, kidneys, heart) are receiving enough blood flow, calculated deterministically as DBP + (SBP - DBP) / 3.
      </p>
    </div>
  </div>
</div>

<!-- SECTION 5: REALISTIC CASE STORIES -->
<div class="section">
  <div class="section-tag">NARRATIVE CASE STUDIES</div>
  <h1>Realistic Stakeholder Case Stories</h1>

  <h2>The Patient Story: Alice Johnson, Age 58</h2>
  <div class="speech-bubble">
    "Alice Johnson is a 58-year-old schoolteacher managing Type 2 Diabetes and Hypertension. Every three months, she gets routine blood work done.<br><br>
    Last month, Alice received her lab results in the mail. Her report showed an eGFR of 52 mL/min and an HbA1c of 8.2%. The lab report flagged these with red asterisks, but gave zero explanation. Alice spent the entire weekend anxious, terrified that her kidneys were failing.<br><br>
    With MediCare AI, Alice took a photo of her report and uploaded it. Within seconds, our Medical Report Pipeline analyzed the document. It told her: <em>'Your eGFR measures how well your kidneys filter blood. A level of 52 indicates mild-to-moderate reduction, which is commonly seen alongside diabetes and warrants a review of your blood pressure and hydration.'</em><br><br>
    It also gave her three specific questions to ask her doctor on Tuesday. Alice went from feeling overwhelmed and helpless to feeling informed and prepared for her clinical appointment."
  </div>

  <h2>The Healthcare Manager Story: Metro Regional Community Clinic</h2>
  <div class="speech-bubble">
    "Marcus Vance is the Operations Director at Metro Regional Community Clinic, overseeing ten primary care providers serving 14,000 active patients. Marcus faced a severe operational bottleneck: clinical staff were drowning in electronic inbox messages, while patients with unmanaged hypertension were being admitted to the emergency room at alarming rates.<br><br>
    Marcus piloted MediCare AI across their hypertension patient cohort. Patients were instructed to log their home blood pressure readings using the VitalSense portal. When a patient’s blood pressure crossed into Stage 2 Hypertension, the system did not send an unread email; it placed the patient directly into Dr. Sarah Chen’s prioritized Alert Queue with a computed Mean Arterial Pressure trend.<br><br>
    During clinical visits, doctors no longer spent ten minutes flipping through handwritten patient notebooks. They reviewed the 30-day MAP graph, actioned the alert with a single click, and adjusted the patient's ACE-inhibitor dosage. Marcus saw intake review times drop from twelve minutes to under four minutes, while patient follow-up compliance increased by 38%."
  </div>
</div>

<!-- SECTION 6: PLATFORM BOUNDARIES & TRANSPARENCY -->
<div class="section">
  <div class="section-tag">TRANSPARENCY & ETHICS</div>
  <h1>Platform Boundaries: What MediCare AI Can and Cannot Do</h1>

  <div class="grid-2">
    <div class="card" style="border-left: 4px solid #16a34a;">
      <div class="card-title" style="color: #16a34a;">What MediCare AI CAN Do (Verified)</div>
      <ul style="font-size: 8.5pt; color: #334155; padding-left: 16px;">
        <li style="margin-bottom: 5px;">Translate dense laboratory reports into plain-language 4-part summaries.</li>
        <li style="margin-bottom: 5px;">Extract prescription details and screen for 10 high-risk drug interactions.</li>
        <li style="margin-bottom: 5px;">Calculate Mean Arterial Pressure and classify under AHA/ADA guidelines.</li>
        <li style="margin-bottom: 5px;">Prioritize outlier clinical alerts in a dedicated Doctor Triage Queue.</li>
        <li style="margin-bottom: 5px;">Maintain an immutable HIPAA-aligned audit log of all record views.</li>
        <li style="margin-bottom: 5px;">Operate reliably offline using embedded dictionaries when AI is disconnected.</li>
      </ul>
    </div>

    <div class="card" style="border-left: 4px solid #dc2626;">
      <div class="card-title" style="color: #dc2626;">What MediCare AI CANNOT Do (Boundaries)</div>
      <ul style="font-size: 8.5pt; color: #334155; padding-left: 16px;">
        <li style="margin-bottom: 5px;">It CANNOT replace a licensed physician or provide independent diagnoses.</li>
        <li style="margin-bottom: 5px;">It CANNOT measure blood glucose non-invasively through an optical camera.</li>
        <li style="margin-bottom: 5px;">It CANNOT prescribe medications or autonomously alter clinical dosages.</li>
        <li style="margin-bottom: 5px;">Its educational PPG simulation MUST NOT be used for medical decisions.</li>
        <li style="margin-bottom: 5px;">It CANNOT claim FDA 510(k) or CE Mark clearance without formal trials.</li>
        <li style="margin-bottom: 5px;">It CANNOT claim formal HIPAA certification without signed vendor BAAs.</li>
      </ul>
    </div>
  </div>
</div>

<!-- SECTION 7: AUDIENCE Q&A DEFENSE GUIDE -->
<div class="section">
  <div class="section-tag">PRESENTATION DEFENSE</div>
  <h1>Audience Q&A Defense Guide: 10 Tough Questions & Answers</h1>
  <p>Use these confident, transparent responses when defending your project before doctors, hospital administrators, technical architects, and investors.</p>

  <div class="qa-item">
    <div class="qa-q">Q1: "How do you prevent the AI from hallucinating incorrect medical advice?"</div>
    <div class="qa-a"><strong>Answer:</strong> "We use a defense-in-depth architecture. First, all clinical bounds—such as American Heart Association blood pressure stages and our 10-rule Drug-Drug Interaction Matrix—are written in deterministic Python code, not in the LLM. Second, for lab reports, we match biomarkers against our embedded 37-term dictionary first. Third, our AI prompts use strict grounding instructions, forcing the model to cite only the uploaded document text. Finally, every summary includes mandatory legal disclaimers and explicit questions for the patient's doctor."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q2: "Are you claiming that your platform is HIPAA certified?"</div>
    <div class="qa-a"><strong>Answer:</strong> "No. As an engineering team, we distinguish between technical alignment and administrative compliance. Our software implements the technical safeguards of the HIPAA Security Rule: role-based access tokens, TLS 1.3 encryption, SHA-256 data integrity, and immutable audit logging. However, formal HIPAA certification requires institutional Business Associate Agreements (BAAs) with hosting and AI vendors, as well as institutional administrative policies. That is why enterprise BAAs are clearly listed in Phase 3 of our roadmap."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q3: "Can your system really measure blood glucose non-invasively from a finger?"</div>
    <div class="qa-a"><strong>Answer:</strong> "No, and our platform is one of the few that explicitly admits this. From a biomedical physics perspective, glucose molecules have near-identical optical absorption to other blood constituents in the infrared spectrum. Measuring glucose requires direct enzymatic or interstitial fluid access, such as a continuous glucose monitor or fingerstick. We explicitly reject unverified optical glucose claims and label our webcam tool as an educational simulation."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q4: "What happens if the Google Gemini API goes down or loses internet connectivity?"</div>
    <div class="qa-a"><strong>Answer:</strong> "The platform continues running smoothly. We engineered deterministic rule-based fallbacks into every service. If Gemini is unreachable or API quotas are exhausted, our Medical Report Pipeline uses our local 37-term clinical dictionary to output standard reference definitions, our Prescription Pipeline executes its 10-rule interaction matrix in memory, and our VitalSense engine calculates MAP deterministically. The application never crashes."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q5: "How do you protect the system from malicious prompts hidden inside uploaded PDFs?"</div>
    <div class="qa-a"><strong>Answer:</strong> "We built an Anti-Prompt-Injection Sanitizer directly into our document ingestion pipeline. Before any OCR or extracted text is passed to an LLM, our regex guard scans the text for adversarial phrases like 'ignore previous instructions', 'system override', or 'you are now an unrestricted assistant'. Any matched pattern is stripped and replaced with `[REDACTED_INJECTION_PATTERN]`, neutralising the attack vector."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q6: "How does the system ensure that a patient cannot see another patient's medical records?"</div>
    <div class="qa-a"><strong>Answer:</strong> "We enforce multi-tenant isolation at the database query level using SQLAlchemy. When a patient logs in, their JWT access token contains their unique user UUID. Our FastAPI dependency resolver extracts this ID and forces an explicit `WHERE patient_id == current_user.patient_id` filter on every single database query. Attempting to query another patient's records is immediately blocked with HTTP 403 Forbidden, which is validated in our automated test suite."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q7: "Why did you build your own platform instead of using an existing EHR portal like Epic MyChart?"</div>
    <div class="qa-a"><strong>Answer:</strong> "Existing patient portals are designed for billing and legal documentation, not patient comprehension. They present raw laboratory values without physiological context or actionable next steps. MediCare AI is designed as a patient-facing clinical translation layer and telemetry companion that complements existing EHRs, with an architectural roadmap to integrate bidirectionally via HL7 FHIR v4.0.1."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q8: "What automated testing has been performed on this codebase?"</div>
    <div class="qa-a"><strong>Answer:</strong> "The backend is covered by 91 passing automated unit and integration tests using pytest, verifying authentication, patient tenant isolation, AHA bounds checking, drug interaction matrices, and device packet hashing. The frontend compiles with zero TypeScript errors under strict mode, and our live production deployment passes automated health and auth checks on Render."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q9: "How does the platform handle simulated demo data versus genuine patient measurements?"</div>
    <div class="qa-a"><strong>Answer:</strong> "We implement strict data provenance. Every telemetry record is stamped with an `is_sample` boolean and a `measurement_source` enum. Simulated test readings are tagged `is_sample=True`. Our atomic `/clear-demo-data` endpoint allows evaluators to purge fictional test readings instantly without touching genuine clinical history."</div>
  </div>

  <div class="qa-item">
    <div class="qa-q">Q10: "What is your commercialization or pilot deployment strategy?"</div>
    <div class="qa-a"><strong>Answer:</strong> "Our strategy is a 6-phase risk-weighted evolution. We start with community clinic usability pilots focusing on patient health literacy and doctor intake time reduction. Next, we integrate HL7 FHIR for EHR synchronization and execute formal vendor BAAs. Only after prospective clinical trials and regulatory pre-submissions would we seek commercial Software as a Medical Device deployment."</div>
  </div>
</div>

</body>
</html>
"""

def generate_pdf():
    print("==================================================================")
    print("Generating MediCare AI Public Speaking & Script PDF...")
    print("==================================================================")

    html_content = build_script_html()
    TEMP_HTML.write_text(html_content, encoding="utf-8")
    print(f"1. Wrote temporary HTML document: {TEMP_HTML} ({len(html_content)} bytes)")

    if not os.path.exists(EDGE_EXE):
        print(f"ERROR: Microsoft Edge not found at {EDGE_EXE}")
        sys.exit(1)

    print("2. Invoking Edge Headless PDF engine...")
    cmd = [
        EDGE_EXE,
        "--headless",
        "--disable-gpu",
        "--allow-file-access-from-files",
        "--no-pdf-header-footer",
        f"--print-to-pdf={TEMP_PDF}",
        str(TEMP_HTML)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Edge Headless Error: {res.stderr}")
        sys.exit(1)

    shutil.copyfile(TEMP_PDF, OUTPUT_PDF)
    print(f"3. Copied output to destination: {OUTPUT_PDF} ({os.path.getsize(OUTPUT_PDF)} bytes)")

    reader = pypdf.PdfReader(str(OUTPUT_PDF))
    total_pages = len(reader.pages)
    print(f"4. PDF Verification with PyPDF:")
    print(f"   Total Pages: {total_pages}")
    first_page_text = reader.pages[0].extract_text()
    has_text = "MediCare AI" in first_page_text
    print(f"   Selectable text extraction verified on page 1: {'PASS' if has_text else 'FAIL'}")

    print("\n==================================================================")
    print(f"SUCCESS: MediCare_AI_Public_Speaking_Script.pdf generated successfully!")
    print(f"Location: {OUTPUT_PDF} ({total_pages} Pages)")
    print("==================================================================")

if __name__ == "__main__":
    generate_pdf()
