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

- Persistent top header: **bellwether** wordmark (→ `/`, the landing) + a
  **Watchlists** nav link (→ `/watchlists`, the dashboard) on the left; ThemeToggle +
  Sign in / greeting on the right.
- Persistent footer: tagline + **Report a bug / request a feature** (Tally popup,
  [ADR-0010](decisions/0010-feedback-channel.md)) + **Docs ↗** link → GitHub docs.
- `<main>` flex-grows to fill viewport; pages control their own max-width.
- **Routing is idempotent** — every URL maps to one view regardless of auth
  ([home-landing spec](specs/home-landing.md) D1): `/` is always the landing,
  `/watchlists` always the dashboard. Auth only scopes *whose* data fills a
  user-collection view.

---

## S0 — Landing (marketing home)

**Route:** `/`
**Status:** ✅ built ([home-landing spec](specs/home-landing.md), backlog #17)

**Job:** for signed-out visitors, explain who Bellwether is for and what it does, then
convert. Signed-in users navigate straight to `/watchlists` (the header link, and the
post-sign-in callback).

**Data:** `GET /v1/scores?tickers=…` for a **fixed showcase list** (a frontend
constant mirroring the seed) — read-only and identical for every visitor, independent
of anyone's watchlists. The hero chart reuses the live `ChartPanel`.

**Sections (top→bottom):** hero (tagline + live chart + a 6-row scored
`ShowcaseScoreTable`, row-click drives the chart) → pain points → how it works
(Understand / Visualize / Act, with static visuals) → differentiation → final CTA.

**Actions:** "Start free" → `/watchlists`; "Open my starter list" → the seeded
"Starter picks" list (falls back to `/watchlists/_all` if the guest deleted it).

---

## S1 — Watchlists index (dashboard)

**Route:** `/watchlists`
**Status:** ✅ built

**Job:** entry point for the app; shows everything a user is tracking at a glance.

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
 Left (208px): ticker, price, Fundamental + Technical score bars, Overall
   verdict card (signal + score + bar), 4 key metrics (PEG, FCF Yield, RSI,
   vs 200d — each with a tooltip)
 Right (flex): period toggle (1W/1M/3M/6M/1Y/5Y/10Y) + Recharts chart

                    ┌── Fundamental Metrics ──┐ ┌── Technical Metrics ──┐ ┌─── Scores ───┐
Ticker  Company  Price  MktCap  P/E  FwdP/E  PEG  FCFYld  ROE  RSI  vs200d  vs50d  52WRange  Fundamental  Technical  Overall  Signal
NVDA    NVIDIA   $875   $2.1T   ...  color-coded metrics ...                                        81         91        86     Buy   ×(hover)
```

**Columns (18 + remove):**
- Info: Ticker, Company, Price, **Chg %** (day change vs previous close, sign-coloured), Market Cap
- Fundamental Metrics group: P/E, Fwd P/E, PEG, FCF Yield, ROE
- Technical Metrics group: RSI, vs 200d, vs 50d, 52W Range (with RangeBar)
- Scores group: Fundamental, Technical, Overall, Signal

**Two-level header:** group row sits above individual column names; all three group
labels use the amber/brown accent (matching the SMA-50 line in the chart). Vertical
dividers at group boundaries run through both header rows and data rows.

**Number formatting:** fundamental + technical metric values drop decimals once the
absolute value reaches 10 (e.g. `24`, `+18%`) to reduce clutter; smaller values keep
their precision (e.g. `3.5`, `0.63`). Purely presentational — scores are unaffected.

**Shared component:** this table + chart panel are one component
([`TickerTable.tsx`](../apps/web/src/features/watchlists/TickerTable.tsx)); S2 and S1b
differ only in what they pass via props (S2 → remove button; S1b → Watchlists column).

**Actions:**
- Click row → chart panel slides in above table; click same row again (or ×) to dismiss
- ↗ in chart panel → navigate to full S3 ticker detail page
- `[Add]` form → PUT /v1/watchlists/:id/tickers/:symbol
- Hover row → `×` appears → DELETE /v1/watchlists/:id/tickers/:symbol
- Click any column header → sort (toggle asc/desc; nulls sink to bottom)
- Period toggle in chart → 1W/1M/3M/6M/1Y fetches 1Y of data and slices; 5Y/10Y fetches full history

**Sorting:** all 18 data columns are sortable. Recommended: Combined Score ↓ (best picks first).
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
**Status:** ✅ built

**Job:** the opinionated "best picks first" companion to All Symbols.

**Data:** `GET /v1/leaderboard` → four ranked views (`top_opportunities`,
`best_value`, `best_momentum`, `reconsider`), each up to 5 deduplicated `TickerRow`.

**Layout:** four cards (2×2), each a small ranked list (rank · ticker · company ·
signal · score) where rows link to S3 ticker detail. Friendly section blurbs and an
inviting empty state (voice.md).

**Decision — Leaderboard vs All Symbols (S1b):** kept **separate but presented
together** under "Built-in views" on S1. All Symbols is the neutral, full, sortable
table the user drives; Leaderboard is the curated highlights. They answer different
questions ("show me everything" vs "what's best right now"), so merging them would
weaken both; cross-links connect them.

---

## S5 — Auth (sign-in, not a gate)

**Route:** `/callback` (OIDC redirect); controls live in the App-shell header
**Status:** ✅ built (header Sign in/out + guest mode); ⬜ proactive nudge banner pending
**Decision:** [ADR-0009](decisions/0009-guest-session-before-login.md), [ADR-0008](decisions/0008-app-level-cognito-jwt.md)

**Job:** let guests use the full app immediately; offer sign-in non-intrusively;
migrate their data when they sign in.

**Guest flow (built):**
1. First visit → generate `guestId` UUID in `sessionStorage`
2. API calls send `X-Guest-Id: <uuid>` when no token (api/client.ts)
3. Backend resolves `GUEST#<uuid>` (jwt mode); guest items carry a 7-day TTL
4. Full CRUD — watchlists, tickers, scores, charts

**Sign-in flow (built — `react-oidc-context` + `oidc-client-ts`):**
1. Header **Sign in** → `signinRedirect()` → Cognito Hosted UI (login + sign-up)
2. Redirect to `/callback?code=…` → Authorization Code + PKCE exchange; tokens in
   `localStorage` (survive reload)
3. First authentication → `POST /v1/auth/migrate-guest { guest_id }` → guest lists
   copied to the account, then `guestId` cleared
4. API calls send `Authorization: Bearer <access_token>`; **Sign out** clears the
   token and hits Cognito's `/logout`

**Header (built):**
```
bellwether  Watchlists                       ☀  [Sign in]        ← signed out
bellwether  Watchlists                Hi, Alex  ☀  [Sign out]    ← signed in
```

**Not yet built:** the proactive "💡 Sign in to keep your lists" nudge banner after
a guest creates something; silent token renewal (session ~1h, Cognito default).

---

## S6 — Discovery / screener *(Phase 4)*

**Route:** `/discover`
**Status:** ⬜ not built (Phase 4 feature)

**Job:** surface stocks the user isn't watching, ranked across a broader universe.
Feeds from nightly EventBridge batch.

---

## S7 — Profile & account

**Route:** `/profile`
**Status:** ✅ built

**Job:** let a signed-in user set how they're addressed and delete their account.

**Data:** `GET/PUT /v1/profile` (first/last name); `DELETE /v1/account`.

**Layout:**
- Name form (first, last) → Save (with a warm confirmation, voice.md).
- **Danger zone:** Delete account → `window.confirm` → `DELETE /v1/account` (wipes
  DynamoDB data + Cognito identity) → sign out → back to guest.
- Guests see a friendly "sign in to manage your account" instead.

**Related:** the first-run name nudge (part of S5) seeds the name without a wall;
the name powers the S5 greeting.

---

> Every screen above carries its own **Status** line — that's the single status
> source here. Phase-level status lives in [roadmap.md](roadmap.md); item-level in
> [backlog.md](backlog.md).
