# Local development & testing

How to run and test the backend on your machine — no AWS account required. The
app selects adapters from environment variables, so the same code runs offline
in-memory, against live market data, or against DynamoDB Local.

## Prerequisites

- Python 3.11+ recommended (3.9 works for the API; Lambda will run 3.12).
- A virtualenv for the backend.

```bash
cd services
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # FastAPI, uvicorn, yfinance, boto3, pytest, httpx
```

Run everything from this `services/` directory. The app packages live under
`app/` and import as top-level packages (`core`, `adapters`, `api`) via the path:
`pytest` picks it up from `pyproject.toml`; for the app, prefix `PYTHONPATH=app`.
No install of the local project is needed.

> Prefer an editable install (`pip install -e ".[runtime,dev]"`)? That needs
> **pip ≥ 21.3** for `pyproject.toml`-only projects — upgrade first with
> `pip install --upgrade pip`. The `requirements-dev.txt` path above avoids this
> entirely and works with any pip version.

## 1. Run the test suite

The pure core + adapters + API all have offline tests (deterministic, no network):

```bash
cd services
pytest                  # 89 tests
pytest app/core         # just the scoring core
```

## 2. Run the API locally (offline, in-memory)

Defaults to fixture market data + an in-memory store seeded with two watchlists
for a demo user — so there's data to see immediately.

```bash
cd services
source .venv/bin/activate       # so `uvicorn`/`python` resolve (macOS: it's python3)
DATA_BACKEND=yfinance uvicorn api.app:app --app-dir app --reload --port 8000
```

Then:

- **Swagger UI (easiest):** open <http://127.0.0.1:8000/docs> — every endpoint is
  listed with a "Try it out" button. This is the quickest way to poke the API.
- **curl:**
  ```bash
  curl localhost:8000/health                       # unversioned
  curl localhost:8000/v1/watchlists                # → [{id, name, count}, ...]
  # grab an id from the list above, then:
  WID=$(curl -s localhost:8000/v1/watchlists | python3 -c \
        "import sys,json;print(json.load(sys.stdin)[0]['id'])")
  curl "localhost:8000/v1/watchlists/$WID"         # scored rows
  curl "localhost:8000/v1/scores?tickers=NVDA,NFLX"
  curl localhost:8000/v1/leaderboard
  curl localhost:8000/v1/tickers/NVDA/chart
  curl -X POST localhost:8000/v1/watchlists -H 'content-type: application/json' \
       -d '{"name":"My List"}'                      # → { id, name }
  ```

### Auth in local mode

The demo user is used by default. To act as a different user (and confirm data
isolation), send a header:

```bash
curl localhost:8000/v1/watchlists -H 'X-User-Id: alice'   # empty — alice has no lists
```

In production this header path is replaced by the Cognito JWT authorizer (Phase 2);
the app already reads the user id only from this trusted source, never from the
path or body.

## 3. Run against live market data

Swap the market-data adapter to yfinance (still in-memory store):

```bash
cd services
DATA_BACKEND=yfinance uvicorn api.app:app --app-dir app --reload --port 8000
# now /scores?tickers=AAPL,TSLA returns real fundamentals & prices
```

Note: yfinance rate-limits; the adapter batches the price download and
parallelises `.info` (6 workers). Scores cache for 15 minutes.

## 4. Run against DynamoDB Local (optional)

To exercise the DynamoDB-backed store without AWS:

```bash
docker run -p 8001:8000 amazon/dynamodb-local

# create the single table (PK/SK) — one-time
aws dynamodb create-table --endpoint-url http://localhost:8001 \
  --table-name stock-screener \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

STORE_BACKEND=dynamo DDB_TABLE=stock-screener \
  AWS_ACCESS_KEY_ID=x AWS_SECRET_ACCESS_KEY=x AWS_REGION=us-east-1 \
  AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8001 \
  uvicorn api.app:app --app-dir app --reload --port 8000
```

## Environment variables

| Var | Values | Default | Meaning |
|-----|--------|---------|---------|
| `DATA_BACKEND` | `memory` \| `yfinance` | `memory` | Market-data source |
| `STORE_BACKEND` | `memory` \| `dynamo` | `memory` | Cache + watchlists + comments |
| `DDB_TABLE` | table name | — | Required when `STORE_BACKEND=dynamo` |
| `AUTH_MODE` | `header` \| `jwt` | `header` | `jwt` is the Phase 2 Cognito path |
| `PORT` | int | `8000` | Local server port |

## Running the web frontend locally

The React SPA lives in `apps/web`. Run it against the local backend:

```bash
# terminal 1 — backend (port 8000)
cd services && source .venv/bin/activate
DATA_BACKEND=yfinance uvicorn api.app:app --app-dir app --reload --port 8000

# terminal 2 — SPA (port 5173)
cd apps/web && npm install && npm run dev
```

Open <http://localhost:5173>. Vite proxies `/v1` + `/health` to `:8000`
(see `vite.config.ts`), mirroring prod's same-origin model — no CORS locally, and
the SPA uses relative API paths. In `header` mode the backend resolves to the
seeded demo user (the SPA's `X-Guest-Id` header is ignored locally), so you see the
demo watchlists immediately.

## Where this fits

- **Cloud deploys** (AWS API Gateway + CloudFront, Render) and how to retire the
  interim surfaces: [deployments.md](deployments.md).
- **Auth:** `header` locally; `jwt` (Cognito + guest sessions) when deployed.
