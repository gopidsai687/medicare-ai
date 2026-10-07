# MediCare

> A full-stack, production-oriented healthcare management platform.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://temporary-swift-canyon-7pf0euj.vercel.app)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/gopidsai687/medicare-ai)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/gopidsai687/medicare-ai)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/gopidsai687/medicare-ai)

### 🌐 Live Links
- **Live Deployed App (Vercel):** [https://temporary-swift-canyon-7pf0euj.vercel.app](https://temporary-swift-canyon-7pf0euj.vercel.app)
- **Claim Vercel Deployment:** [Claim Deployment Link](https://vercel.com/claim-deployment?code=f64f0bed-d158-45b3-8a66-de3a6b116d80)
- **GitHub Repository:** [https://github.com/gopidsai687/medicare-ai](https://github.com/gopidsai687/medicare-ai)
- **Live Local Tunnel:** [https://tired-rats-tan.loca.lt](https://tired-rats-tan.loca.lt)


## Overview

MediCare combines Electronic Patient Records, hospital management, AI-powered medical assistance, and analytics into a unified platform with three specialized portals:

| Portal | Users | Description |
|--------|-------|-------------|
| **Patient Portal** | Patients | Medical records, appointments, AI assistant |
| **Doctor Portal** | Doctors, Nurses | Clinical tools, scheduling, encounters |
| **Admin Portal** | Administrators | Staff, operations, analytics, compliance |

## Technology Stack

### Frontend
- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui + Lucide Icons
- React Router v6 + TanStack Query v5
- React Hook Form + Zod + Recharts

### Backend
- Python 3.12 + FastAPI + Pydantic v2
- SQLAlchemy (async) + Alembic
- PostgreSQL + pgvector
- Redis + Celery workers
- JWT authentication + RBAC

### AI / ML
- Google Gemini (via controlled orchestration layer)
- RAG with PostgreSQL + pgvector
- scikit-learn + XGBoost + PyTorch
- MLflow experiment tracking

## Project Structure

```
MediCare/
├── frontend/           # React/Vite application
├── backend/            # FastAPI application
├── data-science/       # ML/Analytics pipelines
├── docs/               # Documentation
├── design/             # Design assets
├── scripts/            # Utility scripts
├── tests/              # Integration tests
├── docker-compose.yml  # Development infrastructure
├── .env.example        # Environment variable template
├── .gitignore
├── README.md
└── LICENSE
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.12+
- PostgreSQL 15+
- Redis 7+

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate   # Windows
source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### With Docker (recommended)
```bash
docker-compose up -d
```

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your database credentials, JWT secret, and Gemini API key
3. **Never commit `.env` to version control**

## Architecture

```
PostgreSQL ← Source of Truth
     ↓
FastAPI (Auth + RBAC + Services)
     ↓
React Frontend (Presentation Layer)

Gemini AI ← Assistant/Retrieval Layer (not source of truth)
ML Models ← Research/Decision Support (not clinical authority)
```

## Portals

### Patient Portal
Dashboard • Appointments • Medical Records • Timeline • Diagnoses
Treatments • Medications • Prescriptions • Surgeries • Admissions
Labs • Documents • AI Assistant • Settings

### Doctor Portal
Dashboard • My Patients • Schedule • Encounters • Diagnoses
Prescriptions • Surgeries • Labs • AI Assistant • Analytics

### Admin Portal
Dashboard • Patients • Doctors • Departments • Appointments
Admissions • Duplicate Review • Patient Merge • Audit Logs • System Settings

## Key Architectural Rules

1. **PostgreSQL is the single source of truth** — never AI, never ML, never frontend
2. **AI does not diagnose or prescribe** — only assists with authorized data retrieval
3. **Never delete duplicate patients** — use MPI + merge workflow
4. **Every mutation is auditable** — all changes logged with provenance
5. **Resource-level authorization** — RBAC alone is insufficient
6. **Never commit secrets** — use `.env.example` as template only

## Automated Testing & Seeding

### Run Automated Test Suite
```bash
python scripts/run_tests.py
```

### Seed PostgreSQL with Demo Data & Vector Embeddings
```bash
python scripts/seed_data.py
```

### Demo Login Accounts

| Portal | Email | Password | Role |
|--------|-------|----------|------|
| **Admin Portal** | `admin@medicare.ai` | `AdminPass123!` | System Administrator |
| **Doctor Portal** | `sarah.chen@medicare.ai` | `DoctorPass123!` | Attending Cardiologist |
| **Doctor Portal** | `james.kim@medicare.ai` | `DoctorPass123!` | Attending Endocrinologist |
| **Patient Portal** | `alice.johnson@medicare.ai` | `PatientPass123!` | Verified Patient |
| **Patient Portal** | `david.kim@medicare.ai` | `PatientPass123!` | High-Risk Patient |

## Milestones

| Version | Milestone | Status |
|---------|-----------|--------|
| v0.1 | Foundation & Project Structure | Completed |
| v0.2 | Authentication & RBAC | Completed |
| v0.3 | Patient & Doctor Management | Completed |
| v0.4 | Clinical Records & Encounters | Completed |
| v0.5 | MPI & Duplicate Detection Workflow | Completed |
| v0.6 | Complete Hospital Portals (21 Pages across 3 Portals) | Completed |
| v0.7 | AI Clinical Decision Support & Health Guide | Completed |
| v0.8 | RAG Vector Search & Drug Interactions Matrix | Completed |
| v0.9 | Clinical Analytics & Risk Stratification | Completed |
| v1.0 | Integrated MediCare Production Platform | Completed |

## License

MIT License — see [LICENSE](LICENSE)
