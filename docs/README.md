# Docs — Spec Series

Specification for stock-screener. Conventions: **EARS** for requirements, **ADR**
(Nygard format) for decisions, root **AGENTS.md** for contributor/agent guidance.

## Reading order

| # | Doc | Purpose |
|---|-----|---------|
| 1 | [constitution.md](constitution.md) | Non-negotiable design principles (P1–P8). The north star. |
| 2 | [requirements.md](requirements.md) | What the system must do, testable, in EARS form. |
| 3 | [SCORING.md](SCORING.md) | The scoring model (carried over, frozen). Canonical reference for `services/core`. |
| 4 | [design.md](design.md) | Target architecture: layers, API, auth, data model, caching, discovery batch, monorepo. |
| 5 | [decisions/0001-backend-and-stack.md](decisions/0001-backend-and-stack.md) | ADR: React + Lambda over the alternatives. |
| 6 | [decisions/0002-web-mobile-sharing.md](decisions/0002-web-mobile-sharing.md) | ADR: share non-UI layers, defer mobile. |
| 7 | [decisions/0003-discovery-engine.md](decisions/0003-discovery-engine.md) | ADR: scheduled batch over a defined universe. |
| 8 | [decisions/0004-stable-resource-ids.md](decisions/0004-stable-resource-ids.md) | ADR: stable watchlist ids + API versioning. |
| 9 | [roadmap.md](roadmap.md) | Phased build sequence (0–5). |
| — | [local-dev.md](local-dev.md) | Run & test the backend locally. |

## Status

Draft / target-state. No application code yet — this establishes principles,
contracts, and plan. The build order is in the roadmap.
