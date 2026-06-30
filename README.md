# stock-screener

A multi-user stock **dashboard, watchlist, and discovery engine**. Score the
companies you follow, and surface new ones you don't — ranked by fundamentals,
technicals, and the factors you care about.

> Greenfield rewrite of an earlier single-user Streamlit prototype ("Bellwether").
> This repo carries forward the **scoring model** ([docs/SCORING.md](docs/SCORING.md))
> and starts clean on a multi-user, scale-to-zero cloud architecture.

## Quickstart (local, ~2 min)

**Prerequisites:** Python 3.11+, Node 18+, Git.

```bash
git clone git@github.com:unmiltambe/stock-screener.git
cd stock-screener
```

**Terminal 1 — backend (FastAPI, in-memory, real market data):**
```bash
cd services
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
DATA_BACKEND=yfinance uvicorn api.app:app --app-dir app --reload --port 8000
```

**Terminal 2 — frontend (React/Vite):**
```bash
cd apps/web
npm install
npm run dev
```

Open **http://localhost:5173**. The app is fully functional without any AWS account,
Cognito token, or Docker. A demo user and a starter watchlist are seeded automatically.

### Local architecture

```
Browser (localhost:5173)
    └─► Vite dev server (React/TS/Tailwind)
            └─► FastAPI (uvicorn, localhost:8000)   ← not Lambda locally
                    ├─ STORE_BACKEND=memory          ← not DynamoDB
                    ├─ DATA_BACKEND=yfinance         ← real prices via yfinance
                    └─ AUTH_MODE=header              ← no Cognito; header X-User-Id
```

The same Python app runs on AWS Lambda (via Mangum) with DynamoDB + Cognito in
production — the adapter swap is env-var driven. See [docs/local-dev.md](docs/local-dev.md)
for full options (offline fixture data, DynamoDB Local, etc.).

## What it is (this iteration)

- **Watchlists** — create lists, add/remove tickers, see each scored.
- **Leaderboards** — aggregate your lists into ranked views (best value, best
  momentum, buy the dip, …).
- **Discovery / screener** *(the new direction)* — find and suggest stocks beyond
  your watchlists, ranked across a broad universe by configurable factors. See
  [ADR-0003](docs/decisions/0003-discovery-engine.md).

## What it is **not** (yet)

- No portfolio tracking, brokerage integration, or automated trading. The earlier
  prototype's Alpaca/leveraged-ETF trading is intentionally **out of scope** and
  may be added later as a separate concern.

## Architecture at a glance

API-first Python backend (FastAPI on AWS Lambda) + React/TypeScript SPA, behind
API Gateway with Cognito auth and DynamoDB storage. Scale-to-zero by design.
Full detail in [docs/design.md](docs/design.md); rationale in
[docs/decisions/0001-backend-and-stack.md](docs/decisions/0001-backend-and-stack.md).

```
apps/web                  React + Vite + TypeScript (frontend — Phase 3)
packages/*                shared TS: types, api-client, view-logic (Phase 3)
services/
  app/                    hosting-agnostic backend (core, adapters, api)
    core/                 pure scoring logic (no IO, no framework)
    adapters/             market-data + cache + persistence (memory, dynamo, yfinance)
    api/                  FastAPI app + Mangum handler
  deploy/
    render/               Render container (Dockerfile + requirements)
    aws/                  Lambda image + cdk/ (DynamoDB + Lambda + API Gateway)
render.yaml               Render blueprint (must live at repo root)
```

The same app runs on either host; only `deploy/<platform>` config and a couple of
env vars (`STORE_BACKEND`, the entrypoint) differ. Full annotated tree + how the
two deploys are selected: [docs/structure.md](docs/structure.md).

## Docs

Start with the [docs index](docs/README.md) → [constitution](docs/constitution.md)
for the principles, then [requirements](docs/requirements.md) and
[design](docs/design.md). The build sequence is in [roadmap](docs/roadmap.md);
running the backend locally is in [local-dev](docs/local-dev.md).

## Live deployments

| Environment | URL | Notes |
|------------|-----|-------|
| AWS (API + Lambda) | https://7x1e7unmh5.execute-api.us-east-1.amazonaws.com/ui | Backend + Swagger UI |
| Render (demo) | https://stock-screener-demo.onrender.com/ui | Full-stack demo (may spin down on idle) |

See [docs/deploy-aws.md](docs/deploy-aws.md) and [docs/deploy-render.md](docs/deploy-render.md) for deploy instructions.

## Build status

`✅ done · ◑ in progress · ⬜ not started`

```
   ◑ React SPA ──JWT──► API Gateway ✅ ──► Lambda (FastAPI/Mangum) ✅
   (Phase 3)            (+ ✅ Cognito JWT     ┌────────────────────┐
                          app-level, P2)      │ ✅ core  (scoring) │
                                              │ ✅ adapters        │
   ✅ Cognito (P2)                            │ ✅ api  (/v1)      │
                                              └────────────────────┘
   DynamoDB ✅ ◄──────────────────────────────────────┘  durable store
   ⬜ EventBridge → discovery batch (Phase 4)
```

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Pure scoring core + adapter interfaces | ✅ done |
| 1 | FastAPI backend + Lambda + API Gateway + DynamoDB | ✅ **deployed on AWS** |
| 2 | Cognito auth (app-level JWT) + per-user seeding | ✅ **deployed on AWS** |
| 3 | React web frontend — foundation built, expanding screens | ◑ in progress |
| 4 | Discovery / screener (scheduled batch) | ⬜ |
| 5 | Larger universe, sector-aware scoring, mobile | ⬜ |

> The [design.md](docs/design.md) diagram shows the full target architecture.
> See [roadmap](docs/roadmap.md) for per-phase detail.
