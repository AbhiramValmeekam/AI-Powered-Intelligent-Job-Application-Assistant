# Deploy CareerOS

CareerOS has two parts:
- **Frontend** (Next.js 16) → deploy on **Vercel**
- **Backend** (FastAPI) → deploy on **Render** (free tier) or Railway/Fly

Vercel only hosts the frontend. The backend must run somewhere always-on and
expose a public URL, which you then point the frontend at via `NEXT_PUBLIC_API_BASE`.

---

## 1. Backend → Render

1. Push this repo to GitHub (already done: `AbhiramValmeekam/AI-Powered-Intelligent-Job-Application-Assistant`).
2. In Render: **New → Blueprints** → connect the repo → it picks up `backend/render.yaml`
   (service `careeros-backend`, runtime python, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
3. In Render, set these **Environment Variables** (Dashboard → careeros-backend → Environment):
   | Key | Value |
   |-----|-------|
   | `MONGODB_URL` | your MongoDB connection string (MongoDB Atlas `mongodb+srv://…`) |
   | `GEMINI_API_KEY` | Google AI Studio key (gemini-2.5-flash works) |
   | `CORS_ORIGINS` | `*` (or your Vercel domain, comma-separated) |
   | `ADZUNA_APP_ID` | Adzuna app id (optional — job search degrades without it) |
   | `ADZUNA_APP_KEY` | Adzuna app key (optional) |
   | `JOBSHIELD_MODEL_DIR` | `/app/backend/models` (leave default) |
4. Deploy. Note the generated backend URL, e.g. `https://careeros-backend.onrender.com`.
   - Health check: open `https://<your-backend>/health` → should return `{"status":"ok"}`.

> Render free tier spins down after inactivity; the first request after idle may take ~30s.
> For zero-cold-start use Render Starter or Railway/Fly.

---

## 2. Frontend → Vercel

1. In Vercel: **Add New → Project** → import the same GitHub repo.
2. **Configure Project**:
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: **`frontend`**  ← important, the app lives in `frontend/`
   - Build Command: `npm run build` (pre-filled by `frontend/vercel.json`)
   - Install Command: `npm install`
   - Node version: 22 (set in Project → Settings → Node.js Version if needed)
3. **Environment Variables** (Settings → Environment Variables). Add ALL of:
   | Key | Value | Notes |
   |-----|-------|-------|
   | `NEXT_PUBLIC_API_BASE` | `https://<your-backend>` | the Render URL from step 1 (NO trailing slash) |
   | `NEXT_PUBLIC_GET_STARTED_URL` | `/app` | leads CTAs into the Command Center |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | from clerk.com → API Keys |
   | `CLERK_SECRET_KEY` | `sk_test_…` | server-side only |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/app` | |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/app` | |
4. **Deploy**. Vercel builds `frontend` and gives you a URL like `https://careeros.vercel.app`.

> `CLERK_SECRET_KEY` is a **server** secret — Vercel keeps it encrypted and never
> ships it to the browser. `NEXT_PUBLIC_*` vars are inlined at build time, so if you
> change `NEXT_PUBLIC_API_BASE` you must **Redeploy** (not just re-run).

5. Optional: add a custom domain in Vercel → Domains, then set `CORS_ORIGINS` on
   Render to that domain for tighter CORS.

---

## 3. Wire Clerk (auth)

- Create an app at https://dashboard.clerk.com.
- Copy the publishable + secret keys into the Vercel env vars above.
- In Clerk → **Allowed Origins**, add your Vercel domain (e.g. `https://careeros.vercel.app`).
- Without keys the app runs keyless (auth disabled) — fine for a demo, but sign-in/up
  pages stay inactive until keys are set.

---

## 4. Verify after deploy

From your machine (or browser):
- Frontend loads at the Vercel URL; "Create resume" / "Find jobs" work.
- `curl https://<backend>/health` → `{"status":"ok"}`.
- Open the app, sign in (Clerk), upload a resume → ATS scan + auto-fill fire.
- Apply to a job → Auto-Apply tailors + files the application (status: Applied).

---

## Env var quick reference

### Frontend (Vercel)
```
NEXT_PUBLIC_API_BASE=https://<backend-url>
NEXT_PUBLIC_GET_STARTED_URL=/app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app
```

### Backend (Render)
```
MONGODB_URL=mongodb+srv://...
GEMINI_API_KEY=AIza...
CORS_ORIGINS=*
ADZUNA_APP_ID=   (optional)
ADZUNA_APP_KEY=  (optional)
JOBSHIELD_MODEL_DIR=/app/backend/models
```

See `frontend/.env.example` and `backend/.env.example` for the full lists.
