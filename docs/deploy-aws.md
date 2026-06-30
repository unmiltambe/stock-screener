# Infrastructure — AWS deploy

**App (canonical):** https://d29r5u77l543g9.cloudfront.net — CloudFront serving the
React SPA and proxying the API on one origin (no CORS). This is what users hit.

**API (direct):** https://7x1e7unmh5.execute-api.us-east-1.amazonaws.com — the raw
API Gateway endpoint behind CloudFront; handy for `curl`/debugging.

- `/` — the SPA (via CloudFront only)
- `/v1/...` — JSON API (via CloudFront *or* the direct API Gateway URL)
- `/ui` — interim Swagger demo, Basic-Auth gated (direct API Gateway URL only)

How the stack runs on AWS, the control flows, and the step-by-step to deploy it.
Implemented by the [CDK app](../services/deploy/aws/cdk/) (Python). See
[deployments.md](deployments.md) for how this fits with Render + local. Decisions:
[ADR-0001](decisions/0001-backend-and-stack.md) (serverless),
[ADR-0006](decisions/0006-cdk-python-container-lambda.md) (CDK language + packaging).

## Scope: what's deployed vs the full target

```
   FULL TARGET (design.md)                    CURRENT
   ─────────────────────────                  ──────────────────────
   CloudFront + S3 (React SPA)                ✅  unified origin (SPA + API proxy)
   Cognito (auth)                             ◑  app-level JWT (ADR-0008) + guests
                                                 (ADR-0009); sign-in UI pending
   API Gateway (HTTP API)                     ✅
   Lambda (FastAPI via Mangum)                ✅  container image (Mangum)
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
                  6. S3 bucket (private) + CloudFront distribution:
                       / → S3 (SPA, OAC);  /v1/* + /health → API Gateway (no cache)
                → Outputs: ApiUrl, FrontendUrl, FrontendBucket, DistributionId,
                           TableName, UserPoolId, UserPoolClientId, HostedUiBaseUrl
  build SPA   → apps/web: npm run build  →  dist/
  aws s3 sync → upload dist/ to the FrontendBucket
  invalidate  → CloudFront /* so the new build is served immediately
```

CDK provisions infra; the SPA artifacts are published separately (S3 sync +
invalidation) because they change far more often than the infrastructure.

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

**B. Deploy the infrastructure**
6. `cdk deploy -c basic_auth_pass='YOUR_PASS'` → note the outputs: `FrontendUrl`,
   `FrontendBucket`, `DistributionId`, `ApiUrl`, `TableName`, `UserPoolId`,
   `UserPoolClientId`, `HostedUiBaseUrl`.
   - The Lambda is a **container image**, so a Docker daemon must be running
     (Docker Desktop, or `colima start`).
   - `basic_auth_pass` only gates the interim `/ui`. **Re-passing it on every
     deploy matters** — omitting it resets the value to empty. To preserve the
     current one without printing it, read it from the live Lambda into a shell
     var first (`aws lambda get-function-configuration … --query
     'Environment.Variables.BASIC_AUTH_PASS'`).

**B2. Publish the frontend (SPA → S3 → CloudFront)**
7. Build and upload, then bust the CDN cache:
   ```bash
   cd apps/web && npm run build
   aws s3 sync dist/ s3://<FrontendBucket>/ --delete
   aws cloudfront create-invalidation --distribution-id <DistributionId> --paths '/*'
   ```
   The SPA uses **relative** API paths, so no rebuild is needed per environment —
   CloudFront routes `/v1/*` to the API on the same origin. `FrontendUrl` is the app.

**C. Verify the app (guest mode — no login needed)**
8. Open `FrontendUrl` in a browser → the SPA loads; create watchlists, add tickers,
   view charts. The SPA auto-sends `X-Guest-Id`, so you get your own guest session.
9. Same-origin API checks:
   ```bash
   curl <FrontendUrl>/health                                   # {"status":"ok"}
   curl -H "X-Guest-Id: $(uuidgen)" <FrontendUrl>/v1/watchlists # 200 + seeded starter
   curl <FrontendUrl>/v1/watchlists                             # 401 (no token, no guest id)
   curl <FrontendUrl>/watchlists/_all -o /dev/null -w '%{http_code}\n'  # 200 (SPA deep-link)
   ```

**D. (Optional) Create a Cognito user + get a JWT** — for the authenticated path
   (sign-in UI is still pending; guests don't need this):
10. Sign up via the Hosted UI (`<HostedUiBaseUrl>/login?client_id=<UserPoolClientId>&response_type=token&scope=openid+email&redirect_uri=http://localhost:3000/callback`) and confirm the email — or, fastest, via CLI:
    ```bash
    aws cognito-idp sign-up --client-id <UserPoolClientId> --username you@example.com --password 'Passw0rd!' --user-attributes Name=email,Value=you@example.com
    aws cognito-idp admin-confirm-sign-up --user-pool-id <UserPoolId> --username you@example.com
    TOKEN=$(aws cognito-idp initiate-auth --client-id <UserPoolClientId> --auth-flow USER_PASSWORD_AUTH \
      --auth-parameters USERNAME=you@example.com,PASSWORD='Passw0rd!' --query AuthenticationResult.IdToken --output text)
    ```
11. `curl -H "Authorization: Bearer $TOKEN" <FrontendUrl>/v1/watchlists` → that user's lists.
    Hit a watchlist twice → second call fast (score cache, no upstream fetch).

## Defaults chosen

- **CDK language:** Python · **Lambda packaging:** container image — see [ADR-0006](decisions/0006-cdk-python-container-lambda.md).
- **Auth:** Cognito + app-level JWT for `/v1` (ADR-0008); Basic Auth still gates the interim `/ui` (password via deploy-time context, never committed).
- **Region:** `us-east-1`. **Billing:** on-demand DynamoDB + per-request Lambda.

## Cost (personal scale)

~$0 for the first year (free tier), ~$0–1/month steady-state — Lambda, DynamoDB,
API Gateway, CloudFront, S3, and CloudWatch all sit within always-free allowances
at this volume. See the cost breakdown discussion; set the budget alert regardless.

## Known limitations

- **30-second ceiling:** API Gateway HTTP API caps integration at 30s. A *cold*
  leaderboard that fetches many uncached tickers could approach this. Mitigations
  (later): smaller default set, or a cache-warming pass. Watchlist/scores calls are
  fine.
- **Cold starts:** container Lambda cold start adds ~1–2s occasionally; acceptable
  for a cached personal tool.
- **Auth:** `/v1` accepts a Cognito JWT (`sub`) or a guest id (`GUEST#<uuid>`,
  ADR-0009); the Cognito **sign-in UI + `migrate-guest` + 7-day guest TTL** are still
  pending. The interim `/ui` keeps Basic Auth until it's retired (see
  [deployments.md](deployments.md) § Retirement guidance).
- **Direct API Gateway URL is still public** and bypasses CloudFront — fine for now,
  lock it down when retiring interim surfaces ([deployments.md](deployments.md)).
- **`RemovalPolicy.DESTROY`** on the table *and the SPA bucket* for easy dev
  teardown — switch to `RETAIN` before storing anything you can't re-seed.
