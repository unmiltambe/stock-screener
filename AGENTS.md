# AGENTS.md — working in this repo

The single guide for an AI agent or new contributor: **how to work** (§1–5) and
**what the guardrails are** (the sections after). Architecture principles live in
[docs/constitution.md](docs/constitution.md) (P1–P10); the sequenced
change → verify → document → ship checklist is [docs/workflow.md](docs/workflow.md).

The §1–5 working style is adapted from Karpathy's coding guidelines; the
constitution's principles take precedence where they overlap.

## What this project is

A multi-user stock **dashboard + watchlists + discovery engine**. Backend is
Python; the scoring math is in [docs/SCORING.md](docs/SCORING.md) and is **frozen**
— do not alter it as a side effect of infrastructure or feature work.

**Out of scope:** portfolio tracking, brokerage integration, automated trading.
Don't add them without an explicit decision (they were intentionally excluded).

---

## 1. Think before coding

Don't assume, don't hide confusion, surface tradeoffs. If a request has more than
one reasonable reading, say so and pick — don't choose silently. When a design has
real alternatives (as most UI work here does), lay them out with a recommendation
rather than implementing the first thing that compiles.

## 2. Simplicity first

Minimum code that solves the problem, nothing speculative. No unrequested
features, no abstraction for a second caller that doesn't exist yet, no defensive
handling for impossible states. Extract shared code when there *is* duplication
([P9](docs/constitution.md)), not in anticipation of it.

## 3. Surgical changes

Touch only what the task requires. Don't refactor working code you happened to
read, don't restyle unrelated sections, match the surrounding conventions. Clean
up only the mess your own change created.

## 4. Loop until verified — typecheck is not verification

Define what "done" looks like before starting, then prove it. In this repo,
`tsc --noEmit` passing is **not** proof: it has silently passed while the app was
broken (a type-only export that broke the bundle; a page that rendered blank).

Before declaring a frontend change done:
- Run the real bundle: `cd apps/web && npm run build` (`tsc -b` + `vite build` —
  catches what `tsc` alone misses, e.g. type-only import resolution).
- Load the affected page — the loading, empty, and populated states.

Report outcomes honestly. If something is untested, say so; don't imply
verification that didn't happen.

**"Done" includes the paper trail.** If the change maps to a backlog item, close
the loop on it *as part of finishing*: update its status (✅ done / ◑ partial),
link the spec/ADR, and record what was deliberately deferred. A shipped feature
whose backlog entry still says "planned" is not done — and a doc that claims to
list "every column" / "every ADR" is stale the moment your change adds one. Update
the reference docs your change touches in the same breath, not when someone
notices — the trigger list is [workflow.md §3](docs/workflow.md).

## 5. Record decisions, not just code

Surfacing a tradeoff in chat (§1) is not the same as capturing it. A recommendation
spoken in conversation is gone the next session; a future contributor sees the
resulting code with no idea what else was considered or why. **Persist the decision
to a doc as part of the work, not as an afterthought someone has to ask for.**

Write an ADR (`docs/decisions/NNNN-title.md`) — or a short spec for a larger feature
— when a change does any of:
- introduces an external/third-party dependency (a SaaS, a new library, a hosted service);
- sends user data off-platform, or changes where data lives;
- is a user-facing feature with more than one reasonable approach;
- picks among alternatives that carry real, lasting tradeoffs.

This trigger is **independent of the P1–P10 check**: a change can violate no
principle and still deserve a recorded decision (the principles don't watch for
external dependencies or data residency). Don't wait to be asked.

And reassess mid-flight: a change that *started* as a one-liner but has accumulated
several decisions across a few turns has outgrown "trivial" — stop and write it up
before finishing. ADR = the decision + rationale + alternatives rejected; spec = the
plan for a bigger feature. When unsure which, an ADR is the cheaper default.

---

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
- Check the §5 ADR/spec triggers — they're broader than the principle check and
  don't wait to be asked.

## Conventions

- **Requirements** referenced by ID (e.g. `FR-6.3`) from
  [requirements.md](docs/requirements.md). Cite them in PRs and tests.
- **Decisions** are ADRs in `docs/decisions/NNNN-title.md` (triggers in §5).
  Don't edit accepted ones — supersede them.
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
- Don't `cdk deploy` without a reviewed `cdk diff` — use
  [`deploy.sh`](services/deploy/aws/deploy.sh), which encodes the footguns
  ([deploy-aws.md](docs/deploy-aws.md)).
