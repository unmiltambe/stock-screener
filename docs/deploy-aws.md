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
   Cognito (auth)                ─ Phase 2 ─  ◑  app-level JWT (ADR-0008); /ui keeps Basic Auth
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
                  3. Lambda (container) (image built from deploy/aws/Dockerfile)
                  4. API Gateway HTTP API (routes all paths → the Lambda)
                  5. Cognito user pool + app client + Hosted-UI domain
                → Outputs: ApiUrl, TableName, UserPoolId, UserPoolClientId, HostedUiBaseUrl
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
      │        ① verify Cognito JWT (app-level: JWKS sig/iss/aud/exp) — ADR-0008
      │        ② userId = verified `sub`  (deps.get_user_id)
      │        ③ ScreenerService
      │              ├─ cache check ───────────►  DynamoDB  CACHE#<sym> (15-min TTL)
      │              ├─ on miss: yfinance ─────►  Yahoo Finance
      │              └─ watchlist read/write ──►  DynamoDB  USER#<id> / WL#<id>
      ▼
  JSON  ◄── back up the same path
```

The Lambda is stateless (P2); all state is in DynamoDB. Idle = nothing runs,
nothing bills (P7).

## Control flow 3 — auth (Phase 2: app-level Cognito JWT, ADR-0008)

```
  login:    user → Cognito Hosted UI → verify email → login → JWT
  request:  client ─Bearer JWT─► API Gateway → Lambda → FastAPI
                                  validates JWT in-app (works on AWS *and* Render)
            userId = verified `sub`
  /ui demo: still gated by interim Basic Auth (retired with the React app, Phase 3)
  /health:  open
```

JWT is validated **in the app**, not at the API Gateway edge — so the same auth
holds on Render too ([ADR-0007](decisions/0007-dual-deploy-portability.md) /
[ADR-0008](decisions/0008-app-level-cognito-jwt.md)).

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
4. `cd services/deploy/aws/cdk && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
5. `cdk bootstrap` (one-time per account/region).

**B. Deploy**
6. `cdk deploy -c basic_auth_pass='YOUR_PASS'` → note the outputs: `ApiUrl`,
   `TableName`, `UserPoolId`, `UserPoolClientId`, `HostedUiBaseUrl`.

**C. Create a test user + get a JWT** (Phase 2 — `/v1` requires a Cognito token)
7. Sign up via the Hosted UI (`<HostedUiBaseUrl>/login?client_id=<UserPoolClientId>&response_type=token&scope=openid+email&redirect_uri=http://localhost:3000/callback`) and confirm the email — or, fastest for a quick check, via CLI:
   ```bash
   aws cognito-idp sign-up --client-id <UserPoolClientId> --username you@example.com --password 'Passw0rd!' --user-attributes Name=email,Value=you@example.com
   aws cognito-idp admin-confirm-sign-up --user-pool-id <UserPoolId> --username you@example.com
   TOKEN=$(aws cognito-idp initiate-auth --client-id <UserPoolClientId> --auth-flow USER_PASSWORD_AUTH \
     --auth-parameters USERNAME=you@example.com,PASSWORD='Passw0rd!' --query AuthenticationResult.IdToken --output text)
   ```

**D. Verify**
8. `curl <ApiUrl>/health` → `{"status":"ok"}` (open).
9. `curl <ApiUrl>/v1/watchlists` → `401` (no token); `curl -H "Authorization: Bearer $TOKEN" <ApiUrl>/v1/watchlists` → your seeded starter list.
10. Hit a watchlist twice → second call fast (score cache, no upstream fetch).
11. Browser: `<ApiUrl>/ui` → the demo UI (still gated by Basic Auth), backed by **durable** DynamoDB.

## Defaults chosen

- **CDK language:** Python · **Lambda packaging:** container image — see [ADR-0006](decisions/0006-cdk-python-container-lambda.md).
- **Auth:** Cognito + app-level JWT for `/v1` (ADR-0008); Basic Auth still gates the interim `/ui` (password via deploy-time context, never committed).
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
- **Auth:** `/v1` uses real Cognito JWT (Phase 2, app-level — ADR-0008); the
  interim `/ui` demo still uses Basic Auth until the React app (Phase 3).
- **`RemovalPolicy.DESTROY`** on the table for easy dev teardown — switch to
  `RETAIN` before storing anything you can't re-seed.
