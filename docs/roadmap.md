# Roadmap

Phased build sequence for the greenfield repo. Each phase delivers something
verifiable and de-risks the next. The earlier Streamlit prototype is the **source
of the scoring logic to port** (see [SCORING.md](SCORING.md)) — it is not migrated
wholesale.

---

## Phase 0 — Pure scoring core  ✅ done

**Goal:** portable, tested domain logic before any infra.

- Port `fund_score`, `tech_score`, `signal`, combined-score from the prototype into
  `/services/app/core` with **zero framework imports** ([P3](constitution.md)).
- Unit tests covering the worked examples in [SCORING.md](SCORING.md).
- Define market-data, cache, and repository **adapter interfaces** in
  `/services/app/adapters` (in-memory impls first).

**Exit:** scoring covered by tests; core has no IO/framework deps.

## Phase 1 — Backend API  ✅ deployed on AWS (Lambda + API Gateway + DynamoDB)

**Goal:** a real HTTP API serving the core.

- FastAPI handlers for the watchlist/leaderboard/chart/score [endpoints](design.md#3-api-surface).
- Back the cache + repo adapters with DynamoDB.
- Run locally (`uvicorn`); deploy via CDK: Lambda (Mangum) + API Gateway + DynamoDB.
  Temporary access lock (IP allowlist / API key) — **no public unauthenticated
  data**.

**Exit:** `GET /v1/watchlists/{id}` returns scored data from the deployed API; the
score cache demonstrably prevents repeat upstream fetches (FR-3.3).

## Phase 2 — Auth & multi-user data

**Goal:** real users, isolated data.

- Cognito user pool + email verification via CDK; JWT authorizer on API Gateway.
- Derive `userId` from the token claim only ([P8](constitution.md), NFR-3.1).
- Per-user DynamoDB model ([design §5](design.md#5-data-model-dynamodb)); seed a
  starter watchlist on first login (FR-2.4).
- One-time import of the prototype owner's existing watchlists.

**Exit:** two test users cannot see each other's data.

## Phase 3 — Web frontend

**Goal:** replace the prototype UI for end users.

- Stand up the [monorepo](design.md#7-monorepo-layout-p4) packages; move
  presentation logic (color thresholds, formatting, sort/rank) into
  `/packages/view-logic`.
- Build screens: watchlists, leaderboards, chart, comments. Cognito login (Hosted
  UI first). Deploy via S3 + CloudFront (CDK).

**Exit:** web app reaches parity for watchlists + leaderboards + chart + comments.

## Phase 4 — Discovery / screener  *(the new direction)*

**Goal:** find & suggest stocks beyond watchlists ([ADR-0003](decisions/0003-discovery-engine.md)).

- `/services/app/discovery`: define the initial universe (**S&P 500**), batch entrypoint
  reusing `/services/app/core`.
- EventBridge daily schedule → batch Lambda → `UNIVERSE#<asOf>` rankings + `LATEST`
  pointer.
- `/screen` and `/suggestions` endpoints reading the latest snapshot.
- Frontend: screener UI (factor filters) + suggestions view + one-click add to
  watchlist (FR-6.5).
- Implement at least minimum sector-aware handling (suppress/flag ETFs & financials,
  FR-6.6).

**Exit:** a user can screen the S&P 500 by factors and get suggestions excluding
their own holdings, served from precomputed rankings.

## Phase 5 — Expand & harden  *(optional / iterative)*

- Larger universe via a bulk fundamentals provider (data-source ADR).
- Sector-relative normalisation for discovery.
- Mobile scaffold (`/apps/mobile`, Expo) validating the shared packages
  ([ADR-0002](decisions/0002-web-mobile-sharing.md)).
- News-sentiment factor (documented future enhancement).

---

## Cross-cutting, throughout

- **IaC from Phase 1** ([P6](constitution.md)) — no click-ops as source of truth.
- **Secrets in Secrets Manager from Phase 1** ([P8](constitution.md)).
- **Observability from Phase 1** (NFR-4.2): logs + cache-hit / upstream-fetch /
  batch-status metrics.
- **`dev` + `prod`** as separate stacks once Phase 1 stabilizes.

## Sequencing rationale

- Phase 0 first: tested, portable core is the prerequisite that makes every later
  phase safe and touches no infra.
- Auth (2) precedes the frontend (3) so the UI is built against the secured contract.
- Discovery (4) follows the frontend so it has a place to surface, and reuses the
  now-proven core + adapters + data model rather than inventing them.
