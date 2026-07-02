# AGENTS.md

Guidance for an AI agent or new contributor working in this repo. Documents intent
and guardrails; not a substitute for [docs/constitution.md](docs/constitution.md)
and [docs/design.md](docs/design.md). For *how to work* (think first, keep changes
surgical, verify before done) see [CLAUDE.md](CLAUDE.md).

## What this project is

A multi-user stock **dashboard + watchlists + discovery engine**. Backend is
Python; the scoring math is in [docs/SCORING.md](docs/SCORING.md) and is **frozen**
— do not alter it as a side effect of infrastructure or feature work.

**Out of scope:** portfolio tracking, brokerage integration, automated trading.
Don't add them without an explicit decision (they were intentionally excluded).

## The rules that matter most

1. **Never leak presentation into the API** ([P1](docs/constitution.md)). Backend
   returns data; no colors, no HTML, no display strings. Hex codes in a Lambda
   response = stop.
2. **Keep the domain core pure** ([P3](docs/constitution.md)). `services/app/core`
   imports no web framework and does no IO. Network/cache/persistence are adapters
   around it. The discovery batch reuses this same core — don't fork the logic.
3. **No UI imports in `packages/*`** ([P4](docs/constitution.md), [ADR-0002](docs/decisions/0002-web-mobile-sharing.md)).
   Shared packages hold types, the API client, and pure view logic only — never
   React components. This rule keeps the mobile path open.
4. **Identity comes from the verified JWT only** ([P8](docs/constitution.md),
   NFR-3.1). Never read a `userId` from a path or body.
5. **Cache/precompute before you fetch** ([P5](docs/constitution.md)). Watchlist
   data goes through the cache adapter; the discovery universe is served from the
   scheduled batch snapshot — never fetch the universe on a user request path.

## Before you start a change

- Identify which **phase** of the [roadmap](docs/roadmap.md) the work belongs to.
  Don't pull later-phase concerns forward (e.g. don't build discovery before the
  core + API exist).
- Check the change against [P1–P10](docs/constitution.md). If it requires breaking a
  principle, write an ADR in `docs/decisions/` rather than doing it silently.
- **Record significant decisions before/while you build, not only when a principle
  breaks.** Write an ADR (or a short spec for a larger feature) when the change
  introduces an external/third-party dependency, sends user data off-platform, is a
  user-facing feature with more than one reasonable approach, or picks among
  alternatives with real tradeoffs. This is broader than the principle check above
  and doesn't wait to be asked — see [CLAUDE.md §5](CLAUDE.md). A change that grows
  from "trivial" into several decisions has crossed the line; stop and write it up.
  **ADR** = the decision + rationale + rejected alternatives; **spec** = the plan for
  a bigger feature.

## Conventions

- **Requirements** referenced by ID (e.g. `FR-6.3`) from
  [requirements.md](docs/requirements.md). Cite them in PRs and tests.
- **Decisions** are ADRs in `docs/decisions/NNNN-title.md` (see the trigger under
  "Before you start a change"). Don't edit accepted ones — supersede them.
- **Tests** live with the code; the pure core has the highest coverage (cheapest to
  test).
- **Secrets** never enter the repo (`.gitignore` blocks `*credentials*.json`, `.env`).

## What NOT to do

- Don't reintroduce server-side session state ([P2](docs/constitution.md)).
- Don't add an always-on component without an ADR — it breaks scale-to-zero
  ([P7](docs/constitution.md)).
- Don't change scoring formulas as part of infra work ([SCORING.md](docs/SCORING.md)
  is frozen; changes are deliberate and reviewed).
- Don't abstract UI across web and native ([ADR-0002](docs/decisions/0002-web-mobile-sharing.md)
  rejected this).
- Don't score the discovery universe on the request path ([ADR-0003](docs/decisions/0003-discovery-engine.md)).
- Don't `cdk deploy` without a reviewed `cdk diff` — confirm the only change is the
  intended one. Two context values (`basic_auth_pass`, `frontend_url`) silently
  revert live state (the `/ui` password; the prod Cognito callback → broken sign-in)
  if omitted ([deploy-aws.md](docs/deploy-aws.md)).
