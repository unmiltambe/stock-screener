# Screen specification

Lightweight intent doc for the React SPA. Each entry captures: what the screen
**is for**, what **data it needs**, what **actions** it exposes, and a rough
**layout sketch**. Visual polish evolves in the browser; this doc exists to
prevent screens from overlapping or missing features, and to be the checklist
we work from.

> Related: [design.md](design.md) for data model and API, [roadmap.md](roadmap.md)
> for build sequence, [ui-columns.md](ui-columns.md) for full column reference.

---

## Navigation shell (App.tsx)

**Status:** ✅ built

- Persistent top header: app name + "stock screener" subtitle
- Persistent footer: app name + **Docs ↗** link → GitHub docs
- `<main>` flex-grows to fill viewport; pages control their own max-width

---

## S1 — Watchlists index

**Route:** `/`
**Status:** ✅ built

**Job:** entry point; shows everything a user is tracking at a glance.

**Data:** `GET /v1/watchlists` → `[{id, name, count}]`

**Layout:**
```
Built-in views
┌────────────────────────────────────────────────────────┐
│ ⊞  All Symbols                              [Read-only] │  ← dashed accent border
│    42 unique symbols across 3 watchlists               │
└────────────────────────────────────────────────────────┘

Your watchlists                              [+ New watchlist]
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Tech Leaders │ │ Value Plays  │ │ Growth Watch │
│ 8 tickers    │ │ 5 tickers    │ │ 12 tickers   │
└──────────────┘ └──────────────┘ └──────────────┘
  (hover shows [Rename] [Delete])
```

**Actions:**
- Click All Symbols card → `/watchlists/_all` (built-in read-only view)
- Click watchlist card → navigate to S2
- `+ New watchlist` → modal: name input → POST /v1/watchlists
- Rename → inline edit on card (hover → Rename button) → PATCH /v1/watchlists/:id
- Delete → `window.confirm` → DELETE /v1/watchlists/:id

---

## S1b — All Symbols (built-in view)

**Route:** `/watchlists/_all`
**Status:** ✅ built

**Job:** consolidated read-only view of every unique symbol across all the user's
watchlists. Like Apple Stocks' "My Symbols" — quick cross-list comparison
without navigating each watchlist individually.

**Data:** parallel `GET /v1/watchlists/:id` for each watchlist ID; deduplicated
client-side by ticker symbol (merging `lists[]` arrays for tickers that appear
in multiple watchlists).

**Visual distinction from regular watchlists:**
- Card on S1: dashed accent border, `bg-accent/5` tint, ⊞ icon, "Read-only" badge, no hover actions
- Page header: "Built-in · Read-only" badge, symbol count + list count
- Table: identical to S2 but with an extra "Watchlists" column showing list membership badges
- No add-ticker form, no remove (×) button on rows
- Defaults to sort by Combined Score descending (best picks first)

**Layout:**
```
← watchlists  /  All Symbols  [Built-in · Read-only]     42 symbols across 3 watchlists

[chart panel when ticker selected — full width]

Ticker  Company   Price  MktCap  ── Fundamental Metrics ──  ── Technical Metrics ──  ── Scores ──  Watchlists
NVDA    NVIDIA    $875   $2.1T   ...                         ...                       86  Buy       Tech, Growth
AAPL    Apple     $213   $3.4T   ...                         ...                       70  Hold      Tech
```

---

## S2 — Watchlist detail

**Route:** `/watchlists/:id`
**Status:** ✅ built

**Job:** show the scored table for one watchlist; manage tickers; quick chart preview.

**Data:** `GET /v1/watchlists/:id` → `[TickerRow]`

**Layout:**
```
← watchlists  /  Tech Leaders                  [ticker input]  [Add]

[chart panel — full width, 280px tall — shows when a row is clicked]
 Left (208px): ticker, price, F/T/C badges, signal, 4 key metrics
 Right (flex): period toggle (1W/1M/3M/6M/1Y/5Y/10Y) + Recharts chart

                    ┌── Fundamental Metrics ──┐ ┌── Technical Metrics ──┐ ┌─── Scores ───┐
Ticker  Company  Price  MktCap  P/E  FwdP/E  PEG  FCFYld  ROE  RSI  vs200d  vs50d  52WRange  Fund  Tech  Combined  Signal
NVDA    NVIDIA   $875   $2.1T   ...  color-coded metrics ...                                    81    91      86      Buy   ×(hover)
```

**Columns (17 + remove):**
- Info: Ticker, Company, Price, Market Cap
- Fundamental Metrics group (green header): P/E, Fwd P/E, PEG, FCF Yield, ROE
- Technical Metrics group (blue header): RSI, vs 200d, vs 50d, 52W Range (with RangeBar)
- Scores group (grey header): Fund Score, Tech Score, Combined Score, Signal

**Two-level header:** group row (colour-coded) sits above individual column names.
Vertical dividers at group boundaries run through both header rows and data rows.

**Actions:**
- Click row → chart panel slides in above table; click same row again (or ×) to dismiss
- ↗ in chart panel → navigate to full S3 ticker detail page
- `[Add]` form → PUT /v1/watchlists/:id/tickers/:symbol
- Hover row → `×` appears → DELETE /v1/watchlists/:id/tickers/:symbol
- Click any column header → sort (toggle asc/desc; nulls sink to bottom)
- Period toggle in chart → 1W/1M/3M/6M/1Y fetches 1Y of data and slices; 5Y/10Y fetches full history

**Sorting:** all 17 data columns are sortable. Recommended: Combined Score ↓ (best picks first).
See [ui-columns.md](ui-columns.md) for full column definitions, color thresholds, and tooltips.

---

## S3 — Ticker detail

**Route:** `/tickers/:symbol`
**Status:** ✅ built

**Job:** deep-dive on one stock. Reached via ↗ in the inline chart panel (S2/S1b),
or directly. Reserved for future additions: news, sentiment, additional indicators.

**Data:**
- `GET /v1/tickers/:symbol/chart?years=N` → `ChartOut { ticker, points[] }`
- `GET /v1/scores?tickers=:symbol` → `TickerRow`

**Layout:**
```
← Tech Leaders  /  NVDA                       $875.20  F 81  T 91  C 86  Buy

[1W][1M][3M][6M][1Y][5Y][10Y]   — Price  -- SMA50  · · SMA200
┌─────────────────────────────────────────────────────────────────────────┐
│  320px interactive Recharts ComposedChart (price area + SMA lines)      │
└─────────────────────────────────────────────────────────────────────────┘

Fundamental inputs          Technical inputs           Context
P/E  Fwd P/E  PEG  FCFYld  ROE    RSI  vs200  vs50  52WRange   MktCap  Sector  Lists
```

**Actions:** period toggle (1W–10Y), breadcrumb back to originating watchlist.

---

## S4 — Leaderboard

**Route:** `/leaderboard`
**Status:** ⬜ not built

**Job:** cross-watchlist ranked view — "my best stocks right now" by combined score.

**Data:** `GET /v1/leaderboard` → `[TickerRow]` sorted by combined score, deduplicated.

**Note:** overlaps with S1b (All Symbols). Leaderboard will be opinionated —
pre-sorted, possibly filtered to Buy signals only — while All Symbols is a neutral
full-table view the user controls.

---

## S5 — Auth (sign-in nudge, not a gate)

**Route:** handled in App shell (no separate URL)
**Status:** ⬜ not built
**Decision:** [ADR-0009](decisions/0009-guest-session-before-login.md)

**Job:** let guests use the full app immediately; offer sign-in persistently but
non-intrusively; migrate their data when they sign in.

**Guest flow:**
1. First visit → auto-generate `guestId` UUID in `sessionStorage`
2. All API calls send `X-Guest-Id: <uuid>` (no Authorization header)
3. Backend assigns identity `GUEST#<uuid>`, stores with 7-day TTL
4. User gets full CRUD — create watchlists, add tickers, see scores

**Sign-in flow:**
1. Click "Sign in" → redirect to Cognito Hosted UI
2. Redirect back with `?code=...` → exchange for tokens → store in `sessionStorage`
3. Call `POST /v1/auth/migrate-guest` → watchlists copied to Cognito account
4. Clear guestId; all future calls use `Bearer <id_token>`

**Layout — unauthenticated header:**
```
Bellwether  stock screener                    [Sign in to save]
```

**Nudge (after user creates something):**
```
💡 Sign in to keep your lists permanently — they'll be here on any device.  [Sign in]  [×]
```

---

## S6 — Discovery / screener *(Phase 4)*

**Route:** `/discover`
**Status:** ⬜ not built (Phase 4 feature)

**Job:** surface stocks the user isn't watching, ranked across a broader universe.
Feeds from nightly EventBridge batch.

---

## Build order

| # | Screen/feature | Status |
|---|----------------|--------|
| S1 | Watchlists index (CRUD) | ✅ done |
| S1b | All Symbols built-in view | ✅ done |
| S2 | Watchlist detail (full table, chart panel, sort) | ✅ done |
| S3 | Ticker detail page (chart + metrics) | ✅ done |
| S5 guest | X-Guest-Id backend path + frontend UUID | ⬜ next |
| S5 auth | Cognito sign-in + migrate-guest | ⬜ next |
| S4 | Leaderboard | ⬜ |
| S6 | Discovery (Phase 4) | ⬜ |
