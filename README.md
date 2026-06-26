# stock-screener

A multi-user stock **dashboard, watchlist, and discovery engine**. Score the
companies you follow, and surface new ones you don't — ranked by fundamentals,
technicals, and the factors you care about.

> Greenfield rewrite of an earlier single-user Streamlit prototype ("Bellwether").
> This repo carries forward the **scoring model** ([docs/SCORING.md](docs/SCORING.md))
> and starts clean on a multi-user, scale-to-zero cloud architecture.

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

## Build status

The backend is **live on AWS** (Lambda + API Gateway + DynamoDB, deployed via CDK)
with 89 passing tests. Auth and the web frontend are next. Legend:
`✅ done · ◑ partial · ⬜ not started`.

```
   ⬜ React SPA ──JWT──► API Gateway ✅ ──► Lambda (FastAPI/Mangum) ✅
   (Phase 3)            (+ ⬜ Cognito JWT      ┌────────────────────┐
                          authorizer, P2)      │ ✅ core  (scoring) │
                                               │ ✅ adapters        │
   ⬜ Cognito (P2)                             │ ✅ api  (/v1 + /ui)│
                                               └────────────────────┘
   DynamoDB ✅ ◄───────────────────────────────────────┘  durable store
   ⬜ EventBridge → discovery batch (Phase 4)
```

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Pure scoring core + adapter interfaces | ✅ done |
| 1 | FastAPI backend + Lambda + API Gateway + DynamoDB | ✅ **deployed on AWS** |
| 2 | Cognito auth + multi-user data | ⬜ next |
| 3 | React web frontend + shared packages | ⬜ |
| 4 | Discovery / screener (scheduled batch) | ⬜ |
| 5 | Larger universe, sector-aware scoring, mobile | ⬜ |
| — | Interim `/ui` (server-rendered + Basic Auth) — runs on AWS; optional Render mirror | ✅ ([ADR-0005](docs/decisions/0005-interim-demo-deployment.md)) |

> The [design.md](docs/design.md) diagram shows the full **target** architecture;
> the view above overlays current build status onto it. See [roadmap](docs/roadmap.md)
> for per-phase detail. The interim demo is a deliberate temporary stepping stone,
> not part of the target — see [ADR-0005](docs/decisions/0005-interim-demo-deployment.md).
