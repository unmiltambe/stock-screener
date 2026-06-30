# Deploy the interim demo to Render

The shortest path to a public, password-protected site showing live scores. This
is the temporary stepping stone in [ADR-0005](decisions/0005-interim-demo-deployment.md),
not the final serverless target.

**Live URL:** https://stock-screener-demo.onrender.com

## What you get

The live URL above, behind HTTP Basic Auth, serves:

- `/ui` — read-only score tables for your watchlists (live yfinance data)
- `/v1/...` — the JSON API (also live)
- `/docs` — Swagger UI

## Prerequisites

- This branch merged/pushed to GitHub (the repo Render will build from).
- A free [Render](https://render.com) account (sign in with GitHub).

## Steps

1. **Push the code.** Ensure `render.yaml`, `services/deploy/render/Dockerfile`, and
   `services/deploy/render/requirements.txt` are on the branch you'll deploy.

2. **Create the service from the blueprint.**
   - Render dashboard → **New → Blueprint**.
   - Connect your `stock-screener` repo and pick the branch.
   - Render reads [`render.yaml`](../render.yaml) and proposes a web service
     named `stock-screener-demo` (Docker, free plan).

3. **Set the auth secrets** (Render will prompt — they're marked `sync: false`):
   - `BASIC_AUTH_USER` — e.g. `admin`
   - `BASIC_AUTH_PASS` — a strong password. **Required**: if unset, the site is
     open to anyone.

4. **Create / Apply.** Render builds the Docker image and deploys it (first build
   ~3–5 min). When it's live you get the public URL.

5. **Open the URL** → browser prompts for the Basic Auth credentials → you land on
   `/ui` with live scores.

## Notes & limits

- **Free tier sleeps** after ~15 min idle; the first request after sleep takes a
  few seconds to wake (and the first scores fetch is a cold yfinance call).
- **Storage is in-memory** (`STORE_BACKEND=memory`): watchlists are seeded on each
  start and edits don't persist across restarts. Persistent editing needs the
  DynamoDB path (a later step).
- **Data is live** (`DATA_BACKEND=yfinance`), cached 15 min.
- To change the seeded watchlists, edit the seed in
  [`services/app/api/deps.py`](../services/app/api/deps.py) and redeploy.

## Local parity

Run the exact same app locally:

```bash
cd services
DATA_BACKEND=yfinance BASIC_AUTH_USER=admin BASIC_AUTH_PASS=test python -m api
# open http://127.0.0.1:8000/ui  (login admin/test)
```

## Tearing it down later

The React SPA is now live on AWS CloudFront (the canonical app), so this Render
service is no longer needed *as the demo*. But [ADR-0007](decisions/0007-dual-deploy-portability.md)
deliberately keeps a second host as a **portability forcing function** — it costs
~nothing on the free tier and proves the app runs unchanged off AWS.

Decide explicitly whether to keep it (recommended) or delete it; the full
retirement procedure and trade-off live in
[deployments.md](deployments.md) § Retirement guidance. This page is the Render
entry in that map.
