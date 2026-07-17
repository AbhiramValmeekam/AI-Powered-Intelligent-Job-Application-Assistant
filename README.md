# CareerOS — AI-Powered Intelligent Career Assistant (Backend)

CareerOS is an AI career copilot: discover jobs, analyze JDs, tailor resumes, generate cover
letters, detect scams, track applications, prep interviews, and grow your career.

This repo currently contains the **backend (Phase 1)**: FastAPI + MongoDB, integrating two
real engines:

- **Resume & Cover-Letter Tailoring** (ported + hardened from `AI_Resume_Agent`) — Gemini,
  single combined call, `thinkingBudget:0`, never-fabricate rules.
- **Scam Shield** (ported from `JobShieldAI`) — a fully *trained* ML ensemble (XGBoost /
  LightGBM / RF / LR / SVM) for fraud detection, loaded from `.joblib` models.

## Architecture

```text
backend/
  app/
    main.py                 # FastAPI app + lifespan (Mongo connect/disconnect, scheduler)
    core/                   # config (pydantic-settings), database (Motor), deps, scheduler
    engines/
      gemini_client.py      # Gemini REST wrapper (QuotaError, retry, no-thinking)
      resume/parser.py      # PDF/DOCX -> text
      resume/engine.py      # tailor + JD intelligence + ATS + missing skills + cover letter
      intelligence.py       # company research, interview coach, learning recs, advisor
      job_discovery.py      # live job search (Remotive + Adzuna)
      scamshield/           # ML fraud engine (delegated port of JobShieldAI)
    schemas.py              # Pydantic request/response models
    api/router.py           # 15 modules wired as real endpoints
frontend/                   # Next.js 16 + React 19 + GSAP (cinematic landing, rebranded from HeroCV_V2)
  app/page.tsx              # cinematic landing (GET /)
  app/get-started/page.tsx  # resume+JD -> backend /resume/tailor + /jobs/alerts
  components/CinematicLanding.tsx
  lib/content.ts
```

## Modules implemented (Phase 1 — backend, all functional)

| # | Module | Endpoint(s) |
|---|--------|-------------|
| 1 | Master Career Profile | `POST /profiles`, `GET /profiles/{email}` |
| 2 | AI Job Discovery | `GET /jobs/search` (live Remotive+Adzuna), `GET /jobs/alerts` (profile-matched), `POST /jobs/from-url`, `POST /jobs/alerts/run` (manual scan), `GET /notifications` |
| 3 | Job Description Intelligence | `POST /jobs/analyze` |
| 4 | Resume Tailoring Engine | `POST /resume/tailor` (file upload or text) |
| 5 | Cover Letter Generator | `POST /cover-letter` |
| 6 | ATS Analyzer | `POST /ats/analyze` |
| 7 | Missing Skill Analyzer | `POST /skills/missing` |
| 8 | AI Scam Shield | `POST /scam/check` (real ML) |
| 9 | Company Intelligence | `POST /company/research` |
| 10 | AI Interview Coach | `POST /interview/questions`, `POST /interview/feedback` |
| 11 | Application Tracker | `POST /applications`, `GET /applications`, `PATCH /applications/{id}` |
| 12 | Resume Version Control | `GET /resume/versions` |
| 13 | Career Analytics | `GET /analytics/summary` |
| 14 | Learning Recommendation | `POST /learning/recommend` |
| 15 | AI Career Advisor | `POST /advisor/chat` |

## Quick start (local)

```bash
# 1. MongoDB (Docker)
docker run -d --name careeros-mongo -p 27017:27017 mongo:7

# 2. Backend
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
# put your Gemini key in backend/.env  (GEMINI_API_KEY=...)
uvicorn app.main:app --reload --port 8000

# 3. Scam Shield model path
#    The engine loads trained .joblib from ../JobShieldAI/saved_models by default.
#    Override with env JOBSHIELD_MODEL_DIR if you relocate them.

# 4. Frontend (Next.js 16 + React 19 + GSAP)
cd frontend
cp .env.example .env.local          # sets NEXT_PUBLIC_API_BASE=http://localhost:8000
npm install
npm run dev                         # http://localhost:3000  (or :3001 if 3000 busy)
# Landing page (/) -> Command Center (/app) with all 15 modules wired in
```

> Note: the landing UI was adapted from [PolisettyMohitK/HeroCV_V2](https://github.com/PolisettyMohitK/HeroCV_V2)
> (`/landing`), rebranded to CareerOS and wired to the FastAPI backend.

## Frontend modules (Command Center — `/app`)

All 15 backend modules are wired into a single cinematic dashboard at `/app`,
using shared UI primitives (`components/Panel.tsx`) and a typed API client
(`lib/api.ts`). Each panel matches the landing page's visual language.

| # | Module | Backend endpoint(s) |
|---|--------|---------------------|
| 1 | Master Profile | `POST /profiles` |
| 2 | Job Discovery (live) | `GET /jobs/search`, `POST /jobs/from-url` |
| 2b | Real-time Alerts | `GET /jobs/alerts`, `POST /jobs/alerts/run`, `GET /notifications` |
| 3 | JD Intelligence | `POST /jobs/analyze` |
| 4 | Resume Tailor | `POST /resume/tailor` |
| 5 | Cover Letter | `POST /cover-letter` |
| 6 | ATS Analyzer | `POST /ats/analyze` |
| 7 | Missing Skills | `POST /skills/missing` |
| 8 | Scam Shield (ML) | `POST /scam/check` |
| 9 | Company Intelligence | `POST /company/research` |
| 10 | Interview Coach | `POST /interview/questions`, `POST /interview/feedback` |
| 11 | Application Tracker | `POST/GET/PATCH /applications` |
| 12 | Resume Versions | `GET /resume/versions` |
| 13 | Analytics | `GET /analytics/summary` |
| 14 | Learning Paths | `POST /learning/recommend` |
| 15 | Career Advisor | `POST /advisor/chat` |

## Docker

```bash
docker compose up --build
# backend: http://localhost:8000  (docs at /docs)
```
The compose file mounts `../JobShieldAI/saved_models` into the backend at `/models`
(read-only) for the Scam Shield engine.

## Auth

Phase 1 runs without auth (AUTH_ENABLED=false). A `userId`/`email` is accepted in request
bodies so the data model is multi-tenant ready. Clerk/Firebase middleware slots in later
without changing engine logic.

## Important rules (enforced in code)

- **Never fabricate** resumes/cover letters — only reorder, rewrite, highlight real content.
- AI decisions are explained (ATS `explanation`, missing-skill `roadmap`, advisor cites profile).
- Scam predictions return `prediction`, `confidence`, `riskScore`, `reasons`.

## Notes / next phases

- **Frontend** (Next.js + Tailwind + Framer Motion): Phase 2.
- **Playwright job scraping** for `/jobs/from-url`: Phase 2.
- **ML training pipeline** (`JobShieldAI/training/*`) is reused as-is; retraining documented there.
