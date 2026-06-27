# apps/web

The web frontend — **React + Vite + TypeScript + Tailwind v4** (Phase 3). Consumes
the `/v1` API; design is driven by swappable tokens (see `src/index.css` `@theme`).

## Run locally
```bash
# 1. Backend (header mode → no token needed for dev):
cd services
python3 -m venv .venv && source .venv/bin/activate    # first time only
pip install -r requirements-dev.txt                   # first time only
DATA_BACKEND=yfinance uvicorn api.app:app --app-dir app --reload --port 8000

# 2. This app, in another terminal:
cd apps/web && npm install && npm run dev             # serves :5173
```

Note: on macOS the interpreter is `python3`; after `source .venv/bin/activate`
both `python` and `uvicorn` are on PATH.
Open http://localhost:5173 — the SPA calls the backend at `VITE_API_URL`
(default `http://localhost:8000`). Point it at the deployed AWS API by copying
`.env.example` → `.env` (that path needs a Cognito token — the auth step).

## Layout
```
src/
  main.tsx              providers (TanStack Query, Router) + mount
  App.tsx              layout shell + routes
  api/                 client.ts (the only place that calls /v1), types.ts, hooks
  lib/format.ts        pure presentation logic (formatting + score colors)
  features/            feature-sliced screens (watchlists/…)
  index.css            Tailwind import + design tokens (@theme)
```
Logic lives in `api/` (hooks) and `lib/`; components stay thin. When mobile arrives,
`api/` + `lib/` lift into `packages/*` (ADR-0002).

## Build
```bash
npm run build      # tsc -b && vite build
```

_Next: Cognito login (so it can hit the deployed API), more screens (leaderboard,
chart, editing), then deploy to S3 + CloudFront._
