# Infrastructure — AWS deploy

**App (canonical):** https://d29r5u77l543g9.cloudfront.net — CloudFront serving the
React SPA and proxying the API on one origin (no CORS). This is what users hit.

**API (direct):** https://7x1e7unmh5.execute-api.us-east-1.amazonaws.com — the raw
API Gateway endpoint behind CloudFront; handy for `curl`/debugging.

- `/` — the SPA (via CloudFront only)
- `/v1/...` — JSON API (via CloudFront *or* the direct API Gateway URL)
- `/ui` — interim Swagger demo, Basic-Auth gated (direct API Gateway URL only)

How the stack runs on AWS, the control flows, and how to deploy it.
Implemented by the [CDK app](../services/deploy/aws/cdk/) (Python). See
[deployments.md](deployments.md) for how this fits with Render + local. Decisions:
[ADR-0001](decisions/0001-backend-and-stack.md) (serverless),
[ADR-0006](decisions/0006-cdk-python-container-lambda.md) (CDK language + packaging).

## Scope: what's deployed vs the full target

```
   FULL TARGET (design.md)                    CURRENT
   ─────────────────────────                  ──────────────────────
   CloudFront + S3 (React SPA)                ✅  unified origin (SPA + API proxy)
   Cognito (auth)                             ✅  app-level JWT (ADR-0008) + guests
                                                 (ADR-0009) + Hosted-UI sign-in
   API Gateway (HTTP API)                     ✅
   Lambda (FastAPI via Mangum)                ✅  container image (Mangum)
   DynamoDB (single table)                    ✅  real, durable persistence
   EventBridge + discovery batch ─ Phase 4 ─  ✗
   Param Store / Secrets         ─ Phase 2 ─  ✗  password via deploy-time context
```

The DynamoDB data model is [design.md §5](design.md#5-data-model-dynamodb-single-table)
(universe rankings arrive in Phase 4).

## The runbook — `deploy.sh`

All deploys go through [`services/deploy/aws/deploy.sh`](../services/deploy/aws/deploy.sh),
which encodes every footgun below so it can't be forgotten. It resolves all resource
ids from the live CloudFormation stack (nothing hardcoded to drift):

```bash
cd services/deploy/aws
bash deploy.sh diff        # backend cdk diff — REVIEW before backend/all
bash deploy.sh backend     # cdk deploy the Lambda (after reviewing the diff)
bash deploy.sh frontend    # build SPA → S3 sync → CloudFront invalidation
bash deploy.sh smoke       # post-deploy checks (health, Cognito callbacks, fresh fields)
bash deploy.sh all         # backend + frontend + smoke (only after reviewing diff)
```

**Which parts to deploy:** a change touching `services/app/**` needs `backend`
**first**, then `frontend` — a frontend-only deploy of a full-stack feature ships a
UI that renders against the *old* API (fields come back `null`). A pure UI change
needs only `frontend`. Always finish with `smoke`.

**Prerequisites per run:** AWS credentials configured; a Docker daemon running for
`backend` (container-image Lambda — Docker Desktop or `colima start`); the CDK venv
under `services/deploy/aws/cdk/.venv` (created in one-time setup below).

### The footguns `deploy.sh` encodes (why it exists)

Never blind-apply `cdk deploy`. Two stack inputs are **not stored in
CloudFormation** and are re-derived from context each deploy — omitting either
silently reverts live state:

- **`basic_auth_pass`** (secret) — gates the interim `/ui`; omitting resets it to
  empty. The script reads it from the live Lambda into a shell variable and **never
  prints it**; it aborts if the read fails.
- **`frontend_url`** — appended to the Cognito Hosted-UI **callback/logout URLs**;
  omitting used to **drop the production CloudFront callback and break sign-in**.
  Now pinned in [`cdk.json`](../services/deploy/aws/cdk/cdk.json) `context`; only
  override with `-c frontend_url=…` when standing up a *new* distribution.

`deploy.sh diff` shows the pending change with both values held constant — for a
code-only ship, the **only** diff line should be the `AWS::Lambda::Function` image
URI, and Cognito callback URLs must **not** appear.

### Post-deploy smoke (`deploy.sh smoke`)

Checks, in order:
1. `GET <FrontendUrl>/health` → `{"status":"ok"}`.
2. Cognito `CallbackURLs` still contain `https://<dist>.cloudfront.net/callback`
   (sign-in intact — the `frontend_url` footgun held).
3. A **fresh, uncached ticker** (`/v1/scores?tickers=WSO` with a new guest id)
   returns the fields the change shipped. Popular tickers can serve stale rows for
   up to 15 min (score-cache TTL) — that's why an uncommon symbol is used.

Then load the live app in a browser and confirm the change is visible.

## One-time account setup

1. Create the AWS account; an admin IAM Identity Center user (or IAM user).
2. **Set a Billing Budget alert (~$5)** — before anything else.
3. Install Node, the AWS CDK CLI (`npm i -g aws-cdk`), and configure AWS creds.
4. `cd services/deploy/aws/cdk && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
5. `cdk bootstrap` (one-time per account/region).
6. First deploy of a fresh account: `cdk deploy` directly (there's no live stack for
   `deploy.sh` to read yet), then note the outputs (`FrontendUrl`, `FrontendBucket`,
   `DistributionId`, `ApiUrl`, `TableName`, `UserPoolId`, `UserPoolClientId`,
   `HostedUiBaseUrl`) and use `deploy.sh` from then on.

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
                  6. S3 bucket (private) + CloudFront distribution:
                       / → S3 (SPA, OAC);  /v1/* + /health → API Gateway (no cache)
  build SPA   → apps/web: npm run build  →  dist/
  aws s3 sync → upload dist/ to the FrontendBucket
  invalidate  → CloudFront /* so the new build is served immediately
```

CDK provisions infra; the SPA artifacts are published separately (S3 sync +
invalidation) because they change far more often than the infrastructure. The SPA
uses **relative** API paths, so no rebuild is needed per environment — CloudFront
routes `/v1/*` to the API on the same origin.

CDK is the single source of truth (P6): one command builds it, one tears it down,
all reviewable in git. No console click-ops.

## Control flow 2 — request time (per call)

```
  Browser / curl
      │  HTTPS  GET /v1/watchlists/{id}   (Authorization: Bearer ...)
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

## Control flow 3 — auth (app-level Cognito JWT, ADR-0008)

```
  login:    user → Cognito Hosted UI → verify email → login → JWT
  request:  client ─Bearer JWT─► API Gateway → Lambda → FastAPI
                                  validates JWT in-app (works on AWS *and* Render)
            userId = verified `sub`
  guests:   X-Guest-Id: <uuid> → GUEST#<uuid> (ADR-0009; 7-day TTL; migrates on sign-in)
  /ui demo: still gated by interim Basic Auth (retire per deployments.md)
  /health:  open
```

JWT is validated **in the app**, not at the API Gateway edge — so the same auth
holds on Render too ([ADR-0007](decisions/0007-dual-deploy-portability.md) /
[ADR-0008](decisions/0008-app-level-cognito-jwt.md)).

## (Optional) Create a Cognito user + get a JWT from the CLI

For exercising the authenticated path without the UI:

```bash
aws cognito-idp sign-up --client-id <UserPoolClientId> --username you@example.com --password 'Passw0rd!' --user-attributes Name=email,Value=you@example.com
aws cognito-idp admin-confirm-sign-up --user-pool-id <UserPoolId> --username you@example.com
TOKEN=$(aws cognito-idp initiate-auth --client-id <UserPoolClientId> --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=you@example.com,PASSWORD='Passw0rd!' --query AuthenticationResult.IdToken --output text)
curl -H "Authorization: Bearer $TOKEN" <FrontendUrl>/v1/watchlists
```

## Defaults chosen

- **CDK language:** Python · **Lambda packaging:** container image — see [ADR-0006](decisions/0006-cdk-python-container-lambda.md).
- **Auth:** Cognito + app-level JWT for `/v1` (ADR-0008); Basic Auth still gates the interim `/ui` (password via deploy-time context, never committed).
- **Region:** `us-east-1`. **Billing:** on-demand DynamoDB + per-request Lambda.

## Cost (personal scale)

~$0 for the first year (free tier), ~$0–1/month steady-state — Lambda, DynamoDB,
API Gateway, CloudFront, S3, and CloudWatch all sit within always-free allowances
at this volume. Set the budget alert regardless.

## Known limitations

- **30-second ceiling:** API Gateway HTTP API caps integration at 30s. A *cold*
  leaderboard that fetches many uncached tickers could approach this. Mitigations
  (later): smaller default set, or a cache-warming pass. Watchlist/scores calls are
  fine.
- **Cold starts:** container Lambda cold start adds ~1–2s occasionally; acceptable
  for a cached personal tool.
- **Auth:** Hosted-UI sign-in + `migrate-guest` + 7-day guest TTL are **live**.
  Still pending: the proactive "sign in to save" nudge and silent token renewal
  (session ~1h, Cognito default). The interim `/ui` keeps Basic Auth until it's
  retired (see [deployments.md](deployments.md) § Retirement guidance).
- **Direct API Gateway URL is still public** and bypasses CloudFront — fine for now,
  lock it down when retiring interim surfaces ([deployments.md](deployments.md)).
- **`RemovalPolicy.DESTROY`** on the table *and the SPA bucket* for easy dev
  teardown — switch to `RETAIN` before storing anything you can't re-seed.
