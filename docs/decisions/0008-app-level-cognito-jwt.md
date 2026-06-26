# ADR-0008 — App-level Cognito JWT validation (+ Hosted UI)

- **Status:** Accepted
- **Date:** 2026-06-26
- **Deciders:** Project owner
- **Relates to:** [constitution P1/P2/P8](../constitution.md), [ADR-0001](0001-backend-and-stack.md), [ADR-0007](0007-dual-deploy-portability.md), [design.md §4](../design.md)

## Context

Phase 2 replaces the interim Basic-Auth gate with real per-user auth via **Cognito**.
Tokens (JWTs) must be validated on every request. Two places can do that:

1. **Edge** — API Gateway's built-in JWT authorizer validates the token before the
   request reaches Lambda; the app reads the verified `sub` from the request context.
2. **App-level** — the FastAPI app validates the token itself (fetch + cache the
   pool's JWKS, verify signature/issuer/audience/expiry).

[design.md §4](../design.md) originally assumed the edge approach.

## Decision

**Validate JWTs in the app (app-level).** And use **Cognito Hosted UI** for
signup/login during Phase 2 (no frontend exists yet).

### Why app-level over edge

- **Portability ([ADR-0007](0007-dual-deploy-portability.md)).** The edge authorizer
  is an API-Gateway feature — it doesn't exist on Render (uvicorn). App-level
  validation means auth works **identically on both deploy targets**, preserving
  the forcing function. Edge would force a divergent auth path on Render.
- **Self-contained app ([P2](../constitution.md)).** The app needs nothing from a
  specific gateway to enforce auth; any host that runs the container is secured.
- **Cost is small.** One module + `PyJWT[crypto]`, with the JWKS cached in-process.

Trade-off accepted: a few ms per request for verification (vs. free at the edge),
and we don't lean on an AWS-managed validation layer. Worth it for portability.

### Why Hosted UI (for now)

Cognito's ready-made signup/login pages let us test real auth in Phase 2 **without
building any UI**. The React app (Phase 3) can keep using Hosted UI or swap to
Amplify custom screens — that's a Phase-3 decision, not blocked here.

## How it works

```
Login:    user → Cognito Hosted UI → verify email → login → JWT (id + access)
Request:  client ─Bearer JWT─► API Gateway ─► Lambda ─► FastAPI
            ① auth.py: verify JWT vs Cognito JWKS (sig/iss/aud/exp), cached
            ② deps.get_user_id → verified `sub`
            ③ ScreenerService → DynamoDB USER#<sub>
Local/tests: AUTH_MODE=header (X-User-Id) — no real tokens needed offline
```

## Consequences

- `app/api/auth.py` gains a Cognito JWT validator; `deps.get_user_id` implements the
  `AUTH_MODE=jwt` branch. The interim Basic-Auth guard is **narrowed to `/ui`** (the
  server-rendered demo, retired in Phase 3); `/v1` is JWT-gated.
- The Lambda env gains `COGNITO_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_REGION`,
  set by the CDK stack; `AUTH_MODE=jwt` on deployed environments.
- New users are seeded a starter watchlist on first login (FR-2.4).
- This supersedes the edge-authorizer assumption in [design.md §4](../design.md),
  which is updated accordingly.
- If we ever want defense-in-depth, the edge authorizer can be *added* on AWS later
  without removing app-level validation.
