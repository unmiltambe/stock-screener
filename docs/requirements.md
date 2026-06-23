# Requirements

Written in **EARS** (Easy Approach to Requirements Syntax):

- **Ubiquitous** — "The system shall …"
- **Event-driven** — "WHEN \<trigger\>, the system shall …"
- **State-driven** — "WHILE \<state\>, the system shall …"
- **Unwanted** — "IF \<condition\>, THEN the system shall …"
- **Optional** — "WHERE \<feature\>, the system shall …"

`FR` = functional, `NFR` = non-functional. IDs are stable references for the
design doc and tasks.

---

## 1. Accounts & Authentication

- **FR-1.1** WHEN an unauthenticated visitor requests any data endpoint, THEN the system shall reject with `401` and return no user data.
- **FR-1.2** The system shall allow signup with email + password.
- **FR-1.3** WHEN a user signs up, the system shall require email verification before granting data access.
- **FR-1.4** WHEN a user logs in successfully, the system shall issue a JWT scoped to that identity.
- **FR-1.5** WHILE a valid unexpired JWT is presented, the system shall serve only data owned by the identity in that token.
- **FR-1.6** IF a JWT is expired or invalid, THEN the system shall reject with `401`.

## 2. Watchlists

- **FR-2.1** The system shall let a user create, rename, and delete named watchlists, each addressed by a stable opaque id whose URL is unchanged by rename ([ADR-0004](decisions/0004-stable-resource-ids.md)).
- **FR-2.2** The system shall let a user add and remove tickers within a watchlist.
- **FR-2.3** A watchlist and its tickers shall be private to the owning user.
- **FR-2.4** WHEN a new user first signs in with no watchlists, the system shall seed a starter watchlist so the experience is non-empty.
- **FR-2.5** IF a user adds a symbol that resolves to no market data, THEN the system shall accept it but flag it unresolved rather than failing the whole watchlist.

## 3. Scoring & Market Data

- **FR-3.1** WHEN a watchlist is requested, the system shall return each ticker with its Fundamental, Technical, and Combined scores and Signal, per [SCORING.md](SCORING.md).
- **FR-3.2** The scoring logic shall match [SCORING.md](SCORING.md) exactly (carried over, not redesigned).
- **FR-3.3** WHEN scores for a ticker are requested and a fresh cached value exists (age < 15 min), the system shall serve the cache without an upstream fetch.
- **FR-3.4** WHEN no fresh cache exists, the system shall fetch upstream once, cache with a 15-minute TTL, and serve.
- **FR-3.5** IF an upstream fetch fails, THEN the system shall return that ticker in a clearly marked error state rather than failing the entire response.
- **FR-3.6** The system shall return per-ticker chart data (price, SMA-50, SMA-200) for a requested lookback window.

## 4. Comments  *(removed — deferred; see Out of scope)*

Per-ticker user notes existed in the prototype but are not used. Dropped from this
iteration to keep the surface minimal; may return later as a private, user-scoped
resource.

## 5. Leaderboards

- **FR-5.1** The system shall aggregate all of a user's watchlists into ranked views (top opportunities, reconsider, best value, best momentum, buy the dip).
- **FR-5.2** WHEN a ticker appears in multiple of a user's watchlists, the leaderboard shall represent it once and list its memberships.
- **FR-5.3** WHEN a user selects a leaderboard row, the frontend shall show that ticker's chart without a full navigation/reload.

## 6. Discovery / Screener  *(the new direction — see [ADR-0003](decisions/0003-discovery-engine.md))*

- **FR-6.1** The system shall maintain a scored ranking of a defined **universe** of stocks (beyond any user's watchlists).
- **FR-6.2** The system shall let a user screen the universe by configurable factors — at minimum: minimum Fundamental / Technical / Combined score, PEG / ROE / FCF-yield bounds, RSI / 52W-range band, sector, and market-cap range.
- **FR-6.3** WHEN a user runs a screen, the system shall return matching tickers ranked by a chosen factor, served from precomputed data (not a live per-request universe fetch — see [P5](constitution.md)).
- **FR-6.4** The system shall offer a **suggestions** view: top-ranked universe names that are **not** already in any of the user's watchlists.
- **FR-6.5** WHEN viewing a suggested or screened ticker, the user shall be able to add it to a watchlist in one action.
- **FR-6.6** IF the scoring caveats in [SCORING.md](SCORING.md) make a ticker's score unreliable (e.g. ETF, bank), THEN the screener shall handle it explicitly (suppress or flag) rather than surfacing a misleading rank. *(Mechanism is an open question in ADR-0003.)*
- **FR-6.7** The system shall refresh the universe ranking on a schedule (target: daily), not on the user request path.

## 7. Frontend (Web)

- **FR-7.1** The web frontend shall render watchlists, leaderboards, charts, and the screener/suggestions as a single-page application.
- **FR-7.2** The web frontend shall color-code metrics on a red→yellow→green scale using thresholds in a shared view-logic layer ([P1](constitution.md)/[P4](constitution.md)).
- **FR-7.3** WHERE the viewport is mobile-width, the web frontend shall present a usable responsive layout.

---

## Non-Functional Requirements

### Cost
- **NFR-1.1** WHILE traffic is zero, the system shall incur only storage + baseline CDN/DNS cost (target: < $2/month idle), including the discovery batch job.
- **NFR-1.2** The system shall cost single-digit dollars/month at tens of active users.

### Performance
- **NFR-2.1** WHEN serving cached watchlist scores, the API shall respond within 500 ms (p95), excluding cold start.
- **NFR-2.2** WHEN a cold upstream fetch for N tickers is required, the system shall parallelize fetches to keep wall-clock time bounded.
- **NFR-2.3** WHEN a user runs a screen, the response shall come from precomputed rankings so latency is independent of universe size.

### Security & Privacy
- **NFR-3.1** The system shall isolate each user's data so no request can read another user's watchlists or comments.
- **NFR-3.2** Secrets (any data-provider API keys) shall live in a managed secrets store, never in source control or client code.
- **NFR-3.3** All client/server traffic shall be over HTTPS.

### Operability
- **NFR-4.1** The entire stack (incl. the batch scheduler) shall be reproducible from code (IaC) into a clean AWS account.
- **NFR-4.2** The system shall emit structured logs and metrics (request count, error rate, cache hit rate, upstream-fetch count, batch run status).

### Portability (mobile-readiness)
- **NFR-5.1** The backend shall make no assumption about which frontend calls it ([P1](constitution.md)), so a future mobile client needs no backend change.
- **NFR-5.2** Non-visual frontend layers (types, API client, view logic) shall be packaged for reuse by a future mobile app without modification.

---

## Out of scope (this iteration)

- Portfolio tracking, brokerage integration, and automated/agentic trade execution
  (the prototype's Alpaca + leveraged-ETF strategy). May return later as a separate
  bounded context.
- Real-time streaming quotes (15-min cached / daily-batch data is sufficient).
- Social/sharing features between users.
- News-sentiment scoring (a documented future enhancement, not built now).
- Per-ticker comments/notes (in the prototype; unused, deferred).
