# Infrastructure — Phase 1 (AWS deploy)

How the backend runs on AWS, the control flows, and the step-by-step to deploy it.
Implemented by [`../infra`](../infra) (AWS CDK, Python). Decisions:
[ADR-0001](decisions/0001-backend-and-stack.md) (serverless),
[ADR-0006](decisions/0006-cdk-python-container-lambda.md) (CDK language + packaging).

## Scope: Phase 1 vs the full target

```
   FULL TARGET (design.md)                    PHASE 1 (this)
   ─────────────────────────                  ──────────────────────
   CloudFront + S3 (React SPA)   ─ Phase 3 ─  ✗  no frontend yet
   Cognito (auth)                ─ Phase 2 ─  ✗  interim: Basic Auth
   API Gateway (HTTP API)                     ✅
   Lambda (FastAPI via Mangum)                ✅  handler.py already exists
   DynamoDB (single table)                    ✅  real, durable persistence
   EventBridge + discovery batch ─ Phase 4 ─  ✗
   Param Store / Secrets         ─ Phase 2 ─  ✗  password via deploy-time context
```

## Control flow 1 — deploy time (code → infrastructure)

```
  your laptop                         AWS
  ───────────                         ───
  cdk synth   → CloudFormation template (declares every resource)
  cdk deploy  → CloudFormation creates/updates, in dependency order:
                  1. DynamoDB table     (PK/SK, on-demand, TTL on `ttl`)
                  2. IAM role           (Lambda → read/write THAT table only)
                  3. Lambda (container) (services/ image built from Dockerfile.lambda)
                  4. API Gateway HTTP API (routes all paths → the Lambda)
                → Outputs: ApiUrl, TableName
```

CDK is the single source of truth (P6): one command builds it, one tears it down,
all reviewable in git. No console click-ops.

## Control flow 2 — request time (per call)

```
  Browser / curl
      │  HTTPS  GET /v1/watchlists/{id}   (Authorization: Basic ...)
      ▼
  API Gateway (HTTP API)                  ← TLS, public endpoint
      │  Lambda proxy integration (whole request passed through)
      ▼
  Lambda  →  Mangum  →  FastAPI app
      │        ① Basic-Auth middleware    (interim gate; Cognito replaces in P2)
      │        ② ScreenerService
      │              ├─ cache check ───────────►  DynamoDB  CACHE#<sym> (15-min TTL)
      │              ├─ on miss: yfinance ─────►  Yahoo Finance
      │              └─ watchlist read/write ──►  DynamoDB  USER#<id> / WL#<id>
      ▼
  JSON  ◄── back up the same path
```

The Lambda is stateless (P2); all state is in DynamoDB. Idle = nothing runs,
nothing bills (P7).

## Control flow 3 — interim auth vs target

```
  PHASE 1 (now):  request → API Gateway → Lambda → Basic-Auth middleware ✓ → app
                  (one password, set at deploy via context; the same gate as the demo)

  PHASE 2 (next): request → API Gateway → Cognito JWT authorizer ✓ → Lambda → app
                  (token validated at the edge BEFORE Lambda; userId = verified `sub`)
```

Reusing Basic Auth as the Phase 1 lock = zero throwaway; Cognito cleanly supersedes
it.

## Data model (DynamoDB single table — design.md §5)

| Entity | PK | SK | Notes |
|--------|----|----|-------|
| Watchlist | `USER#<sub>` | `WL#<id>` | attrs `name`, `tickers` (ADR-0004) |
| Score cache | `CACHE#<sym>` | `SCORE` | global; `ttl` epoch → 15-min expiry |

(Universe rankings for discovery, design.md §5, arrive in Phase 4.)

## Step-by-step

**A. One-time account setup (you)**
1. Create the AWS account; an admin IAM Identity Center user (or IAM user).
2. **Set a Billing Budget alert (~$5)** — before anything else.
3. Install Node, the AWS CDK CLI (`npm i -g aws-cdk`), and configure AWS creds.
4. `cd infra && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
5. `cdk bootstrap` (one-time per account/region).

**B. Deploy**
6. `cdk deploy -c basic_auth_pass='YOUR_PASS'` → note the `ApiUrl` + `TableName` outputs.
7. Seed: `cd ../services && DDB_TABLE='<TableName>' AWS_REGION=us-east-1 python seed_dynamo.py`

**C. Verify**
8. `curl <ApiUrl>/health` → `{"status":"ok"}` (open).
9. `curl -u admin:YOUR_PASS <ApiUrl>/v1/watchlists` → your 7 lists from DynamoDB.
10. Hit a watchlist twice → second call fast (served from the score cache, no upstream fetch).
11. Browser: `<ApiUrl>/ui` → the demo UI, now backed by **durable** DynamoDB.

## Defaults chosen

- **CDK language:** Python · **Lambda packaging:** container image — see [ADR-0006](decisions/0006-cdk-python-container-lambda.md).
- **Interim auth:** existing Basic-Auth middleware (password via deploy-time context, never committed).
- **Region:** `us-east-1`. **Billing:** on-demand DynamoDB + per-request Lambda.

## Cost (personal scale)

~$0 for the first year (free tier), ~$0–1/month steady-state — Lambda, DynamoDB,
API Gateway, and CloudWatch all sit within always-free allowances at this volume.
See the cost breakdown discussion; set the budget alert regardless.

## Known limitations (Phase 1)

- **30-second ceiling:** API Gateway HTTP API caps integration at 30s. A *cold*
  leaderboard that fetches many uncached tickers could approach this. Mitigations
  (later): smaller default set, or a cache-warming pass. Watchlist/scores calls are
  fine.
- **Cold starts:** container Lambda cold start adds ~1–2s occasionally; acceptable
  for a cached personal tool.
- **Interim auth only:** Basic Auth, single shared password. Real per-user auth is
  Phase 2 (Cognito).
- **`RemovalPolicy.DESTROY`** on the table for easy dev teardown — switch to
  `RETAIN` before storing anything you can't re-seed.
