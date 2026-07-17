# CareerOS — Deployment

CareerOS is a monorepo:
- `frontend/` — Next.js 16 + React 19 + GSAP (the cinematic landing + get-started flow). **Deploys to Vercel.**
- `backend/`  — FastAPI + MongoDB + APScheduler background job-alerts. **Deploys to Render / Railway / Fly** (Vercel cannot run a long-lived Python server or the scheduler).

The frontend talks to the backend over HTTP via `NEXT_PUBLIC_API_BASE`. CORS on the
backend is controlled by `CORS_ORIGINS` (set it to your Vercel domain, or `*` for previews).

---

## 1. Backend (Render — recommended)

Render gives a free tier, a persistent process, and easy env vars.

**Option A — `render.yaml` (infra-as-code)**
Create `backend/render.yaml`:
```yaml
services:
  - type: web
    name: careeros-backend
    runtime: python
    plan: free
    region: oregon
    branch: main
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: MONGODB_URL
        value: <your MongoDB Atlas connection string>
      - key: GEMINI_API_KEY
        sync: false          # fill in dashboard (secret)
      - key: CORS_ORIGINS
        value: "https://careeros.vercel.app"   # your Vercel URL
      - key: ADZUNA_APP_ID     # optional (more job sources)
        sync: false
      - key: ADZUNA_APP_KEY    # optional
        sync: false
      - key: JOBSHIELD_MODEL_DIR
        value: "/app/JobShieldAI/saved_models"  # see note below
```
- The Scam Shield model loads `.joblib` files from `JOBSHIELD_MODEL_DIR`. On Render,
  add a **Mount** (e.g. a Render Disk or a small Git repo) so the trained models are
  present at that path. Easiest: copy the `JobShieldAI/saved_models/*.joblib` into
  `backend/models/` and set `JOBSHIELD_MODEL_DIR=/app/backend/models` — adjust
  `backend/app/engines/scamshield/__init__.py` default if needed.
- Add MongoDB: use **MongoDB Atlas** (free M0) and put its URI in `MONGODB_URL`.

**Option B — dashboard**
1. New → Web Service → connect repo → set Root Directory = `backend`.
2. Build: `pip install -r requirements.txt` · Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add the env vars above.

Note the backend needs `PYTHONPATH` cleared only in the local Hermes venv; on a clean
Python 3.11+ host that is not required.

---

## 2. Frontend (Vercel)

### Easiest: import from Git
1. Push this repo to GitHub.
2. Vercel Dashboard → **Add New → Project** → import the repo.
3. Vercel auto-detects Next.js. **Set Root Directory = `frontend`** (or rely on the
   root `vercel.json` `build.rootDirectory`).
4. Add Environment Variables (or use the `vercel.json` `@careeros-api-base` reference):
   - `NEXT_PUBLIC_API_BASE` = `https://<your-backend>.onrender.com`  (the deployed backend)
   - `NEXT_PUBLIC_GET_STARTED_URL` = `/get-started`
5. Deploy.

### CLI
```bash
npm i -g vercel
cd frontend
vercel login
vercel --prod        # or just `vercel` for preview
```

### Files already prepared for Vercel
- `frontend/vercel.json` — framework, build, and env wiring.
- `frontend/.gitignore` — excludes `.env.local`, `.next`, `node_modules`.
- `vercel.json` (root) — sets `rootDirectory: frontend` so repo-root deploys work.
- `frontend/package.json` — `name: careeros-frontend`, Node >=20.19 (Next 16 requirement).

### CORS (important)
The browser calls the backend directly, so the backend must allow the Vercel origin.
Set the backend's `CORS_ORIGINS` to your Vercel URL, e.g.:
`CORS_ORIGINS=https://careeros.vercel.app,https://careeros-git-*.vercel.app`
Or `CORS_ORIGINS=*` to allow all (fine for public previews; tighten for prod).

---

## 3. Post-deploy checklist
- [ ] Backend `/health` returns `{"status":"ok"}` on its deployed URL.
- [ ] Frontend loads; landing page animates (desktop + mobile).
- [ ] `/get-started` submits and reaches the backend (check Network tab → 200/429, not CORS error).
- [ ] `GEMINI_API_KEY` set on backend → tailoring returns real output (not the 429 message).
- [ ] `CORS_ORIGINS` on backend includes the Vercel domain.
- [ ] MongoDB Atlas reachable from backend (whitelist Render/Railway IPs or use 0.0.0.0/0 for dev).

## 4. Local vs prod env summary
| Variable | Local | Prod |
|----------|-------|------|
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000` | backend URL |
| `GEMINI_API_KEY` | in `backend/.env` | Render env (secret) |
| `CORS_ORIGINS` | localhost list | Vercel URL |
| `MONGODB_URL` | `mongodb://localhost:27017` | Atlas URI |
| `ADZUNA_APP_ID/KEY` | optional | optional |
