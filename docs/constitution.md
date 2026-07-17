# Constitution — Design Principles

These are the load-bearing principles for the project. Every architecture
decision, API shape, and code review should be checkable against this list. When a
principle must be broken, that is a decision worth recording in an ADR — not a
default to drift into silently.

---

## P1 — API-first: the backend never renders UI

The backend returns **data** (JSON), never HTML, never layout or color decisions.
Any presentation concern — how a score is formatted, what color a metric gets, how
a table is laid out — lives in a frontend.

*Why:* this is what lets web, a future mobile app, a CLI, or an agent all consume
the same backend without change. It is the single principle that makes everything
else (multi-frontend, mobile-later) possible.

*Smell to catch in review:* a backend function returning a hex color, an HTML
string, or a "display label" is leaking presentation into the API. The
red→yellow→green thresholds are **presentation logic** and belong in a shared
frontend layer (see P4), not in the API response.

## P2 — Stateless requests

Every API request carries everything needed to serve it: a JWT for identity, and
explicit parameters. There is no server-side session affinity; any Lambda instance
can serve any request.

*Why:* stateless is what makes pay-per-request compute (Lambda) natural and
horizontal scale free. Server-side session state is what forces an app onto
always-on compute.

## P3 — Pure domain logic, isolated from IO and frameworks

The scoring functions (see [SCORING.md](SCORING.md)) take plain numbers in and
return plain numbers out. They import no web framework, touch no network, read no
global state.

*Why:* pure logic is trivially testable, portable across runtimes, and the part of
the system least likely to need rewriting.

*Rule:* network calls (market data), caching, and persistence are **adapters**
that surround the pure core, never woven into it.

## P4 — Share by layer, not by accident

Code shared between frontends (web today, mobile later) is shared **deliberately,
by layer**: types, the API client, validation, and framework-agnostic view logic
(formatting, sorting, color thresholds). Rendered components are **not** shared.
See [ADR-0002](decisions/0002-web-mobile-sharing.md).

*Why:* sharing the non-visual layers captures most of the duplication risk at
near-zero coupling cost. Trying to share actual UI across web and native is where
cross-platform projects historically drown.

## P5 — Never hit an external data source per user request

Market data is fetched once and cached with a TTL (15 min for live scores). N users
viewing the same ticker cause one upstream fetch, not N. For the **discovery
universe** (potentially thousands of tickers), data is precomputed by a scheduled
batch job, never fetched on the user's request path — see
[ADR-0003](decisions/0003-discovery-engine.md).

*Why:* free market-data sources rate-limit aggressively (the prototype was already
401'd by sequential fetches). A shared cache + batch precompute is both a cost
control and a reliability requirement, not an optimization.

## P6 — Infrastructure as code, reproducible from zero

The entire stack — Lambda, API Gateway, DynamoDB, Cognito, S3, CloudFront, the
batch scheduler — is defined in code (CDK) and deployable to a fresh AWS account
with one command. No console click-ops as the source of truth.

## P7 — Cost scales to zero

At zero traffic the system should cost approximately zero (only storage and the
CDN/DNS baseline). Cost should track usage, not uptime. The discovery batch job is
periodic and cheap; the request path is serverless.

## P8 — Security is not deferred

Per-user data isolation and authenticated access are table stakes from the first
deployed endpoint — not a later phase. Secrets (any data-provider API keys) live in
a managed secrets store, never in the repo or client code. A public URL with
personal data and no auth is the one thing we will not ship.

## P10 — No domain logic in the frontend

The frontend renders; the backend decides. Scoring, filtering, signal detection, and
any calculation that derives a fact about a ticker belong in `services/app/core`.
The frontend's permitted logic is: formatting numbers for display, mapping scores to
colours, sorting/filtering data the API already returned, and framework-specific
view wiring.

*Why:* domain logic in the frontend creates two problems: (1) it duplicates a
parameter or threshold that the backend already owns, so a change requires two edits
and the two can silently drift; (2) it is harder to test — unit tests for backend
pure functions are trivial, but testing frontend calculations requires rendering.

*Smell to catch in review:* any `lib/` file in the frontend that computes a business
fact (crossover detection, score derivation, signal classification) rather than
formatting or presentation logic.

## P9 — No UI component duplication across feature files

Before adding any component, helper function, or constant that already exists (or
nearly exists) in another feature file, extract it to a shared location first.
Feature-specific variations are handled via **props or render-prop slots** — not
separate copies of the file.

*Why:* we've been burned by this twice. `WatchlistDetailPage` and `AllSymbolsPage`
independently accumulated identical `RangeBar`, `Th`, `ChartPanel`,
`TickerTableRow`, `TIPS`, `ACCESSORS`, `makeTickFmt`, `PanelTooltip`, and chart
constants. A change to one (font, color, label) didn't propagate to the other
because there was nothing to enforce sharing.

*Rule:* if you find yourself copying a component out of one feature file into
another, stop. Extract it to a shared file (`TickerTable.tsx`, `lib/`, etc.) and
import it in both places. The two views then differ only in what they pass via
props. Search the codebase before writing any new component.

*Smell to catch in review:* two files with the same function or component name and
similar implementations.

## P10 — The client renders correctly in every async state

A view that reads server data must render safely for **all** of loading, empty,
guest, authenticated, and error — not just the happy path where data is present.
Data fetches gate on the state they depend on (e.g. don't fetch user data until
auth has resolved), and no render path assumes data that may still be `undefined`.

*Why:* we've been burned twice. A non-null assertion (`data!.length`) on a pending
query blanked the page; and user watchlists flashed guest data on refresh because
the fetch fired before the auth token was set. Both were a *missing state*, not a
logic error — the happy path worked fine in dev.

*Rule:* when adding a query-backed view, enumerate its states before writing the
markup. Gate the query (`enabled`) on its prerequisites; guard every render on
`isLoading` / `!data`; give empty and error their own branch. Effect **ordering**
matters — a value another effect depends on (an auth token) belongs in
`useLayoutEffect`, which runs before `useEffect` fetch triggers.

*Smell to catch in review:* a `!` non-null assertion on query data, or a fetch
with no `enabled` guard that depends on auth or route state.

---

## How to use this document

- A new feature or PR should be expressible without violating P1–P10. If it can't,
  open an ADR explaining the exception.
- Principles are ordered by how expensive they are to retrofit. P1, P2, P3 are
  foundational — getting them wrong means a rewrite. P5–P7 can be tightened
  iteratively.
