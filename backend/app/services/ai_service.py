"""
AI Clinical Assistant Service — Google Gemini Integration with Clinical Decision Support & RAG.
Includes:
  - Gemini 2.5 Pro generative AI (async)
  - text-embedding-004 for pgvector-powered RAG over clinical documents
  - Drug interaction screening knowledge base (10 critical pairs)
  - Intelligent clinical reasoning fallback when API key not configured
"""
from __future__ import annotations

import asyncio
import hashlib
from typing import Any, Dict, List, Optional, Tuple

try:
    import structlog
    log = structlog.get_logger(__name__)
except ImportError:
    import logging
    log = logging.getLogger(__name__)

from app.core.config import settings

EMBEDDING_DIM = 768

# ── System Prompts ────────────────────────────────────────────────────────────

PATIENT_SYSTEM_PROMPT = """You are MediCare Clinical AI Assistant — a compassionate, evidence-based healthcare guide embedded within a secure patient portal.

Guidelines:
1. Explain medical terms, lab results, medications, and diagnoses in plain, accessible language.
2. Reference the patient's actual health records when provided in context; personalise every response.
3. ALWAYS include the disclaimer that your answers are educational and do not replace personalised physician evaluation.
4. If ANY red-flag symptoms are mentioned (crushing chest pain, sudden numbness, acute dyspnea, signs of stroke), IMMEDIATELY advise the patient to call 911 or go to the nearest emergency room.
5. Never suggest stopping prescribed medications without physician guidance.
6. Use markdown formatting (bullet lists, **bold** for key terms, tables) to organise complex answers.

You have access to relevant excerpts from the patient's medical records. Use them to ground your answers."""

DOCTOR_SYSTEM_PROMPT = """You are MediCare Clinical Decision Support AI — assisting licensed healthcare providers in a HIPAA-compliant clinical environment.

Guidelines:
1. Use professional medical terminology: ICD-10 codes, pharmacological nomenclature, evidence-based clinical guidelines (AHA/ACC, ADA, USPSTF).
2. Assist with differential diagnosis, evidence-based treatment protocols, drug interaction screening, and renal/hepatic dosing adjustments.
3. Highlight contraindications, black-box warnings, and patient-safety flags prominently.
4. When RAG context from the patient chart is provided, analyse it and surface relevant clinical patterns or discrepancies.
5. Format responses with clinical precision: use structured sections (Assessment, Plan, Monitoring, References) where appropriate."""


class AIService:
    """
    Unified AI service providing:
      - Multi-turn clinical chat (Gemini API or intelligent fallback)
      - Document embedding for RAG ingestion into pgvector
      - Semantic query embedding for retrieval
      - Drug interaction screening
    """

    def __init__(self) -> None:
        self.api_key: str = settings.GEMINI_API_KEY
        self.model_name: str = settings.GEMINI_MODEL or "gemini-2.5-pro"
        self._genai: Any = None
        self._chat_model: Any = None
        self._embed_model_name: str = "models/text-embedding-004"

        if self.api_key:
            try:
                import google.generativeai as genai  # type: ignore
                genai.configure(api_key=self.api_key)
                self._genai = genai
                self._chat_model = genai.GenerativeModel(
                    self.model_name,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=settings.GEMINI_MAX_TOKENS,
                        temperature=0.3,
                        top_p=0.9,
                    ),
                )
                log.info("Gemini AI client initialised", model=self.model_name)
            except Exception as exc:
                log.warning("Failed to configure Gemini client", error=str(exc))
        else:
            log.info("GEMINI_API_KEY not configured — operating in clinical reasoning fallback mode")

    # ── Embedding ──────────────────────────────────────────────────────────────

    async def embed_text(self, text: str) -> List[float]:
        """Generate a 768-dim embedding for document ingestion via text-embedding-004."""
        if not self._genai:
            return self._pseudo_embed(text)
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self._genai.embed_content(
                    model=self._embed_model_name,
                    content=text,
                    task_type="RETRIEVAL_DOCUMENT",
                ),
            )
            return result["embedding"]
        except Exception as exc:
            log.warning("Embedding generation failed", error=str(exc))
            return self._pseudo_embed(text)

    async def embed_query(self, query: str) -> List[float]:
        """Generate a query-optimised embedding for semantic retrieval."""
        if not self._genai:
            return self._pseudo_embed(query)
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self._genai.embed_content(
                    model=self._embed_model_name,
                    content=query,
                    task_type="RETRIEVAL_QUERY",
                ),
            )
            return result["embedding"]
        except Exception as exc:
            log.warning("Query embedding failed", error=str(exc))
            return self._pseudo_embed(query)

    def _pseudo_embed(self, text: str) -> List[float]:
        """Deterministic pseudo-embedding for local dev without API key. NOT semantically meaningful."""
        h = hashlib.sha256(text.encode()).digest()
        extended = (h * (EMBEDDING_DIM // len(h) + 1))[:EMBEDDING_DIM]
        return [(b - 127.5) / 127.5 for b in extended]

    # ── Chat ───────────────────────────────────────────────────────────────────

    async def chat(
        self,
        messages: List[Dict[str, str]],
        role: str = "patient",
        patient_context: Optional[Dict[str, Any]] = None,
        rag_chunks: Optional[List[str]] = None,
    ) -> str:
        """
        Process a multi-turn clinical chat interaction.

        Args:
            messages:        Conversation history [{role, content}, ...]
            role:            Caller's role (patient | doctor | nurse | admin)
            patient_context: Structured patient summary for grounding
            rag_chunks:      Retrieved medical record excerpts from pgvector
        Returns:
            AI-generated clinical response (markdown formatted).
        """
        system_prompt = DOCTOR_SYSTEM_PROMPT if role in ("doctor", "nurse") else PATIENT_SYSTEM_PROMPT
        context_parts: List[str] = []

        if patient_context:
            ctx_lines = [
                f"Patient: {patient_context.get('name', 'Unknown')}",
                f"MRN: {patient_context.get('mrn', 'N/A')}",
                f"Blood Type: {patient_context.get('blood_type', 'Unknown')}",
            ]
            if patient_context.get("diagnoses"):
                ctx_lines.append(f"Active Diagnoses: {', '.join(patient_context['diagnoses'])}")
            if patient_context.get("medications"):
                ctx_lines.append(f"Current Medications: {', '.join(patient_context['medications'])}")
            if patient_context.get("allergies"):
                ctx_lines.append(f"Allergies: {', '.join(patient_context['allergies'])}")
            context_parts.append("## Patient Chart Summary\n" + "\n".join(ctx_lines))

        if rag_chunks:
            excerpts = "\n---\n".join(
                f"Excerpt {i+1}:\n{chunk}" for i, chunk in enumerate(rag_chunks[:5])
            )
            context_parts.append(f"## Relevant Medical Record Excerpts (RAG)\n{excerpts}")

        context_block = "\n\n".join(context_parts)
        user_query = messages[-1].get("content", "") if messages else ""
        full_prompt = f"{system_prompt}\n\n{context_block}\n\nUser Query: {user_query}".strip()

        if self._chat_model:
            try:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None, lambda: self._chat_model.generate_content(full_prompt)
                )
                if response and response.text:
                    return response.text
            except Exception as exc:
                log.warning("Gemini generation failed; falling back", error=str(exc))

        return self._clinical_fallback(user_query, role, patient_context, rag_chunks)

    # ── Drug Interaction Screening ─────────────────────────────────────────────

    def check_drug_interactions(self, medications: List[str]) -> Dict[str, Any]:
        """Screen a medication list for clinically significant interactions."""
        meds_lower = [m.lower() for m in medications]
        interactions: List[Dict[str, str]] = []

        _kb: List[Tuple] = [
            (
                ["lisinopril", "enalapril", "ramipril", "benazepril"],
                ["spironolactone", "eplerenone", "potassium", "amiloride", "triamterene"],
                "High",
                "Hyperkalaemia risk — ACE inhibitor + potassium-sparing diuretic. Dangerous serum K+ elevation causing cardiac arrhythmias.",
                "Monitor BMP every 1-3 months. Reduce/eliminate potassium supplementation.",
            ),
            (
                ["metformin"],
                ["contrast", "radiocontrast", "iodinated contrast"],
                "Moderate",
                "Metformin + iodinated radiocontrast: risk of contrast-induced nephropathy and metformin-associated lactic acidosis.",
                "Hold metformin 48h before and after contrast imaging. Resume only after stable renal function confirmed.",
            ),
            (
                ["atorvastatin", "simvastatin", "lovastatin", "rosuvastatin"],
                ["clarithromycin", "erythromycin", "azithromycin", "telithromycin"],
                "High",
                "CYP3A4 inhibition by macrolides markedly elevates statin levels — rhabdomyolysis and acute kidney injury risk.",
                "Suspend statin for antibiotic course duration. Monitor for muscle pain and CK elevation.",
            ),
            (
                ["warfarin", "coumadin"],
                ["aspirin", "ibuprofen", "naproxen", "celecoxib"],
                "High",
                "Warfarin + NSAID: combined anticoagulant + antiplatelet effect with GI mucosal injury risk. Increased major bleeding.",
                "Avoid concurrent use. If unavoidable: lowest NSAID dose, add PPI, monitor INR closely.",
            ),
            (
                ["sertraline", "fluoxetine", "paroxetine", "escitalopram", "citalopram", "venlafaxine"],
                ["tramadol", "linezolid", "sumatriptan", "pethidine", "fentanyl"],
                "High",
                "Serotonin syndrome — concurrent serotonergic agents cause life-threatening hyperthermia, agitation, autonomic instability.",
                "Avoid combination. Observe washout periods when switching. Monitor for agitation, tremor, hyperthermia.",
            ),
            (
                ["sildenafil", "tadalafil", "vardenafil", "avanafil"],
                ["nitrate", "nitroglycerin", "isosorbide", "nitroprusside"],
                "Contraindicated",
                "PDE-5 inhibitor + nitrate: profound synergistic hypotension potentially causing fatal cardiovascular collapse.",
                "Absolute contraindication. Never co-prescribe under any circumstances.",
            ),
            (
                ["digoxin"],
                ["amiodarone", "clarithromycin", "verapamil", "diltiazem", "erythromycin"],
                "High",
                "P-glycoprotein inhibition elevates digoxin levels — digoxin toxicity risk: bradycardia, heart block, visual disturbances.",
                "Reduce digoxin dose 50% when starting interacting agent. Monitor levels and ECG closely.",
            ),
            (
                ["clopidogrel", "prasugrel", "ticagrelor"],
                ["omeprazole", "esomeprazole"],
                "Moderate",
                "CYP2C19 inhibition by some PPIs reduces clopidogrel bioactivation, potentially diminishing antiplatelet effect.",
                "Prefer pantoprazole or ranitidine for GI protection in patients on clopidogrel.",
            ),
            (
                ["ciprofloxacin", "levofloxacin", "moxifloxacin", "norfloxacin"],
                ["calcium", "magnesium", "aluminum", "iron", "zinc", "antacid"],
                "Moderate",
                "Divalent/trivalent cations chelate fluoroquinolones in GI tract, reducing oral bioavailability up to 90%.",
                "Separate administration by 2h before or 6h after mineral/antacid ingestion.",
            ),
            (
                ["methotrexate"],
                ["ibuprofen", "naproxen", "trimethoprim", "sulfamethoxazole", "aspirin"],
                "High",
                "NSAIDs/TMP-SMX reduce methotrexate renal clearance — myelosuppression, hepatotoxicity, and mucositis risk.",
                "Avoid at high MTX doses. At low doses (RA/psoriasis), monitor CBC and LFTs closely.",
            ),
        ]

        for drug_a_terms, drug_b_terms, severity, effect, recommendation in _kb:
            has_a = any(any(t in m for t in drug_a_terms) for m in meds_lower)
            has_b = any(any(t in m for t in drug_b_terms) for m in meds_lower)
            if has_a and has_b:
                try:
                    drug_a = next(m for m in medications if any(t in m.lower() for t in drug_a_terms))
                    drug_b = next(m for m in medications if any(t in m.lower() for t in drug_b_terms))
                    interactions.append({
                        "drugs": [drug_a, drug_b],
                        "severity": severity,
                        "effect": effect,
                        "recommendation": recommendation,
                    })
                except StopIteration:
                    pass

        return {
            "screened_medications": medications,
            "interaction_count": len(interactions),
            "interactions": interactions,
            "has_critical": any(i["severity"] in ("High", "Contraindicated") for i in interactions),
        }

    # ── Clinical Fallback ──────────────────────────────────────────────────────

    def _clinical_fallback(
        self,
        query: str,
        role: str,
        patient_context: Optional[Dict[str, Any]],
        rag_chunks: Optional[List[str]],
    ) -> str:
        """Intelligent rule-based clinical response engine. Active when Gemini API unavailable."""
        q = query.lower()
        name = patient_context.get("name", "the patient") if patient_context else "the patient"
        meds = patient_context.get("medications", []) if patient_context else []
        diagnoses = patient_context.get("diagnoses", []) if patient_context else []
        rag_note = (
            f"\n\n> **Retrieved from {name}'s medical records:** {rag_chunks[0][:240]}...\n\n"
            if rag_chunks else ""
        )

        # Emergency detection
        emergency_terms = [
            "chest pain", "heart attack", "stroke", "can't breathe", "cannot breathe",
            "shortness of breath", "difficulty breathing", "sudden numbness", "sudden weakness",
            "unconscious", "seizure", "overdose", "severe bleeding", "fainting",
        ]
        if any(t in q for t in emergency_terms):
            return (
                "## 🚨 Emergency Alert\n\n"
                "The symptoms you've described may indicate a **medical emergency**.\n\n"
                "**Take immediate action:**\n"
                "1. **Call 911** (or your local emergency number) immediately\n"
                "2. Do not drive yourself — wait for emergency services\n"
                "3. Use any prescribed nitroglycerin or rescue inhaler while waiting\n\n"
                "*MediCare AI cannot provide emergency care. Please contact emergency services now.*"
            )

        if any(t in q for t in ["interaction", "taking together", "combine", "mix"]):
            med_list = ", ".join(f"**{m}**" for m in meds) if meds else "your medications"
            return (
                f"## Drug Interaction Screening{rag_note}\n\n"
                f"Reviewing {name}'s current regimen: {med_list}.\n\n"
                "Use the **Drug Interaction Checker** in the Medications section for comprehensive automated analysis.\n\n"
                "*Always inform your pharmacist of all medications, supplements, and herbal products.*"
            )

        if any(t in q for t in ["hba1c", "glucose", "sugar", "diabetes", "a1c", "blood sugar"]):
            return (
                f"## Glycaemic Control Assessment{rag_note}\n\n"
                "| Range | Classification |\n"
                "|-------|----------------|\n"
                "| < 5.7% | Normal |\n"
                "| 5.7–6.4% | Prediabetes |\n"
                "| ≥ 6.5% | Diabetes |\n"
                "| < 7.0% | ADA Target (most adults) |\n\n"
                "Continue medications as prescribed, maintain consistent carbohydrate intake (45–60g/meal), "
                "and aim for 150 min/week of moderate aerobic activity.\n\n"
                "*Next HbA1c: every 3 months if above target, every 6 months if at target.*"
            )

        if any(t in q for t in ["blood pressure", "hypertension", "bp", "systolic", "diastolic"]):
            return (
                f"## Blood Pressure Assessment{rag_note}\n\n"
                "| Category | Systolic | Diastolic |\n"
                "|----------|----------|-----------|\n"
                "| Normal | < 120 | < 80 |\n"
                "| Elevated | 120–129 | < 80 |\n"
                "| Stage 1 HTN | 130–139 | 80–89 |\n"
                "| Stage 2 HTN | ≥ 140 | ≥ 90 |\n"
                "| Crisis | > 180 | > 120 |\n\n"
                "**Lifestyle Modifications:** Sodium < 2,300 mg/day, DASH diet, 90–150 min/week exercise, weight reduction.\n\n"
                "*If BP > 180/120 with symptoms (headache, vision changes, chest pain) — seek emergency care immediately.*"
            )

        if any(t in q for t in ["cholesterol", "ldl", "hdl", "triglyceride", "lipid", "statin"]):
            return (
                f"## Lipid Panel Assessment{rag_note}\n\n"
                "| Marker | Optimal Target |\n"
                "|--------|----------------|\n"
                "| LDL-C | < 70 mg/dL (high-risk) / < 100 (moderate) |\n"
                "| HDL-C | ≥ 60 mg/dL |\n"
                "| Triglycerides | < 150 mg/dL |\n"
                "| Non-HDL-C | < 100 mg/dL |\n\n"
                "Take statins consistently — long-term adherence is essential. "
                "Report any muscle pain, weakness, or dark urine to your provider immediately.\n\n"
                "*Annual fasting lipid panel recommended for patients on statin therapy.*"
            )

        if any(t in q for t in ["appointment", "schedule", "book", "see doctor", "visit"]):
            return (
                f"## Appointment Scheduling{rag_note}\n\n"
                "Book and manage your appointments in the **Appointments** section:\n"
                "- 🏥 In-person clinic visits\n"
                "- 💻 Video telehealth consultations\n"
                "- 📞 Phone consultations\n\n"
                "**Seek urgent care (within 24h) for:** Worsening symptoms, fever > 103°F, or signs of infection.\n\n"
                "*For life-threatening emergencies, always call 911.*"
            )

        if any(t in q for t in ["medication", "prescription", "drug", "pill", "dose", "refill"]):
            med_ctx = f" Current medications: {', '.join(meds)}." if meds else ""
            return (
                f"## Medication Guidance{rag_note}\n\n{med_ctx}\n\n"
                "**Key Medication Safety Guidelines:**\n"
                "- Take medications at the same time each day for consistency\n"
                "- Never stop a prescription medication without consulting your physician\n"
                "- Store medications away from heat, light, and moisture\n"
                "- Use the **Medications** section to request refills or report side effects\n\n"
                "*Screen for drug interactions using the Drug Interaction Checker in the Medications section.*"
            )

        if role in ("doctor", "nurse"):
            diag_ctx = f"\n**Patient Diagnoses:** {', '.join(diagnoses)}" if diagnoses else ""
            med_ctx = f"\n**Current Medications:** {', '.join(meds)}" if meds else ""
            return (
                f"## Clinical Decision Support{rag_note}\n\n"
                f"**Query:** *\"{query}\"*{diag_ctx}{med_ctx}\n\n"
                "**Evidence-Based Actions:**\n"
                "- Review AHA/ACC 2024, ADA Standards of Care, UpToDate for current guidelines\n"
                "- Consider renal (eGFR) and hepatic function in all dosing calculations\n"
                "- Document clinical reasoning using the SOAP Note Editor in Encounters\n\n"
                "*Configure GEMINI_API_KEY in .env for full AI-powered clinical decision support.*"
            )

        diag_str = f"Your active conditions: **{', '.join(diagnoses)}**. " if diagnoses else ""
        med_str = f"Current medications: **{', '.join(meds)}**. " if meds else ""
        return (
            f"## MediCare AI Health Assistant{rag_note}\n\n"
            f"Thank you for asking about: *\"{query}\"*\n\n"
            f"{diag_str}{med_str}\n\n"
            "Your care team is actively monitoring your health. General guidance:\n"
            "- Attend all scheduled follow-up appointments\n"
            "- Take prescribed medications consistently\n"
            "- Monitor and log any new or worsening symptoms\n\n"
            "**Need more specific guidance?** Ask about your lab results, a specific medication, "
            "a diagnosis, or appointment scheduling.\n\n"
            "*🚨 If experiencing a medical emergency, call 911 immediately.*\n\n"
            "---\n"
            "*⚕️ MediCare AI provides educational information only and does not replace "
            "personalised medical advice from your physician.*"
        )


# Singleton instance
ai_service = AIService()
