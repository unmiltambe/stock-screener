# stock-screener

A multi-user stock **dashboard, watchlist, and discovery engine**. Score the
companies you follow, and surface new ones you don't — ranked by fundamentals,
technicals, and the factors you care about.

## ▶ Try it live

### **https://d29r5u77l543g9.cloudfront.net**

**No signup, no install.** You're in instantly as a guest with your own private
watchlists. A starter list is created for you automatically.

Three things to try in 30 seconds:
1. Open **All Symbols** — a scored table across every watchlist, sortable by fundamentals, technicals, or combined score.
2. Click any row → an interactive **price + moving-average chart** (1W → 10Y).
3. Hit **+ New watchlist**, start typing a ticker like `AAPL` — autocomplete kicks in. Or paste several at once (`AAPL MSFT NVDA`) and they all get added and scored.

> Want to keep your lists? **Sign in** (top-right) — your guest watchlists
> migrate into the account automatically, saved across devices.

---

> Greenfield rewrite of an earlier single-user Streamlit prototype ("Bellwether").
> This repo carries forward the **scoring model** ([docs/SCORING.md](docs/SCORING.md))
> and starts clean on a multi-user, scale-to-zero cloud architecture.

## Quickstart (local, ~2 min)

**Prerequisites:** Python 3.9+, Node 18+, Git.

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

## What it does

**Available now (live):**
- **Watchlists** — create lists, add/remove tickers (type-ahead autocomplete over 11k+ US symbols; paste several at once), each scored on fundamentals + technicals, with a day-change (% vs. previous close) column.
- **All Symbols** — a built-in consolidated view across every watchlist, sortable by any metric or score.
- **Interactive charts** — price with SMA-50/200 overlays, 1W → 10Y, on every ticker.
- **Guest sessions** — full use with zero friction, no login required ([ADR-0009](docs/decisions/0009-guest-session-before-login.md)).
- **Sign in & save** — Cognito Hosted UI login; guest watchlists migrate into the account on first sign-in.
- **Leaderboard** — curated "best picks first" board (top opportunities, value, momentum, second looks) alongside the full All Symbols table.
- **Your account** — set how you're addressed (warm, personal greetings, [voice.md](docs/voice.md)) and delete your account + data any time.

**Planned next:**
- **Discovery / screener** *(the new direction)* — surface stocks beyond your watchlists, ranked across a broad universe by configurable factors ([ADR-0003](docs/decisions/0003-discovery-engine.md)).

**Out of scope (for now):** no portfolio tracking, brokerage integration, or
automated trading. The earlier prototype's Alpaca/leveraged-ETF trading is
intentionally set aside and may return later as a separate concern.

## Architecture at a glance

API-first Python backend (FastAPI on AWS Lambda) + React/TypeScript SPA. In
production, **CloudFront serves the SPA and proxies the API on one origin** (no
CORS), backed by API Gateway → Lambda → DynamoDB, with Cognito JWT + guest auth.
Scale-to-zero by design. Full detail in [docs/design.md](docs/design.md); every
running environment is mapped in [docs/deployments.md](docs/deployments.md);
rationale in [docs/decisions/0001-backend-and-stack.md](docs/decisions/0001-backend-and-stack.md).

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
    aws/                  Lambda image + cdk/ (DynamoDB + Lambda + API Gateway + S3/CloudFront)
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

## Contributing & license

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow
(open an issue first for anything larger than a small fix; CI runs tests + build on
every PR). Or send feedback straight from the app via the **Report a bug / request
a feature** link in the footer. Licensed under [MIT](LICENSE).

## Live deployments

| Environment | URL | Role |
|------------|-----|------|
| **AWS CloudFront** | **https://d29r5u77l543g9.cloudfront.net** | **The app** — SPA + API on one origin (canonical) |
| AWS API Gateway | https://7x1e7unmh5.execute-api.us-east-1.amazonaws.com | Backend API direct (`/ui` Swagger, Basic-Auth) |
| Render | https://stock-screener-demo.onrender.com | Portability mirror / interim demo (spins down on idle) |

Full environment map, configs, and safe-retirement plan for the interim surfaces:
[docs/deployments.md](docs/deployments.md). Deploy steps:
[docs/deploy-aws.md](docs/deploy-aws.md) · [docs/deploy-render.md](docs/deploy-render.md).

## Build status

`✅ done · ◑ in progress · ⬜ not started`

```
   ✅ React SPA ──► CloudFront ✅ ──► API Gateway ✅ ──► Lambda (FastAPI/Mangum) ✅
   (Phase 3,        (SPA + /v1 proxy,    (+ ✅ Cognito JWT  ┌────────────────────┐
    guest+sign-in)   one origin)           + guest, P2/P9)  │ ✅ core  (scoring) │
                                                            │ ✅ adapters        │
   ✅ Cognito (P2)                                          │ ✅ api  (/v1)      │
                                                            └────────────────────┘
   DynamoDB ✅ ◄────────────────────────────────────────────────┘  durable store
   ⬜ EventBridge → discovery batch (Phase 4)
```

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Pure scoring core + adapter interfaces | ✅ done |
| 1 | FastAPI backend + Lambda + API Gateway + DynamoDB | ✅ **deployed on AWS** |
| 2 | Cognito auth (app-level JWT) + per-user seeding | ✅ **deployed on AWS** |
| 3 | React SPA on CloudFront + S3; guest + sign-in, profile/account, leaderboard | ✅ **deployed**; discovery (Phase 4) still to come |
| 4 | Discovery / screener (scheduled batch) | ⬜ |
| 5 | Larger universe, sector-aware scoring, mobile | ⬜ |

> The [design.md](docs/design.md) diagram shows the full target architecture.
> See [roadmap](docs/roadmap.md) for per-phase detail.
