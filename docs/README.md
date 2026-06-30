# Docs — Spec Series

Specification for stock-screener. Conventions: **EARS** for requirements, **ADR**
(Nygard format) for decisions, root **AGENTS.md** for contributor/agent guidance.

## Reading order

| # | Doc | Purpose |
|---|-----|---------|
| 1 | [constitution.md](constitution.md) | Non-negotiable design principles (P1–P8). The north star. |
| 2 | [requirements.md](requirements.md) | What the system must do, testable, in EARS form. |
| 3 | [SCORING.md](SCORING.md) | The scoring model (carried over, frozen). Canonical reference for `services/app/core`. |
| 4 | [design.md](design.md) | Target architecture: layers, API, auth, data model, caching, discovery batch, monorepo. |
| 5 | [screens.md](screens.md) | Screen-by-screen UI spec (S1–S6): purpose, data, actions, layout, build status. |
| 6 | [decisions/0001-backend-and-stack.md](decisions/0001-backend-and-stack.md) | ADR: React + Lambda over the alternatives. |
| 7 | [decisions/0002-web-mobile-sharing.md](decisions/0002-web-mobile-sharing.md) | ADR: share non-UI layers, defer mobile. |
| 8 | [decisions/0003-discovery-engine.md](decisions/0003-discovery-engine.md) | ADR: scheduled batch over a defined universe. |
| 9 | [decisions/0004-stable-resource-ids.md](decisions/0004-stable-resource-ids.md) | ADR: stable watchlist ids + API versioning. |
| 10 | [decisions/0005-interim-demo-deployment.md](decisions/0005-interim-demo-deployment.md) | ADR: interim server-rendered `/ui` (UI temporary; Render path kept per 0007). |
| 11 | [decisions/0006-cdk-python-container-lambda.md](decisions/0006-cdk-python-container-lambda.md) | ADR: Python CDK + container-image Lambda. |
| 12 | [decisions/0007-dual-deploy-portability.md](decisions/0007-dual-deploy-portability.md) | ADR: keep AWS + Render as a portability forcing function. |
| 13 | [decisions/0008-app-level-cognito-jwt.md](decisions/0008-app-level-cognito-jwt.md) | ADR: app-level Cognito JWT validation + Hosted UI. |
| 14 | [decisions/0009-guest-session-before-login.md](decisions/0009-guest-session-before-login.md) | ADR: guest session before login (try the app before signing in). |
| 15 | [structure.md](structure.md) | Canonical project tree + how the two deploys are selected. |
| 16 | [roadmap.md](roadmap.md) | Phased build sequence (0–5). |

### Reference & operations

| Doc | Purpose |
|-----|---------|
| [ui-columns.md](ui-columns.md) | Reference: every table column — definition, colour thresholds, tooltips, sort/persistence behaviour. |
| [deploy-aws.md](deploy-aws.md) | AWS architecture, control flows, deploy steps. Live URL at top. |
| [deploy-render.md](deploy-render.md) | Deploy the interim demo to a public URL. Live URL at top. |
| [local-dev.md](local-dev.md) | Run & test the backend locally. |

## Status

Active build. Backend (Phases 0–2) is implemented and deployed on AWS
(Lambda + API Gateway + DynamoDB); the React web app (Phase 3) is built —
watchlists, All Symbols, charts, and ticker detail — with guest auth and
S3/CloudFront hosting still pending. Phased build order is in the
[roadmap](roadmap.md).
