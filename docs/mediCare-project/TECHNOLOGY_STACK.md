# MediCare AI — Technology Stack & Implementation Audit

**Document Version:** 1.0.0  
**Project:** MediCare AI — Healthcare Management Platform  
**Live URL:** [https://medicare-ai-iv31.onrender.com](https://medicare-ai-iv31.onrender.com)  

---

## 1. Verified Technology Stack Table

All technologies listed below have been directly inspected, verified, and tested within the active codebase:

| Technology | Where Used | Why Used | Role in MediCare AI | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Python 3.12** | Backend Core | Modern performance, strict type annotations, native async concurrency. | Powers the entire API server, clinical pipelines, and ORM. | **Verified** in `Dockerfile` and `requirements.txt` |
| **FastAPI 0.115** | Application API Layer | Automatic OpenAPI 3.1 documentation, Pydantic data validation, high throughput. | Serves all 17 REST API routers and handles CORS / auth middleware. | **Verified** in `backend/app/main.py` |
| **Uvicorn 0.34** | ASGI Server | Lightning-fast async web server implementation for Python. | Serves the FastAPI ASGI application in local and Docker production environments. | **Verified** in `Dockerfile` command |
| **SQLAlchemy 2.0** | Data Access Layer | Industry-standard async ORM supporting robust transactions and migrations. | Manages 46 enterprise healthcare tables and connection pooling. | **Verified** in `backend/app/core/database.py` |
| **aiosqlite 0.20** | Local/Demo Persistence | Zero-configuration, file-based async SQLite engine. | Provides portable, self-healing database storage for development and demo hosting. | **Verified** in `backend/app/core/database.py` |
| **asyncpg 0.30** | Production Persistence | High-performance PostgreSQL asynchronous driver. | Connects to enterprise PostgreSQL instances with connection pooling. | **Verified** in `backend/requirements.txt` |
| **Pydantic v2** | Data Validation | Type validation, automatic schema serialization, and JSON schema output. | Enforces strict schemas for API request payloads and clinical models. | **Verified** in `backend/app/schemas/` |
| **Google Gemini 2.5 Pro** | Generative AI Service | Advanced medical reasoning, long context window, high instruction adherence. | Generates plain-language patient explanations and physician summaries. | **Verified** in `backend/app/services/ai_service.py` |
| **pypdf 5.1** | Document Processing | Pure-Python PDF parsing with zero external C dependencies. | Extracts multi-page text streams from uploaded lab reports and prescriptions. | **Verified** in `backend/app/services/prescription_pipeline.py` |
| **Pillow (PIL) 11.0** | Image Processing | Robust raster image verification and manipulation. | Validates image uploads, checks dimensions, and verifies binary image headers. | **Verified** in `backend/app/services/prescription_pipeline.py` |
| **bcrypt 4.2 / Passlib** | Security & Auth | Adaptive salted cryptographic password hashing. | Hashes patient and clinician passwords using standard cost factor 12. | **Verified** in `backend/app/core/security.py` |
| **PyJWT 2.10** | Session Tokens | RFC 7519 JSON Web Token standard implementation. | Signs and verifies HMAC-SHA256 bearer access and refresh tokens. | **Verified** in `backend/app/core/security.py` |
| **structlog 24.4** | Clinical Logging | Structured, key-value JSON logging with context binding. | Provides searchable, auditable logs across API requests and AI services. | **Verified** in `backend/app/main.py` |
| **React 18.3** | Frontend Library | Component-based declarative UI with Concurrent Mode. | Renders all user interfaces, dashboards, modals, and dynamic telemetry views. | **Verified** in `frontend/package.json` |
| **TypeScript 5.7** | Client Language | Static typing, interface contracts, compile-time defect elimination. | Guarantees type safety across clinical forms, API responses, and routing. | **Verified** in `frontend/tsconfig.json` |
| **Vite 6.0** | Frontend Build Tool | Extremely fast esbuild-powered dev server and Rollup bundler. | Compiles, bundles, and minifies the SPA into optimized static assets. | **Verified** in `frontend/vite.config.ts` |
| **Tailwind CSS 4.0** | Styling System | Utility-first, zero-runtime CSS with modern responsive design tokens. | Delivers clinical UI aesthetic: deep navy background with teal/cyan accents. | **Verified** in `frontend/src/index.css` |
| **Radix UI Primitives** | UI Accessibility | Unstyled, accessible WAI-ARIA compliant components. | Powers accessible dialogs, dropdown menus, tooltips, and avatar badges. | **Verified** in `frontend/package.json` |
| **Recharts 2.15** | Data Visualization | Composable SVG charting library built on React components. | Renders longitudinal vital sign line charts, reference bands, and scatter plots. | **Verified** in `frontend/src/components/vitals/` |
| **Lucide React 0.469** | Iconography | Lightweight, consistent vector icons for modern web interfaces. | Provides clinical icons (heart, activity, shield, pill, alert, user). | **Verified** in `frontend/package.json` |
| **Docker Multi-Stage** | Containerization | Isolated, reproducible container builds with minimal runtime image footprint. | Stage 1 builds React; Stage 2 serves Python 3.12-slim backend + static assets. | **Verified** in root `Dockerfile` |
| **Render Cloud Platform**| Hosting & PaaS | Automated Git-based continuous deployment with HTTPS reverse proxy. | Hosts the live web service and provides environment secret management. | **Verified** in `render.yaml` |

---

## 2. Plain-Language Explanation of the Technology Choices

- **Why React and Vite?** Modern healthcare apps must feel fast and responsive. Vite compiles the application in seconds, while React updates only the specific parts of the screen that change (like an updated blood pressure reading) without reloading the whole webpage.
- **Why FastAPI and Python?** Python is the worldwide standard for medical AI and health data science. FastAPI is built specifically to process requests at lightning speed, catching invalid data before it reaches the database.
- **Why Dual Database Engines?** To ensure the application is both portable and enterprise-ready, it can run on SQLite (a self-contained, file-based database requiring zero installation) for instant demonstration, while instantly supporting PostgreSQL (the gold-standard hospital database) in production.
- **Why Google Gemini with Local Fallback?** Using Gemini 2.5 Pro provides state-of-the-art clinical reasoning. However, patient care cannot depend on a cloud connection. MediCare AI includes an offline, deterministic clinical reasoning engine so that drug interaction screening and emergency red-flag warnings work even if the internet or AI API is temporarily unavailable.

---

## 3. Developer and IT Management Specifications

### Configuration and Environment Management
Application configuration is managed strictly through Pydantic `BaseSettings` reading from environment variables (`.env`), adhering to Twelve-Factor App principles:
- `ENVIRONMENT`: Set to `production` or `development`.
- `DEBUG`: Controls SQLAlchemy query echoing and verbose error traces (disabled in production).
- `DATABASE_URL`: Primary asyncpg PostgreSQL connection URI.
- `USE_SQLITE_FALLBACK`: Enables automatic graceful degradation to `sqlite+aiosqlite:///backend/medicare.db` when PostgreSQL is offline.
- `JWT_SECRET` & `SECRET_KEY`: Cryptographic signing keys generated independently per deployment.
- `GEMINI_API_KEY`: API key for Google Generative AI services.
- `ALLOWED_ORIGINS_RAW`: Comma-delimited list of permitted CORS origins.

### Build and Deployment Strategy
```
Source Code (Git) 
   │
   ├─► GitHub Actions CI (.github/workflows/ci.yml)
   │     ├─► Node 20: npm ci && npm run build (TypeScript verification)
   │     └─► Python 3.12: pip install && python scripts/run_tests.py (37/37 tests)
   │
   └─► Render Cloud Platform (render.yaml)
         └─► Docker Multi-Stage Build
               ├─► Stage 1 (node:20-alpine): Compiles Vite SPA bundle (512MB RAM cap)
               └─► Stage 2 (python:3.12-slim): Copies backend + static bundle -> uvicorn
```
