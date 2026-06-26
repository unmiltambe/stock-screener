# Design — Target Architecture

Realizes the [requirements](requirements.md) under the [constitution](constitution.md).
Stack rationale: [ADR-0001](decisions/0001-backend-and-stack.md). Web/mobile
sharing: [ADR-0002](decisions/0002-web-mobile-sharing.md). Discovery engine:
[ADR-0003](decisions/0003-discovery-engine.md). Resource ids & API versioning:
[ADR-0004](decisions/0004-stable-resource-ids.md).

---

## 1. System overview

```
                          ┌──────────────────────────┐
        Browser  ───────► │  CloudFront (CDN + TLS)   │
        (React SPA)       └────────────┬─────────────┘
                                       │ static assets
                          ┌────────────▼─────────────┐
                          │   S3 (web build artifact) │
                          └──────────────────────────┘

        React SPA ──JWT──► API Gateway (HTTP API, Cognito JWT authorizer)
                                   │
                                   ▼
                          ┌──────────────────────────┐
                          │   Lambda (Python/FastAPI) │
                          │   ┌────────────────────┐  │
                          │   │ domain core (pure) │  │  ← scoring (SCORING.md)
                          │   ├────────────────────┤  │
                          │   │ adapters:          │  │
                          │   │  - market data     │──┼──► data provider(s)
                          │   │  - cache  (Dynamo) │  │
                          │   │  - repo   (Dynamo) │  │
                          │   └────────────────────┘  │
                          └───────┬───────────┬───────┘
                                  │           │
                    ┌─────────────▼──┐   ┌────▼───────────────┐
                    │ DynamoDB        │   │ Secrets Manager     │
                    │  - users' data  │   │  - data-provider    │
                    │  - score cache  │   │    API keys         │
                    │  - universe rank│   └────────────────────┘
                    └───────▲─────────┘
                            │ writes daily rankings
                ┌───────────┴──────────────┐
                │ EventBridge (schedule)    │
                │   → Discovery batch Lambda│──► data provider(s)
                └──────────────────────────┘

        Auth:  React SPA ◄──► Cognito ──► issues JWT
```

Two compute paths:
- **Request path** (synchronous) — serves the SPA: watchlists, leaderboards,
  charts, and screen/suggest *queries against precomputed rankings*.
- **Batch path** (scheduled) — the discovery engine scores the universe daily and
  writes rankings to DynamoDB. See [ADR-0003](decisions/0003-discovery-engine.md).

## 2. Layers and responsibilities

| Layer | Tech | Responsibility | Principle |
|-------|------|----------------|-----------|
| Static hosting | S3 + CloudFront | Serve SPA, TLS, caching | P7 |
| Edge / routing | API Gateway (HTTP API) | Route → Lambda; enforce JWT | P2, P8 |
| Auth | Cognito | Signup, verify, JWT | P8 |
| Application | Lambda + FastAPI (Mangum) | Handlers, validation, orchestration | P1, P2 |
| Domain core | Pure Python | Scoring; no IO/framework | P3 |
| Adapters | Python | Market data, cache, persistence | P3, P5 |
| Discovery batch | Lambda + EventBridge | Periodic universe scoring → rankings | P5, P7 |
| Persistence | DynamoDB | Per-user data; TTL score cache; universe rankings | P2, P5, P7 |
| Secrets | Secrets Manager | Data-provider keys | P8 |
| Infra | AWS CDK (TS) | Define & deploy everything | P6 |

**Dependency rule:** application → core, application → adapters; the core depends on
nothing. The batch path reuses the **same** core + adapters as the request path.

## 3. API surface

REST over API Gateway HTTP API. All data endpoints require a Cognito JWT;
`userId` comes from the verified token claim only (FR-1.5, NFR-3.1). Data routes
are versioned under `/v1`; watchlists are addressed by a stable opaque `id`, not
their name (ADR-0004).

```
GET    /health                             → liveness, no auth

GET    /v1/watchlists                      → user's lists ({id, name, count})
POST   /v1/watchlists                      → create  { name }  → { id, name }
GET    /v1/watchlists/{id}                 → list + each ticker scored (FR-3.1)
PATCH  /v1/watchlists/{id}                 → rename  { name }   (id unchanged)
DELETE /v1/watchlists/{id}                 → delete
PUT    /v1/watchlists/{id}/tickers/{sym}   → add ticker
DELETE /v1/watchlists/{id}/tickers/{sym}   → remove ticker

GET    /v1/leaderboard                     → aggregated ranked views (FR-5.1)

GET    /v1/tickers/{sym}/chart?years=1     → price + SMA-50 + SMA-200 (FR-3.6)
GET    /v1/scores?tickers=A,B,C            → scores for an arbitrary set (cache-first)

GET    /v1/screen?minFund=60&maxPeg=2&sector=Tech&sort=combined  → screen the
                                          universe from precomputed rankings (FR-6.2/6.3)
GET    /v1/suggestions                     → top universe names not in user's lists (FR-6.4)
```

**Response shape:** pure data — no colors, no formatted strings (P1). Example row:

```json
{
  "ticker": "NVDA",
  "name": "NVIDIA Corporation",
  "price": 124.30,
  "scores": { "fund": 66, "tech": 66, "combined": 66 },
  "signal": "Buy",
  "metrics": { "pe": 41.2, "fwdPe": 30.8, "peg": 0.64, "fcfYield": 0.9,
               "roe": 114.3, "rsi": 58, "vsSma200": 8.1, "vsSma50": 2.3,
               "rangePos": 71, "sector": "Technology", "marketCap": 3.05e12 },
  "lists": ["Big Tech", "AI Adjacent"],
  "stale": false
}
```

## 4. Authentication flow

```
1. User signs up / logs in via Cognito (Hosted UI or Amplify Auth SDK).
2. Cognito returns a JWT to the SPA.
3. SPA sends it as `Authorization: Bearer` on every API call.
4. API Gateway's JWT authorizer validates signature/expiry/audience BEFORE Lambda.
5. Lambda reads the verified `sub` claim as userId — never from path/body.
```

## 5. Data model (DynamoDB, single table)

| Entity | PK | SK | Notes |
|--------|----|----|-------|
| Watchlist | `USER#<sub>` | `WL#<id>` | attrs `name`, `tickers: [..]` — id is stable across rename (ADR-0004) |
| Score cache | `CACHE#<sym>` | `SCORE` | **global**, shared across users; `ttl` epoch → 15-min expiry (FR-3.3/3.4, P5) |
| Universe ranking | `UNIVERSE#<asOf>` | `RANK#<sym>` | written by the batch job; carries scores + metrics for screening (FR-6.1) |
| Universe pointer | `UNIVERSE` | `LATEST` | points at the freshest `asOf` partition the API queries |

The score cache and universe rankings are intentionally **not** under `USER#` —
they're global so one fetch/one batch serves all users (P5). DynamoDB TTL expires
cache entries automatically; old universe partitions are pruned by the batch job.

## 6. Caching, market data & the discovery batch (P5)

- **Request path:** a scores request checks `CACHE#<sym>` first; fresh → serve,
  else fetch upstream once, cache (`ttl = now + 900s`), serve. Multi-ticker fetches
  parallelize (NFR-2.2).
- **Batch path:** EventBridge triggers the discovery Lambda daily. It iterates the
  universe (throttled to respect provider limits), scores each ticker via the same
  core, and writes a fresh `UNIVERSE#<asOf>` partition, then flips `UNIVERSE/LATEST`.
- **Screen/suggest requests** read only the latest universe partition — fast and
  independent of universe size (NFR-2.3). They never trigger upstream fetches.
- Market data lives behind an **adapter interface**, so the universe source can grow
  from yfinance to a bulk fundamentals provider without touching core or handlers.
  This data-source decision is deferred — see [ADR-0003](decisions/0003-discovery-engine.md).

## 7. Monorepo layout (P4)

```
/apps
  /web            React + Vite + TypeScript (the only frontend built now)
  /mobile         React Native / Expo — SCAFFOLD ONLY, later phase

/packages         ← shared, framework-agnostic, consumed by web AND mobile
  /shared-types   API contract types
  /api-client     typed fetch client (auth, endpoints, error mapping)
  /view-logic     pure formatting + red→yellow→green thresholds + sort/rank

/services
  /app            ← hosting-agnostic backend (imported as top-level packages)
    /core         pure Python scoring (SCORING.md)
    /adapters     market-data, dynamo-cache, dynamo-repo
    /api          FastAPI app + Lambda handler (Mangum)
    /discovery    batch job: universe definition + scheduled scoring
  /deploy
    /render       Dockerfile + requirements (uvicorn container)
    /aws          Dockerfile + requirements (Lambda image) + seed_dynamo.py
      /cdk        AWS CDK (Python): Cognito, API GW, Lambda(s), Dynamo,
                  EventBridge schedule, S3, CloudFront
  pyproject.toml  requirements-dev.txt   ← shared dev/test tooling

/render.yaml      Render blueprint — must live at the repo root (Render finds it there)
```

Shared web↔mobile = `/packages/*` only (types, client, view logic) — **not**
components. See [ADR-0002](decisions/0002-web-mobile-sharing.md).

## 8. Environments

`dev` and `prod` as separate CDK stacks (P6), each with its own Cognito pool,
DynamoDB table, and CloudFront distribution. Promotion = redeploy the same artifact.

## 9. Observability (NFR-4.2)

Structured JSON logs (request id, userId, route, latency). Metrics: request count,
error rate, **cache hit rate**, **upstream fetch count**, and **batch run
status/duration/coverage** — the early-warning signals for cost and provider
rate-limiting.

## 10. Open design questions

Candidates for future ADRs:

1. **Discovery data source & universe size** — yfinance (throttled) vs. a bulk
   fundamentals API (FMP/Tiingo/etc.); S&P 500 vs. broader. (ADR-0003 frames it.)
2. **Sector-aware scoring for the screener** — how to keep banks/ETFs/utilities
   from ranking misleadingly (SCORING.md caveats; FR-6.6).
3. **Cognito Hosted UI vs. Amplify custom screens.**
4. **Single Lambda (FastAPI monolith) vs. per-route Lambdas.**
5. **Score-cache warming** — reactive only for now.
