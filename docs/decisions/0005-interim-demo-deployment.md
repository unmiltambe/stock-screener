# ADR-0005 — Interim demo deployment (server-rendered UI on a PaaS)

- **Status:** Accepted (explicitly temporary)
- **Date:** 2026-06-23
- **Deciders:** Project owner
- **Relates to:** [constitution P1/P7](../constitution.md), [roadmap](../roadmap.md), [ADR-0001](0001-backend-and-stack.md)

## Context

We want a **rudimentary site reachable from anywhere, now** — well before the
React SPA (Phase 3), Cognito (Phase 2), or the CDK/Lambda deploy exist. The
backend already computes scores; the gap is purely "serve some HTML at a public
URL."

The full target (React SPA + Lambda + API Gateway + Cognito + DynamoDB) is days of
work. This ADR records a deliberate shortcut to bridge that gap, and is honest
that it bends two principles.

## Decision

Ship an **interim demo**:

1. A **server-rendered HTML view** mounted at `/ui` (`api/demo_ui.py`) that calls
   the existing `ScreenerService` and renders read-only score tables.
2. **HTTP Basic Auth** (`api/auth.py`, env-configured) as a stopgap gate.
3. Deployed as a **single Docker container on Render** (free tier) — a public
   HTTPS URL, always-on.

## Principles this bends (knowingly)

- **P1 (API-first, no UI in the backend):** the server renders HTML. *Mitigation:*
  the demo UI is an **isolated sidecar** — it does not touch the `/v1` JSON API,
  which stays pure. The whole `/ui` surface is one module, deletable in a single
  step when the SPA lands.
- **P7 (scale-to-zero):** an always-on container costs more at idle than Lambda.
  *Mitigation:* Render's free tier (sleeps when idle); the **domain code is
  unchanged**, so this is throwaway *hosting*, not throwaway code. The Lambda path
  ([handler.py](../../services/api/handler.py)) still exists for the real deploy.
- **P8 (security):** Basic Auth is weaker than Cognito. *Mitigation:* it still
  gates the site; real auth arrives in Phase 2. The password is required in the
  hosted env (the Render blueprint marks it `sync: false`).

## Consequences

- Reaching a usable URL drops from "days" to "~an hour + a Render account."
- When Phase 3 lands: delete `api/demo_ui.py` + `api/auth.py`, drop the `/ui`
  include in `app.py`, and retire the Render service. Nothing else depends on them.
- This does **not** change the roadmap target — it is a parallel stepping stone,
  not a replacement for the serverless architecture.
