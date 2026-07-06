# Project structure

The canonical, annotated tree. Other docs link here rather than redrawing it, so
there's one source of truth.

```
stock-screener/
├── README.md                     project intro + build status
├── AGENTS.md                     guardrails for agents/contributors (→ repo root)
├── render.yaml                   Render blueprint — MUST stay at repo root (ADR-0005/0007)
│
├── apps/                         frontends
│   ├── web/                      React + Vite + TypeScript SPA — built & deployed (Phase 3)
│   │                               features/: landing (marketing home), watchlists
│   │                               (dashboard + shared TickerTable/ChartPanel), tickers, account
│   └── mobile/                   React Native / Expo — placeholder (Phase 5)
│
├── packages/                     shared TS for web↔mobile (Phase 3) — placeholders
│   ├── shared-types/             API contract types
│   ├── api-client/               typed fetch client
│   └── view-logic/               formatting + red→yellow→green thresholds
│
├── services/                     the Python backend
│   ├── app/                      ★ SHARED, hosting-agnostic application
│   │   ├── core/                 pure scoring — no IO, no framework (SCORING.md, P3)
│   │   ├── adapters/             IO boundary: ports + impls
│   │   │                           memory (offline/tests), dynamo (AWS), yfinance,
│   │   │                           retry (source-agnostic backoff helper)
│   │   ├── api/                  FastAPI app, service, deps, schemas, handler (Mangum),
│   │   │                           auth (Cognito JWT + interim Basic-Auth), demo_ui,
│   │   │                           seed_watchlists.json
│   │   └── discovery/            Phase 4 batch (placeholder)
│   │
│   ├── deploy/                   ★ HOSTING-SPECIFIC config (one app, two targets)
│   │   ├── render/
│   │   │   ├── Dockerfile        uvicorn web-server image
│   │   │   └── requirements.txt  Render runtime deps
│   │   └── aws/
│   │       ├── Dockerfile        AWS Lambda image (Mangum entrypoint)
│   │       ├── requirements.txt  Lambda runtime deps
│   │       ├── seed_dynamo.py    one-time DynamoDB seeding
│   │       └── cdk/              AWS CDK app (Python): DynamoDB + Lambda + API Gateway
│   │           ├── app.py  cdk.json  requirements.txt
│   │           └── stacks/stock_screener_stack.py
│   │
│   ├── pyproject.toml            ★ SHARED dev tooling: pytest config only
│   └── requirements-dev.txt      ★ SHARED dev tooling: local dev + test deps
│
└── docs/
    ├── README.md                 docs index (reading order)
    ├── workflow.md               single change→verify→document→ship checklist
    ├── constitution.md           P1–P10 design principles
    ├── requirements.md           EARS functional/non-functional requirements
    ├── SCORING.md                scoring model — frozen
    ├── design.md                 target architecture
    ├── screens.md                screen-by-screen UI spec (S0–S7)
    ├── ui-columns.md             every table column — definitions, colours, tooltips
    ├── voice.md                  UI voice & tone
    ├── structure.md              ← this file
    ├── deployments.md            environment map (local, Render, API GW, CloudFront)
    ├── deploy-aws.md             AWS deploy (architecture, control flows, steps)
    ├── local-dev.md              run & test locally
    ├── roadmap.md                phases 0–5
    ├── backlog.md                captured-but-unbuilt enhancements
    ├── images/                   README screenshots (captured from the running app)
    ├── specs/                    feature specs (day-change, ticker-autocomplete, home-landing)
    └── decisions/                ADRs 0001–0011
```

## The three categories (the mental model)

| Category | Where | What |
|----------|-------|------|
| **Shared app** | `services/app/**` | The application. Hosting-agnostic. Deployed to *both* targets unchanged. |
| **Hosting-specific** | `services/deploy/<platform>/**` (+ root `render.yaml`) | How the app is packaged & provisioned per platform. |
| **Shared dev tooling** | `services/pyproject.toml`, `services/requirements-dev.txt` | Test config + local-dev deps. Not runtime, not per-platform. |

## How a deploy target is selected

There's **no runtime switch** — they're two deployments of the same code differing in:

| | Render | AWS |
|---|--------|-----|
| Packaging | `deploy/render/Dockerfile` | `deploy/aws/Dockerfile` |
| Entrypoint | `uvicorn api.app:app` (server) | `api.handler.handler` (Mangum/Lambda) |
| `STORE_BACKEND` | `memory` | `dynamo` |
| Provisioning | `render.yaml` (root) | `deploy/aws/cdk/` |

The only code that branches is [`app/api/deps.py`](../services/app/api/deps.py), which
reads `STORE_BACKEND` / `DATA_BACKEND` env vars and picks adapters. Keeping *both*
targets working is a deliberate portability check — see [ADR-0007](decisions/0007-dual-deploy-portability.md).

## Theming — one source of truth

The entire look (palette + fonts) is driven from **`apps/web/src/index.css` `@theme`**
tokens (`--color-*`, `--font-*`). Components consume them via Tailwind classes
(`text-accent`, `bg-panel`, `font-mono`); semantic colour logic lives in
`lib/format.ts` and returns those classes. Recharts can't read CSS variables in SVG
attributes, so `lib/chartColors.ts` resolves the same tokens at runtime — the charts
re-skin from the identical source. **Changing the palette or fonts is a one-file edit
in `index.css`.** See [voice.md](voice.md) for tone.

> **Strict rule — no hardcoded look-and-feel, anywhere.** Colours, fonts, and other
> visual constants live ONLY in `index.css` `@theme` (with `lib/chartColors.ts` as the
> sole runtime bridge for canvas/SVG that can't read CSS vars). Never write a hex
> colour, `rgb()/hsl()`, or a raw font stack in a component, inline `style`, or
> elsewhere — reference a token via a Tailwind class or `chartColors()`. New visual
> dimensions (spacing scales, radii, shadows, z-index) get a token too. A quick guard:
> `grep -rnP "#[0-9a-fA-F]{6}" apps/web/src --include=*.tsx --include=*.ts` should match
> nothing outside `index.css`/`chartColors.ts`. This keeps re-theming a one-file change.

## Imports & running locally

`core` / `adapters` / `api` are **top-level packages** physically located under
`app/`. Tests resolve them via `pythonpath = ["app"]` in `pyproject.toml`
(`cd services && pytest`); to run the app, prefix `PYTHONPATH=app` (see
[local-dev.md](local-dev.md)). The deploy images copy `app/<pkg>` to their root, so
the runtime import path is just `api.handler` / `api.app` — unchanged across hosts.

## Dependency files (one source of truth each)

| File | Purpose |
|------|---------|
| `services/requirements-dev.txt` | local dev + tests (run + pytest) |
| `services/deploy/render/requirements.txt` | Render runtime |
| `services/deploy/aws/requirements.txt` | Lambda runtime |
| `services/deploy/aws/cdk/requirements.txt` | CDK (`aws-cdk-lib`) |

`pyproject.toml` declares **no** dependencies — only pytest config — so nothing is
duplicated.
