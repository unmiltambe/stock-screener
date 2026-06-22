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
apps/web         React + Vite + TypeScript (the frontend)
packages/*       shared, framework-agnostic: types, api-client, view-logic
services/api     FastAPI + Lambda handler
services/core    pure scoring logic (no IO, no framework)
services/adapters  market-data + cache + persistence adapters
infra            AWS CDK (TypeScript)
```

## Docs

Start with [docs/README is the index] → [docs/constitution.md](docs/constitution.md)
for the principles, then [docs/requirements.md](docs/requirements.md) and
[docs/design.md](docs/design.md). The build sequence is in
[docs/roadmap.md](docs/roadmap.md).

## Status

📐 **Spec + skeleton.** No application code yet — this commit establishes the
structure, principles, and plan. See the roadmap for what lands next.
