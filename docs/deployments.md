# Deployments — the environment map

One page that tracks **every place this app runs**, why each exists, and how to
retire the interim ones safely. Detailed per-platform guides:
[deploy-aws.md](deploy-aws.md) · [deploy-render.md](deploy-render.md) ·
[local-dev.md](local-dev.md). The dual-host portability rationale is
[ADR-0007](decisions/0007-dual-deploy-portability.md); the interim demo is
[ADR-0005](decisions/0005-interim-demo-deployment.md).

> **Same app everywhere.** `services/app/**` is hosting-agnostic; environments
> differ only in env vars (adapters) and packaging. See
> [structure.md](structure.md) § "How a deploy target is selected".

## The four surfaces

| # | Surface | URL | Serves | Store / Auth | Status |
|---|---------|-----|--------|--------------|--------|
| 1 | **Local dev** | `localhost:5173` (SPA) → `localhost:8000` (API) | SPA + API | memory · `header` (demo user) | permanent |
| 2 | **Render** | https://stock-screener-demo.onrender.com | API + interim `/ui` | memory · `jwt` (+ Basic-Auth `/ui`) | interim |
| 3 | **AWS API Gateway** (direct) | https://7x1e7unmh5.execute-api.us-east-1.amazonaws.com | API + interim `/ui` | DynamoDB · `jwt` (+ Basic-Auth `/ui`) | backend; now secondary |
| 4 | **AWS CloudFront** (unified origin) | **https://d29r5u77l543g9.cloudfront.net** | **SPA + API (same origin)** | DynamoDB · `jwt` + guest | **canonical public app** |

All `jwt` surfaces share **one Cognito pool** (`us-east-1_OYipjDV7H`, client
`5i48e2uso248joouud6qi84jr9`) — one login works on Render and AWS, and guests
(`X-Guest-Id` → `GUEST#<uuid>`, [ADR-0009](decisions/0009-guest-session-before-login.md))
work on any `jwt` surface (persisted on AWS, ephemeral on Render's memory store).

## Each surface in detail

### 1. Local dev — *permanent*
- **Run:** backend `uvicorn api.app:app --app-dir app` (`:8000`); SPA `npm run dev`
  (`:5173`), which proxies `/v1` + `/health` to `:8000` (Vite config) so dev mirrors
  prod's same-origin model — no CORS locally.
- **Config:** `DATA_BACKEND=yfinance|memory`, `STORE_BACKEND=memory`, `AUTH_MODE=header`
  → resolves to the seeded demo user; guest ids are ignored here (keeps the demo seed).
- **Purpose:** development + the offline test suite. Never retired.

### 2. Render — *interim*
- **What:** one Docker web service (uvicorn), backend only — no SPA. Serves `/v1`,
  `/docs`, and the interim `/ui`. Config in [`render.yaml`](../render.yaml).
- **Config:** `STORE_BACKEND=memory` (watchlists reseed on each restart, edits don't
  persist), `DATA_BACKEND=yfinance`, `AUTH_MODE=jwt` on the shared Cognito pool.
- **Purpose:** (a) the [ADR-0007](decisions/0007-dual-deploy-portability.md)
  **portability forcing function** — proves the app runs unchanged off AWS and that
  auth is validated *in the app*, not at an AWS edge; (b) a zero-cost public demo.
- **Free-tier note:** sleeps after ~15 min idle; first request wakes it (~seconds).

### 3. AWS API Gateway (direct) — *backend, now secondary*
- **What:** HTTP API → Lambda (container, FastAPI via Mangum) → DynamoDB. This is the
  real backend. It is still **publicly reachable directly** and **bypasses CloudFront**
  (so it has no SPA, and direct `/v1` calls from a browser would need CORS).
- **Config:** `STORE_BACKEND=dynamo`, `DATA_BACKEND=yfinance`, `AUTH_MODE=jwt`.
- **Purpose:** serve the API. In normal use it's consumed *through* CloudFront (#4);
  the direct URL is handy for `curl`/debugging and is what CloudFront proxies to.

### 4. AWS CloudFront (unified origin) — *canonical*
- **What:** CloudFront serves the React SPA from a private S3 bucket (OAC) at `/` and
  proxies `/v1/*` + `/health` to the API Gateway (#3). One origin to the browser →
  **no CORS**, one URL for the app, the API, and Cognito callbacks (option B).
- **Key behaviours:** `/v1/*` uses `CACHING_DISABLED` (per-user data is never cached)
  and forwards all viewer headers except Host; a CloudFront Function on the S3
  behaviour rewrites extension-less paths to `/index.html` (SPA deep-link refresh)
  without touching API responses.
- **Auth:** guest sessions **and** Cognito Hosted-UI sign-in (Authorization Code +
  PKCE); guest watchlists migrate into the account on first sign-in
  (`POST /v1/auth/migrate-guest`). The CloudFront `/callback` + logout URLs are
  registered on the Cognito client (CDK `-c frontend_url=…`). Account deletion
  (`DELETE /v1/account`) wipes the user's data and Cognito identity — the Lambda is
  granted `cognito-idp:AdminDeleteUser` on the pool.
- **Purpose:** the public web app. This is the target end users hit.

## Retirement guidance (how to remove the interim pieces safely)

Retire in this order; each is independent.

1. **Interim `/ui` (Swagger demo, all surfaces) — ready to retire.**
   Superseded by the SPA ([ADR-0005](decisions/0005-interim-demo-deployment.md)).
   Remove `services/app/api/demo_ui.py`, the Basic-Auth middleware, and the
   `BASIC_AUTH_USER`/`BASIC_AUTH_PASS` env vars (CDK context + `render.yaml`).
   **Safe once** nobody relies on `/ui`; the JSON API and `/docs` are unaffected.

2. **AWS API Gateway *public* surface — lock down, don't delete.**
   CloudFront depends on this origin, so it must keep existing — but the *direct
   public URL* can stop being a second front door: add a shared secret header on the
   CloudFront→API origin and reject requests without it (or attach WAF). After that,
   all real traffic flows only through CloudFront (#4).

3. **Render — decide: keep as portability check, or delete.**
   It's interim as a *demo*, but [ADR-0007](decisions/0007-dual-deploy-portability.md)
   deliberately keeps a second host as a portability forcing function. To delete it:
   remove the Render service, `render.yaml` (repo root), and
   `services/deploy/render/`, then **update ADR-0007** to record that the dual-deploy
   guarantee was dropped. Keeping it costs ~nothing (free tier) and preserves the
   "runs anywhere" check — recommended until there's a reason to drop it.

4. **Local dev — never retired.**
