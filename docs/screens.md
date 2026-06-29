# Screen specification

Lightweight intent doc for the React SPA. Each entry captures: what the screen
**is for**, what **data it needs**, what **actions** it exposes, and a rough
**layout sketch**. Visual polish evolves in the browser; this doc exists to
prevent screens from overlapping or missing features, and to be the checklist
we work from.

> Related: [design.md](design.md) for data model and API, [roadmap.md](roadmap.md)
> for build sequence.

---

## Navigation shell (App.tsx)

**Status:** ✅ built (top nav bar)

A persistent header with the app name and nav links. Wraps every screen.

Pending decision: **sidebar vs top nav.** Current top bar is minimal (good for
now). When we have 4+ nav destinations we may want a collapsible sidebar.
Decision deferred until we see how many top-level screens stabilize.

---

## S1 — Watchlists index

**Route:** `/`  
**Status:** ✅ built

**Job:** entry point; shows everything a user is tracking at a glance.

**Data:** `GET /v1/watchlists` → `[{id, name, count}]`

**Layout:**
```
[+ New watchlist]                           ← primary action, top-right
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Tech Leaders │ │ Value Plays  │ │ Growth Watch │
│ 8 tickers    │ │ 5 tickers    │ │ 12 tickers   │
│ [Edit] [Del] │ │ [Edit] [Del] │ │ [Edit] [Del] │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Actions:**
- Click card → navigate to S2 (watchlist detail)
- "+ New watchlist" → inline modal: name input → POST /v1/watchlists
- Rename → inline edit on card (double-click or pencil icon) → PATCH /v1/watchlists/:id
- Delete → confirm dialog → DELETE /v1/watchlists/:id

**Pending:** action buttons and modal — next build item.

---

## S2 — Watchlist detail

**Route:** `/watchlists/:id`  
**Status:** ✅ built (read-only table)

**Job:** show the scored table for one watchlist; let the user manage tickers.

**Data:** `GET /v1/watchlists/:id` → `[TickerRow]`

**Layout:**
```
← Watchlists   [Tech Leaders ▾ rename]     [+ Add ticker]

Ticker  Company              Price    Fund  Tech  Combined  Signal
AAPL    Apple Inc.           $213.07   72    68       70     Hold  ←── row color by signal
NVDA    NVIDIA Corporation   $875.20   81    91       86     Buy
MSFT    Microsoft            $415.33   74    71       73     Hold
────────────────────────────────────────────────
                                              [×] on hover removes ticker
```

**Actions:**
- `[+ Add ticker]` → search/typeahead input → POST /v1/watchlists/:id/tickers
- Hover row → show `[×]` → DELETE /v1/watchlists/:id/tickers/:ticker
- Click ticker symbol → navigate to S3 (ticker detail)
- Rename via header (pencil or click name)
- Stale badge on row when `stale: true`

**Pending:** add/remove ticker actions, ticker click → S3.

---

## S3 — Ticker detail

**Route:** `/tickers/:symbol`  
**Status:** ⬜ not built

**Job:** deep-dive on one stock — chart, all metrics, signal history.

**Data:**
- `GET /v1/tickers/:symbol/chart` → price series + moving averages
- `GET /v1/scores?tickers=:symbol` → full TickerRow with all metrics

**Layout:**
```
← back   NVDA  NVIDIA Corporation              $875.20  ▲ +2.3%

[1W] [1M] [3M] [1Y]
┌──────────────────────────────────────────────────────┐
│  price chart + MA50/MA200                            │
└──────────────────────────────────────────────────────┘

Scores          Metrics
Fund   81       P/E  39.1    EPS growth  +112%
Tech   91       P/B   22     Rev growth   +82%
Combined 86     Mkt cap $2.1T

Signal: BUY     [appears in my watchlists: Tech Leaders, Growth Watch]
```

**Actions:** timeframe toggle for chart, "add to watchlist" quick-add.

---

## S4 — Leaderboard

**Route:** `/leaderboard`  
**Status:** ⬜ not built

**Job:** cross-watchlist ranked view — "my best stocks right now" without
navigating each watchlist separately.

**Data:** `GET /v1/leaderboard` → `[TickerRow]` sorted by combined score,
de-duplicated across all user watchlists.

**Layout:**
```
Leaderboard — top picks across all your watchlists

[Sort: Combined ▾]  [Filter: Buy only □]

Rank  Ticker  Company        Fund  Tech  Combined  Signal  Lists
  1   NVDA    NVIDIA          81    91      86       Buy    Tech Leaders, Growth
  2   AMZN    Amazon          78    80      79       Buy    Value Plays
  3   AAPL    Apple           72    68      70      Hold    Tech Leaders
...
```

**Actions:** sort by fund/tech/combined, filter to Buy-only, click row → S3.

---

## S5 — Auth (sign-in nudge, not a gate)

**Route:** handled in App shell (no separate URL)  
**Status:** ⬜ not built  
**Decision:** [ADR-0009](decisions/0009-guest-session-before-login.md)

**Job:** let guests use the full app immediately. Offer sign-in persistently but
non-intrusively; migrate their data when they do sign in.

**Guest flow:**
1. First visit → auto-generate `guestId` UUID in `sessionStorage`
2. All API calls send `X-Guest-Id: <uuid>` (no Authorization header)
3. Backend assigns identity `GUEST#<uuid>`, stores with 7-day TTL
4. User gets full CRUD — create watchlists, add tickers, see scores

**Sign-in flow (when user chooses to):**
1. Click "Sign in" → redirect to Cognito Hosted UI
2. Hosted UI redirects back with `?code=...` → exchange for tokens → store in `sessionStorage`
3. Call `POST /v1/auth/migrate-guest` with `{ guest_id }` → watchlists copied to Cognito account
4. Clear `guestId` from sessionStorage; all future calls use `Bearer <id_token>`

**Layout — header (unauthenticated):**
```
Bellwether  stock screener                    [Sign in to save]
```

**Layout — header (authenticated):**
```
Bellwether  stock screener                    ●  unmiltambe  [Sign out]
```

**Nudge on watchlists page (after user creates something):**
```
💡 Sign in to keep your lists permanently — they'll be here on any device.  [Sign in]  [×]
```
Shown once; dismissed with [×]; not shown again this session.

**Implementation notes:**
- Use Cognito Hosted UI (OAuth2 redirect) — no Amplify UI bundle
- Tokens in `sessionStorage` only (cleared on tab close, reduces XSS surface)
- `migrate-guest` is idempotent — safe to call on each login in case of retry

---

## S6 — Discovery / screener *(Phase 4)*

**Route:** `/discover`  
**Status:** ⬜ not built (Phase 4 feature)

**Job:** surface stocks the user isn't watching, ranked by score across a broader
universe. Feeds from the scheduled EventBridge batch that runs nightly.

**Layout (sketch):**
```
Discover — stocks you're not tracking, ranked

[Filters: sector ▾  signal ▾  min score __]   [Run screener]

Rank  Ticker  Sector      Fund  Tech  Combined  Signal
  1   META    Comm Svcs    79    77      78       Buy   [+ Add to watchlist]
  2   LLY     Healthcare   82    71      77       Buy   [+ Add to watchlist]
...
```

---

## Build order

| # | Screen/feature | Depends on | Priority |
|---|----------------|-----------|----------|
| 1 | S1 actions (new/rename/delete watchlist) | S1 built | High — core CRUD |
| 2 | S2 actions (add/remove ticker) | S2 built | High — core CRUD |
| 3 | S5 guest session + `X-Guest-Id` backend path | — | High — needed for zero-friction onboarding |
| 4 | S5 Cognito sign-in + `migrate-guest` | guest session | High — needed for deployed API |
| 5 | S4 leaderboard | backend `/v1/leaderboard` exists | Medium |
| 6 | S3 ticker detail + chart | backend `/v1/tickers/:s/chart` exists | Medium |
| 7 | S6 discovery | Phase 4 batch job | Low — Phase 4 |
