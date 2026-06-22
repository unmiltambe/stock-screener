# ADR-0002 — Web/mobile code sharing: share non-UI layers, defer mobile build

- **Status:** Accepted (provisional)
- **Date:** 2026-06-21
- **Deciders:** Project owner
- **Relates to:** [ADR-0001](0001-backend-and-stack.md), [constitution P4](../constitution.md)

## Context

A mobile app (or first-class mobile web) is a plausible future, not a current
requirement. The decision is **how much the possibility of mobile should shape
today's design** — specifically how much code we share between web and a future
mobile client.

Selected weighting: **"design for it, defer the build"** — keep the mobile door
open cheaply now, build web only.

The trap to avoid: over-investing in cross-platform UI abstraction (write-once UI
for web + native) is where such projects sink — leaky abstractions,
lowest-common-denominator UX, and constant fighting of platform differences.

## Options considered

### A. Web-only, mobile as a footnote
- ➕ Least work now; no constraints on frontend choices.
- ➖ When mobile arrives, types/validation/API-client/view-logic are re-implemented → drift and double-maintenance.

### B. Share non-UI layers via a monorepo (CHOSEN)
Build web only now, but types, the API client, and framework-agnostic view logic
live in shared `/packages/*` consumable by a future React Native app. Rendered
components are **not** shared.

- ➕ Captures the bulk of duplication risk (contracts, validation, color
  thresholds, sorting/ranking) at near-zero coupling cost.
- ➕ A future mobile app reuses the non-visual half; only native screens are new.
- ➕ No cross-platform UI abstraction to maintain → no LCD tax.
- ➖ Requires monorepo discipline now (package boundaries; no UI imports leaking
  into shared packages).
- ➖ Implies React Native as the mobile choice; a pivot to native Swift/Kotlin would
  reuse only types-as-contract.

### C. First-class cross-platform UI (Expo + React Native Web / Tamagui)
- ➕ Maximum sharing, including screens.
- ➖ Build mobile now (or carry the abstraction cost before it pays) — contradicts "defer the build."
- ➖ Rich tables/charts are exactly where write-once-UI leaks; high risk for our most important screens.

### D. PWA only (responsive web, installable, no native)
- ➕ Cheapest sharing — identical code.
- ➖ iOS PWA limitations; no app-store presence; forecloses native capabilities.
- *(Partly free anyway: the web app is responsive per FR-7.3, so a decent
  mobile-web experience exists regardless.)*

## Decision

**Adopt Option B.** Stand up the monorepo with shared `/packages/{shared-types,
api-client, view-logic}` from the start; build only `/apps/web` now; scaffold
`/apps/mobile` (Expo) as an empty, documented placeholder. The web app is also
responsive (FR-7.3), so basic mobile-web usage exists immediately — this ADR is
about making the *eventual native app* cheap, not blocking on it.

## Where the sharing line sits

| Layer | Shared web ↔ mobile? | Rationale |
|-------|----------------------|-----------|
| API contract types | ✅ yes | One source of truth for shapes |
| API client (auth, fetch, errors) | ✅ yes | Endpoint knowledge lives once |
| View logic (formatting, color thresholds, sort/rank) | ✅ yes | Pure functions; identical everywhere |
| State/data-fetching hooks | ⚠️ mostly | Share keys/logic; platform shims allowed |
| Rendered components / navigation / styling | ❌ no | Native and web UX genuinely differ |

## Consequences

- Frontend work starts with package boundaries in place; reviews must keep UI
  imports out of `/packages/*` — the one rule that makes or breaks this ADR.
- The mobile choice is effectively React Native/Expo if/when it happens.
- If mobile is never built, the cost is small: a slightly more formal package layout
  that also benefits the web app's testability.
