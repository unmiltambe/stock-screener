# Backlog — planned enhancements

Captured, not yet built. Each item notes the intent, open questions, and a rough
approach so we can pick it up with context. Bigger items link forward to a phase in
[roadmap.md](roadmap.md); the discovery-flavoured ones lean on Phase 4's universe.

Grouped by category so related work stays together regardless of when it was
captured.

> Status legend: 🟢 small / well-understood · 🟡 medium / a decision or two ·
> 🔴 needs brainstorming or new data · ✅ done · ◑ partially done.

---

## Prioritized list

| Item | Effort | Notes |
|------|--------|-------|
| 17 — new-user landing page | ◑ in progress | marketing home for signed-out visitors (audience → pain → how → differentiation); [spec](specs/home-landing.md) + `feat/home-landing` |
| 18 — curated starter watchlist | 🟡 medium | seed guests with ~10 diverse names so built-in views look alive on first visit; enables #17's live hero |
| 2 — multi-ticker add | ✅ done | shipped: paste `AAPL MSFT NVDA` or `AAPL, MSFT` — splits, validates, partial errors |
| 6 — SMA 50/200 toggles | 🟢 small | decision made (independent toggles); likely frontend-only if SMA series already in chart payload |
| 15 — in-app feedback link | ✅ done | shipped as an embedded Tally popup ([ADR-0010](decisions/0010-feedback-channel.md)) |
| 12 — today's movers (sort) | ◑ partial | sortable Chg % column shipped; dedicated movers strip still open |
| 1 — autocomplete + validation | ✅ done | shipped: [ADR-0011](decisions/0011-symbol-universe.md) + [spec](specs/ticker-autocomplete.md); 11.7k US symbols, debounced type-ahead, eager validation |
| 4 — watchlist column filters | 🟡 medium | client-side view-logic, no backend; UX-shape decision open |
| 7 — MACD on graph | 🟡 medium | decision made (separate panel); needs backend MACD computation |
| 10 — fund/tech weight slider | 🟡 medium | decision made (persist per-user); Signal-table question still open |
| 11 — day change ($/%) | ◑ partial | % column + chart sidebar shipped ([spec](specs/day-change.md)); $/% toggle deferred (frontend-only) |
| 5 — interactive chart | 🟡→🔴 | likely a charting-library decision |
| 8 — intraday (1D) chart | 🟡→🔴 | needs a new intraday data source, not the existing daily-close fetch |
| 3 — related suggestions | 🔴 | phased; leans on Phase 4 universe + new data |
| 14 — usage analytics/admin | 🟡 medium | start with free Cognito CloudWatch metrics; custom admin view only if needed |
| 9 — re-evaluate Tech Score / MACD | 🔴 | deliberate analysis session, not a quick decision; SCORING.md explicitly gates this |
| 13 — movers beyond watchlist | 🔴 | deferred; depends on Phase 4 universe + batch infra |
| 16 — international markets | 🔴 | enabled by [ADR-0011](decisions/0011-symbol-universe.md) abstraction; needs per-market sources + scoring sanity |

---

## Watchlist / Add Ticker

### 1. Ticker autocomplete + validation on Add Ticker  ✅ done

**Intent:** today the Add Ticker box accepts any string, so non-tickers (typos,
junk) get added and then render as empty rows. Validate against real symbols and
offer type-ahead suggestions.

**Decided — see spec [ticker-autocomplete.md](specs/ticker-autocomplete.md) +
[ADR-0011](decisions/0011-symbol-universe.md).** Universe = **full major-exchange
list incl. ETFs** from NASDAQ Trader, **backend-owned** behind a runtime-selectable
`SymbolUniversePort` (per-market), fetched once + cached, served via
`GET /v1/symbols/search`. Validation is **eager** (reject unknowns on add).

**Shipped** — `SymbolUniversePort` + `UsSymbolUniverse` (11.7k symbols, common+ETF,
Yahoo-normalized), `/v1/symbols/search`, and a reusable `TickerAutocomplete`
(debounced type-ahead + eager validation). Deployed on AWS (bundled with #2).

**Resolved open questions** (were: symbol source a/b/c; eager vs soft) — see ADR-0011.

**Rough approach**
- Backend `GET /v1/symbols/search?q=` over a symbol universe (name + ticker match),
  returning `{symbol, name, exchange}`. Cache aggressively (universe changes rarely).
- Frontend: debounced type-ahead dropdown on the Add box; Enter/click picks a match.
- Validation: reject add when the symbol isn't in the universe **or** fails to
  resolve a price (covers ETFs/foreign tickers the static list may miss).
- Shares the universe with Phase 4 discovery — build once.

### 2. Multi-ticker entry (paste several at once)  ✅ done

**Intent:** let users add several tickers in one go from the Add box.

**Decision — accept both spaces and commas.** Tickers contain neither, so splitting
on any run of `[,\s]+` is unambiguous and forgiving: `"AAPL, MSFT NVDA"` →
`[AAPL, MSFT, NVDA]`. No reason to make commas mandatory. Uppercase, dedupe, drop
blanks.

**Shipped** — `parseSymbols` splits on `[,\s]+`; each validated against the universe
(#1); valid ones added via a batched `useAddTickers` (one refetch); the rest reported
("Added 2; couldn't find ZZZZZ"). Autocomplete suppresses once the input holds a
separator. Deployed on AWS (bundled with #1).

**Rough approach**
- Parse on submit → list; add each (loop the existing PUT, or a small bulk endpoint
  `PUT /v1/watchlists/{id}/tickers` with a body list to avoid N round-trips).
- Pairs naturally with #1: validate each, surface any that didn't resolve
  ("Added 3; couldn't find FOO").

### 3. Related-ticker suggestions  🔴

**Intent:** suggest tickers to add, related to either (a) what's being typed in the
Add box, or (b) what's already in the watchlist. Relations: same sector/industry,
same theme/"space", or "talked about together."

**Open questions / brainstorming**
- **What does "related" mean, in tiers of effort?**
  - *Cheap (data we already have):* same **sector / industry** — `Fundamentals`
    already carries `sector`; industry is one more field from yfinance `.info`.
  - *Medium:* **theme/space** peers — needs a curated theme map (e.g. "AI", "memory",
    "streaming") or ETF-holdings overlap (two names co-held by the same thematic ETF
    are related). ETF holdings are obtainable but need a data source + refresh.
  - *Advanced:* **co-mention / "talked about together"** — needs a signal like news
    co-occurrence or an embedding similarity over descriptions/news. New data pipeline.
- Suggest from *typed text* vs *existing holdings* — probably both, but holdings-based
  is the higher-value "complete my watchlist" feel.
- Where does it surface? Inline under the Add box, or a "You might also track…" strip
  on the watchlist page?

**Rough approach (phased)**
- v1: sector/industry peers from the universe (reuses #1's universe + the sector we
  already fetch). Ranks peers by score so suggestions are also *good* names.
- v2: thematic peers via ETF-holdings overlap or a curated theme map.
- v3: co-mention/embedding similarity — defer; ties into a broader data effort.
- Strongly synergistic with **Phase 4 discovery** (same universe + scoring).

### 4. Watchlist column filters  🟡

**Intent:** filter a watchlist down to only the stocks matching per-column criteria
(e.g. "combined score > 60", "signal = Buy", "sector = Technology", "day change
> +2%"). Must be **user-friendly and hidden by default** — a novice sees a clean
table; the filtering affordance is discoverable but doesn't clutter the default view.

**Confirmed — client-side only, no backend.** A watchlist's rows are already fully
loaded in the browser, and per [P1](constitution.md)/[P4](constitution.md) filtering
is presentation logic, not an API concern. This is pure `view-logic` layered on the
data the table already has — the same place the existing sort lives. Lives in the
shared [`TickerTable.tsx`](../apps/web/src/features/watchlists/TickerTable.tsx), so
it benefits both watchlist detail **and** All Symbols for free (All Symbols has a
larger N but still client-side-filterable without issue).

**Filter types by column**
- Numeric (price, scores, day change, vs-SMA %, FCF, ROE): range / comparator
  (min–max, or > / < a value).
- Categorical (signal Buy/Neutral/Trim, sector): multi-select.
- Text (ticker / name): substring match.

**Open questions — the UX shape is the main decision**
- **Reveal pattern (the "hidden by default" ask), two common idioms:**
  - *(a) Single "Filters" toggle → filter bar.* One unobtrusive button in the table
    toolbar; clicking reveals a compact filter row/bar, hidden again when off.
    Simplest to build; one clear entry point; least overwhelming for novices.
  - *(b) Per-column funnel icon → popover.* A small filter icon in each column
    header opens a popover scoped to that column, with a subtle dot/badge marking
    active filters. More scalable and is the data-grid convention (Airtable/Notion),
    but more UI surface and more to build.
  - Lean **(a)** for v1 — matches "hidden, not overwhelming" most directly and is
    the smaller build; graduate to (b) if per-column feels needed later.
- Composition with existing **sort** — filters narrow the set, sort orders it; they
  should stack cleanly (filter first, then sort the remainder).
- **Empty state** ([P10](constitution.md)): "No stocks match your filters" with a
  one-click "Clear filters" — must not look like an empty/broken watchlist.
- Persist active filters per-watchlist (`localStorage`, like the SMA-toggle
  preference in #6) or reset on navigation? Lean local-only, low stakes.
- An active-filter count chip + "clear all" so a filtered view is never a confusing
  "where did my stocks go?" moment.

**Rough approach**
- Add filter state (per-column predicates) local to `TickerTable.tsx`; apply as a
  `.filter()` before the existing sort in the row-derivation path.
- v1 UI: a single toolbar toggle revealing a filter bar with one control per
  filterable column (range inputs for numeric, multi-select for categorical, text
  input for name/ticker).
- Reuse existing formatting/threshold `view-logic` so filter inputs speak the same
  units the columns display.
- Pairs with #11 (day change): once `dayChangePct` is a column, "only show today's
  gainers/losers past ±X%" becomes a natural filter — related to #12 (movers).

---

## Chart / Graph

### 5. Apple-Stocks-style interactive chart  🟡→🔴

**Intent:** make the chart explorable like Apple's Stocks app:
- **Pan** left/right and **zoom** in/out across the series.
- **Drag-to-compare:** press-drag across a range to see the price delta and **percent
  change** for that span; the readout shows **only while dragging/holding** and
  disappears on mouse-up (no persistent selection).

**Open questions**
- **Library.** Recharts (current) has a `Brush` for range selection but no real
  pan/zoom and no native drag-delta readout — drag-to-compare would be a custom
  overlay tracking pointer down→move→up over the plotting area. Alternatives worth a
  look if we want this to feel great: **lightweight-charts** (TradingView, built for
  exactly this — pan/zoom/crosshair, very performant) or **visx** (more build-it-
  yourself). Switching libraries is a bigger change but likely the right call for
  Apple-grade feel.
- Touch support (mobile drag/pinch) — in scope eventually (Phase 5 mobile).

**Rough approach**
- Spike both: (a) Recharts + custom pointer overlay for drag-delta + `Brush` for
  range; (b) lightweight-charts swap. Compare feel/effort.
- Drag-delta overlay: on pointer-down capture start x→price; on move compute the
  hovered point and show `Δ$ / Δ%` between anchor and cursor; clear on pointer-up/leave.
- Pair the % readout with the existing voice (concise, e.g. "+4.2% · 3 mo").

### 6. SMA 50 / SMA 200 line toggles  🟢

**Intent:** let the user show/hide the SMA-50 and SMA-200 overlay lines on the price
chart independently, instead of them being (or not being) always-on.

**Decision — independent toggles.** Two separate switches, one per line, not a
single combined on/off — matches the mental model of "I want to see the long-term
trend but not the noisier 50-day line" and vice versa.

**Open questions**
- Default state: both on (current implied behavior, if SMAs are already drawn) vs
  both off until opted in? Lean toward both-on to match today's chart at a glance.
- Persist the toggle per-user, or session/local-only (`localStorage`)? Lower stakes
  than #10's weight slider — likely fine as local-only unless it's cheap to fold into
  the same per-user preferences blob if #10 adds one.

**Rough approach**
- Two checkbox/pill controls near the chart period toggle.
- SMA-50/SMA-200 series presumably already computed for the Tech Score (SCORING.md
  §2) — reuse that data, don't recompute.
- Frontend-only change if the series already renders; otherwise confirm the chart
  data payload includes SMA series points, not just the summary "price vs SMA" %.

### 7. MACD indicator on the graph  🟡

**Intent:** add MACD (line, signal line, histogram) to the chart as a **separate
panel below the price chart** (not overlaid — MACD's scale is unrelated to price).

**Decision — separate panel.** Standard charting convention; avoids a second Y-axis
squeezed against price.

**Confirmed — backend computation, following the existing SMA/RSI pattern.**
yfinance only returns raw OHLCV price history (`.download()`/`.history()`); it does
not provide SMA, RSI, or MACD as ready-made fields — `.info` only carries
fundamentals (price, market cap, PE, 52-week range, etc.). Today's SMA-50/SMA-200
and RSI-14 are both hand-computed in pure Python in
[`services/app/core/metrics.py`](../services/app/core/metrics.py) from the closes
`yfinance_market.py` fetches: `sma()` (lines 14-18), `sma_series()` (lines 21-34,
the rolling version used for the chart line), and `rsi()` (lines 37-49). MACD
follows the same shape — no new upstream call, no new dependency.

**Open questions**
- Standard MACD params (12, 26, 9 EMA) — any reason to deviate? Default to standard
  unless you want something else.

**Rough approach**
- Backend: add a `macd_series()`-style pure function to `core/metrics.py` (12/26-day
  EMA diff = MACD line, 9-day EMA of that = signal line, histogram = MACD − signal),
  computed from the same closes already fetched for SMA/RSI. Add to the chart
  response payload.
- Frontend: new sub-panel under the price chart (Recharts `ComposedChart` or a
  second synced chart) — line for MACD, line for signal, bar for histogram.
- Sequencing with #9 (tech-score re-evaluation): the *chart display* of MACD doesn't
  need the scoring question resolved first — these can ship independently. If #9
  concludes MACD should feed the Tech Score, `macd_series()` added here is reused
  directly as that scoring input (same pattern as `sma()` already feeding both the
  chart and the Tech Score today).

### 8. Intraday (1D) chart  🟡→🔴

**Intent:** a same-day price chart (today's session, tick-by-tick or a few-minute
resolution) — distinct from every existing chart period. **Today's daily-close
chart infra is not intraday**: 1W/1M/etc. are built entirely from *daily closes*
([`TickerTable.tsx:141-148`](../apps/web/src/features/watchlists/TickerTable.tsx)),
so even the shortest existing period only shows one point per day, never
within-day movement. Motivated directly by #11 (day change) — once a user sees
"+1.8% today" prominently, the natural next click is "show me the shape of that
move," which nothing today can answer.

**Open questions**
- **New data granularity, not a reuse of the existing fetch.** yfinance supports
  intraday intervals (`interval="1m"/"5m"/"15m"`) via `.history()`, but Yahoo
  restricts `1m` bars to roughly the last 7 days and `5m`/`15m` to roughly the last
  60 days — this needs a new adapter method, separate from
  `_closes_by_symbol()`'s daily fetch.
- Regular-session bars only for v1, or include pre/post-market? Simpler to scope to
  regular session first.
- Refresh cadence while the market is open — static per page load, or does it poll?
  Ties to [P5](constitution.md) (never hit an external source per user request):
  needs its own short-TTL cache, distinct from the 15-min live-score TTL, tuned for
  intraday freshness without re-fetching per request.
- Does "1D" live in the same period-toggle control as the existing daily-close
  periods, or does its different x-axis (time-of-day vs. date) warrant separate
  handling in the chart component?

**Rough approach**
- Backend: new endpoint/param fetching intraday bars for the current (or last
  completed) session via `interval="5m"` — reasonable resolution without hitting
  Yahoo's `1m` restrictions.
- Cache with a short, market-hours-aware TTL.
- Frontend: "1D" chart mode with its own render path (time-of-day x-axis) rather
  than folding into the existing `PERIODS`/`TRADING_DAYS` maps.
- Natural pairing with #11: tapping the day-change value could jump straight into
  the 1D chart.

---

## Scoring model

> Changes here are deliberate per [SCORING.md](SCORING.md)'s own header — "must not
> be altered as a side effect of infrastructure or migration work." Both items below
> are exactly the kind of *deliberate, reviewed* change that doc calls for.

### 9. Re-evaluate the Technical Score formula, consider adding MACD  🔴

**Intent:** the current Tech Score (RSI 30% / SMA-200 30% / 52W range 30% / SMA-50
10%, [SCORING.md](SCORING.md) §2) has no trend-momentum-crossover signal — MACD is
the classic complement to RSI (momentum *oscillator* vs momentum *trend/crossover*).
Worth a deliberate re-look with concrete before/after examples, not a drive-by
tweak, per the doc's own rule.

**Decision — backlog only for now.** This is analysis work (pull real ticker data,
work through worked examples, decide weights), not a quick decision — scheduled as
its own dedicated session rather than folded into this one.

**Open questions (to resolve in that session)**
- Does MACD replace a weight slice of an existing input, or is the model rebalanced
  from scratch across 5 inputs instead of 4?
- Crossover signal (MACD > signal line = bullish) vs magnitude (histogram size) —
  which maps more sensibly to a 0–100 sub-score via the existing sigmoid/bucket
  approach?
- Concrete worked examples needed (à la the ROE/FCF/PEG anchor tables in
  SCORING.md) before/after, for at least a few tickers spanning bullish, neutral,
  and bearish current reads — to sanity-check the new formula doesn't just reshuffle
  noise.
- Any change here is a **breaking change to historical score comparisons** — worth
  deciding whether old cached scores need a formula-version tag.

**Rough approach**
- Dedicated session: pull real data for ~5 tickers, compute current Tech Score,
  hand-derive what MACD would contribute, compare against intuition ("does this
  ticker's technical setup actually look more/less favorable with MACD folded in?").
- Update SCORING.md with the new formula + anchors, matching the existing
  documentation style, once landed.
- Depends on #7 if MACD computation is added to the backend there — reuse
  `macd_series()` from `core/metrics.py` rather than recompute.

### 10. User-adjustable Fundamental/Technical weight slider  🟡

**Intent:** today `Combined Score = Fund × 0.70 + Tech × 0.30` is fixed
([SCORING.md](SCORING.md) §3). Let a user shift that weighting to match their own
style (e.g. a swing trader might want 50/50 or tech-heavy; a long-only investor
might want 90/10).

**Decision — persist per-user.** Saved to the user's profile so it's remembered
across devices/sessions, not a session-only slider.

**Open questions**
- **Where does recomputation happen?** Fund Score and Tech Score are already
  returned as separate sub-scores per [SCORING.md](SCORING.md) — the *combined*
  score is arguably just presentation-layer arithmetic on two already-computed
  numbers. Per [P1](constitution.md)/[P4](constitution.md), the fixed 70/30 backend
  default should probably stay as the API's default response, with the frontend
  optionally recomputing the display value from `fund_score`/`tech_score` using the
  user's stored weight (`view-logic`, cheap, no extra backend round-trip). Backend
  work reduces to: **store the weight preference**, not recompute the score
  server-side.
- Does the **Signal decision table** (Buy/Neutral/Trim, SCORING.md §3) stay pinned
  to the fixed 70/30 read, or does it also shift with the user's weight? If Signal
  shifts too, that's a bigger behavioral change (a stock could flip from "Trim" to
  "Buy" purely by dragging a slider) — needs a call before building.
- Slider granularity/range: continuous 0–100 vs snapped presets (e.g. 30/70,
  50/50, 70/30, 90/10)? Presets are easier to reason about and test.
- Does this affect the **leaderboard/discovery ranking** (Phase 4) too, or is it
  scoped to an individual ticker/watchlist view only? Leaderboard-wide personalized
  ranking is a bigger lift (ranking becomes per-user, breaks any shared/cached
  leaderboard computation — tension with [P5](constitution.md)).

**Rough approach**
- Backend: add a `fundWeight` (0–1) field to the user profile; small API surface
  (`PATCH /v1/profile` or similar — check existing profile endpoint shape).
- Frontend: slider in account/profile settings; recompute displayed Combined Score
  client-side from existing `fund_score`/`tech_score` per row — no new per-ticker
  API calls needed.
- Decide the Signal-table question above before building; it changes scope.

---

## Daily Change & Movers

> Three related but separable pieces of the same idea — see each item for why
> they're split rather than one feature.

### 11. Day change — absolute ($) and percentage, with a toggle  ◑ partial

**Status: minimal version shipped** — a signed **"Chg %" column** right after Price
(sortable, sign-coloured) and the same value in the chart-panel sidebar, backed by
new `dayChange`/`dayChangePct` fields end to end. See
[specs/day-change.md](specs/day-change.md). One refinement to the scoping below: the
percent is **computed from `price − previousClose`** (not Yahoo's ambiguous
`regularMarketChangePercent`), which keeps it coherent with the displayed price.
**Remaining (deferred):** the $/% toggle — both `$` and `%` already flow over the
wire, so it's a frontend-only add — and surfacing it on `TickerDetailPage`.

**Intent:** show each stock's change for the current (or most recently completed)
trading session — both in dollars and percent — with a way to switch between the
two. "Daily" means **today's close vs. previous close**, or the last completed
session's if viewed outside market hours.

**Confirmed data source.** No day-change data exists in the app today. yfinance's
`.info` already carries `previousClose`, `regularMarketChange`, and
`regularMarketChangePercent` — Yahoo already handles the "vs. most recent session"
logic, so this is a field we're not yet reading, not new computation. Needs changes
at three layers: `_fundamentals()` in
[`yfinance_market.py`](../services/app/adapters/yfinance_market.py) (pull the new
fields), the `Fundamentals` model in `core/models.py` (add fields), and
`TickerRow`/`MetricsOut` + `row_from_scored()` in `api/schemas.py` (expose them).

**Decision — one global $/% toggle, not per-cell.** A single control per view
(table header, ticker detail page) flips the whole display at once — matches how
Robinhood/Schwab-style apps do it. No reusable toggle pattern exists yet in this
codebase (checked); this is new UI, structurally similar to the existing `PERIODS`
button-group.

**Open questions**
- Persist the $/% choice (`localStorage`, like a display preference) or
  session-only? Pure display state, no backend needed either way — lean
  `localStorage` for continuity across visits.
- Default to % or $ first? Lean **%** — it's the unit that's comparable across
  differently-priced stocks, which is exactly what #12 (movers) needs as its sort
  key.

**Rough approach**
- Backend: add `previousClose`, `dayChange`, `dayChangePct` end to end as above.
- Frontend: new column in [`TickerTable.tsx`](../apps/web/src/features/watchlists/TickerTable.tsx)
  next to Price; a small button-group toggle (à la `PERIODS`) to switch $ ↔ %.
  Also surface on `TickerDetailPage.tsx` beside the large price display.

### 12. "Today's movers" — quick-glance sort for biggest gainers/losers  ◑ partial

**Status: sortable-column version shipped** — the `Chg %` column is sortable (via
`BASE_ACCESSORS`), so sorting by it surfaces the day's biggest movers with no extra
UI. Delivered as part of #11. **Remaining:** the dedicated always-visible "Today's
Movers" strip (the 🟡 nicer version below) — still open.

**Intent:** the actual reason for #11 — during market hours, quickly see which
watchlist stocks have moved the most (up or down) *today*, without manually
scanning a column.

**Rough approach**
- Cheapest version (🟢): make the new `dayChangePct` column sortable — the table
  already supports sortable columns via `BASE_ACCESSORS`. Sorting descending/
  ascending surfaces the day's biggest movers with no new UI beyond #11.
- Nicer version (🟡): a dedicated compact "Today's Movers" strip (e.g. top 3
  gainers / top 3 losers across the watchlist) surfaced above or beside the table,
  visible without the user needing to sort manually.

**Open question:** is the sortable column enough, or do you want the always-visible
movers strip? Lean toward shipping the sortable column first (near-free, reuses
#11's data exactly) and only building the dedicated widget if that doesn't feel
sufficient in practice.

### 13. Movers beyond the current watchlist (post-Phase 4)  🔴

**Intent:** once Phase 4 discovery's universe (S&P 500 initially) exists, extend
"today's movers" past what's already being tracked — e.g. "here's what moved most
in the S&P 500 today," independent of any watchlist.

**Explicitly deferred.** Depends on Phase 4's universe/batch infrastructure existing
first. Per [P5](constitution.md) (never hit an external data source per user
request), a universe-wide day-change view can't be computed live per request — it
needs the same precomputed-snapshot approach Phase 4 already plans for discovery
rankings, not a new live-fetch path.

**Rough approach (sketch only)**
- Reuse Phase 4's daily batch snapshot; add day-change as one more field on the
  precomputed `UNIVERSE#<asOf>` ranking rather than a separate live fetch.

---

## Ops / Admin

### 14. Usage analytics — signups, DAU, feature usage  🟡

**Intent:** know how many people have signed up, how many are active daily, and
which features (watchlists vs leaderboard vs chart vs discovery once it ships) get
used. Motivated by opening the repo/site up beyond a handful of friends.

**Open questions**
- **AWS built-in vs custom.** Two tiers of effort:
  - *Built-in, ~zero build:* **Cognito** already reports user-pool metrics
    (sign-ups, sign-ins) in CloudWatch out of the box — no code, just a CloudWatch
    dashboard/console view. Covers signups + auth activity, not feature-level usage.
  - *Feature-level usage* (which screens/actions people use) needs either
    (a) **CloudWatch custom metrics** emitted from the Lambda handlers (cheap,
    stays within [P6](constitution.md)/[P7](constitution.md) — still IaC, still
    near-zero cost at low traffic), or (b) a lightweight analytics service
    (PostHog, Plausible, Amplitude free tier) if a nicer UI than raw CloudWatch
    matters more than staying AWS-native.
  - A **custom admin login + view** (the "nice to have" option) is the most work:
    a protected `/admin` route, backend aggregation queries over DynamoDB (or a
    metrics table), and its own auth gate (reuse Cognito with an admin group/claim
    rather than a separate login).
- **Recommended sequencing:** start with the Cognito CloudWatch metrics (free,
  no code) for signup/DAU-ish numbers immediately after going public. Only build
  the custom admin dashboard if the built-in view proves insufficient for
  feature-level breakdowns.
- Privacy consideration: per-feature usage tracking on friends'/strangers' data
  should be aggregate counts, not per-user activity logs, unless there's a clear
  need — keep this in mind if/when actually implemented.

**Rough approach**
- Phase 1: check Cognito's CloudWatch metrics dashboard for sign-up/sign-in counts
  — likely already available with zero new code, just enable/view it.
- Phase 2 (if needed): emit custom CloudWatch metrics (`PutMetricData` or embedded
  metric format in Lambda logs) tagged by endpoint/feature; build a CloudWatch
  dashboard from those.
- Phase 3 (if still needed): custom `/admin` page — Cognito group-gated route,
  small aggregation endpoint reading DynamoDB or the metrics store.

### 15. In-app "report a bug / request a feature" link  ✅ done

**Status: shipped** — a footer link opens an embedded [Tally](https://tally.so)
feedback popup (Tier 2 below). Decision + rationale recorded in
[ADR-0010](decisions/0010-feedback-channel.md). The tier analysis below is kept as
the record of what was considered.

**Intent:** an easy, always-available way to send bug reports and feature requests
directly from the site. **Wanted early** — the point is to get real feedback from
the friends already using it, so ship the cheapest useful version soon rather than
waiting for the polished one.

**Where it surfaces:** an unobtrusive "Feedback" / "Report a bug" link — footer or a
header menu item, not a nagging widget.

**Tiers of effort — this answers the "who gets notified / how to prevent abuse"
questions, since each tier handles them differently:**

- **Tier 1 — link to a prefilled GitHub issue (🟢, recommended start).** A link to
  `https://github.com/unmiltambe/stock-screener/issues/new?template=bug_report.md`
  (and one for `feature_request.md`) — reusing the issue templates already added in
  [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/).
  - *Notifications:* free and built-in — you plus any admin collaborators "watch"
    the repo and get email/GitHub notifications on every new issue. No infra.
  - *Abuse prevention:* handled entirely by GitHub (account requirement, spam
    detection, rate limits). Nothing for us to build.
  - *Cost:* effectively one anchor tag. Fits going-public naturally.
  - *Downside:* requires the reporter to have a GitHub account — real friction for
    non-technical friends. This is the main reason to consider a later tier.

- **Tier 2 — hosted feedback form/board (🟢→🟡).** Link/embed a third-party form
  (Google Form, Tally, Formspree) or a feature-request board with voting (Canny,
  Frill free tier).
  - *Notifications:* email / Slack / Discord per the service.
  - *Abuse prevention:* the service provides CAPTCHA + spam controls.
  - *Trade-off:* no GitHub account needed (lowest friction for friends), but adds a
    SaaS dependency and feedback lives off-platform.

- **Tier 3 — custom in-app form → backend (🟡).** A modal form → new
  `POST /v1/feedback` endpoint → store in DynamoDB → notify.
  - *Notifications:* an **SNS topic with admin email subscriptions**, or (simplest
    for real-time) a **Slack/Discord incoming webhook** to an admin channel. SES
    email also works. This is the direct answer to "where do admins get notified" —
    a webhook to a shared channel is the least-friction, most-visible option.
  - *Abuse prevention (the real work of this tier):*
    - Attach the existing session/JWT (every user already has a guest or signed-in
      identity) to each submission — no fully-anonymous posts.
    - Rate-limit per user/IP (API Gateway throttling / usage plan, or a per-user
      daily-count in DynamoDB).
    - A CAPTCHA (**Cloudflare Turnstile** — free, privacy-friendly) or a honeypot
      field to stop bots.
    - Length caps + server-side sanitization; never render submissions as HTML.
    - Optionally require sign-in to submit (raises the bar, at some friction cost
      given guests are the default).
  - *Trade-off:* most build effort, but keeps everything on-platform and AWS-native
    ([P6](constitution.md)/[P7](constitution.md)), and the feedback store could feed
    #14's analytics later.

**Outcome — chose Tier 2 (Tally), not Tier 1.** Tier 1 was rejected as the primary
channel because filing a GitHub issue requires a logged-in GitHub account and our
guest session doesn't carry over — that wall blocks exactly the non-technical
friends whose feedback we want. Tier 2 (embedded Tally popup) buys the same
login-free UX with no backend. Tier 3 (custom in-app form) remains the on-platform
upgrade path if the third-party dependency becomes unwanted. Full reasoning in
[ADR-0010](decisions/0010-feedback-channel.md).

---

## Markets / universe

### 16. International symbol universes (India, Japan, …)  🔴

**Intent:** extend the symbol universe (backlog #1) beyond US exchanges to markets
like **India** (NSE/BSE) and **Japan** (JPX), so users can add and screen
non-US tickers.

**Enabled by [ADR-0011](decisions/0011-symbol-universe.md).** The universe is
already behind a runtime-selectable `SymbolUniversePort` per market, so adding a
market is a **new adapter impl + enabling it** — no change to the core, the
`/v1/symbols/search` API shape, or the frontend.

**Open questions**
- **Per-market universe source** (the real work — each differs): US uses NASDAQ
  Trader; India → NSE/BSE official symbol lists; Japan → JPX listings. Each needs a
  parser + refresh.
- **Market-data coverage.** yfinance already supports international tickers via
  exchange suffixes (e.g. `RELIANCE.NS`, `7203.T`), so scoring/charts likely work
  once a symbol resolves — but the **scoring model's assumptions** (currency,
  reporting conventions, FCF/ROE availability, [SCORING.md](SCORING.md) caveats) need
  a sanity pass per market before trusting scores.
- **Mixing markets is already designed for** — watchlists store canonical
  yfinance-style ids ([ADR-0011](decisions/0011-symbol-universe.md)), so US + non-US
  symbols coexist in one list with no schema change. Remaining questions are
  *display*, not data model: currency formatting, an exchange badge in the row, and
  exchange hours (affects day-change #11's "today vs last session" per market).

**Rough approach**
- Add a `SymbolUniversePort` impl per market + enable via the market config.
- Validate the scoring model against a handful of names per new market before
  surfacing scores; suppress/flag where inputs are unreliable.
- Ties to **Phase 5** (larger universe / broader coverage) in the [roadmap](roadmap.md).

---

## Onboarding / first impression

### 17. New-user landing page  ◑ in progress

**Intent:** the current home page is a bare "Watchlists" heading — it tells a
first-time visitor nothing about what Bellwether does or who it's for. Replace it,
for **signed-out visitors**, with a proper marketing landing that carries a clear
narrative: **who it's for → the pain → the solution (shown) → why it's different**.
Signed-in users keep a clean dashboard (no marketing).

**Design frozen — see [spec](specs/home-landing.md).** Full-page vertical narrative:
1. **Hero** — audience eyebrow ("For the self-directed investor") + tagline ("Read
   the signal, not the noise") + a **live, interactive** chart-and-scored-table
   panel (reuses the real `ChartPanel`/`TickerTable`, not a screenshot, so it never
   goes stale). Columns: Fundamental / Technical / Overall.
2. **Pain** — four frustrations of DIY research (scattered tools, numbers without
   meaning, manual comparison, always stale).
3. **How it works** — three animated loops: **Understand** (score + tooltip math) →
   **Visualize** (chart + SMA-50/200) → **Act** (leaderboard ranks). "Add" was
   deliberately dropped as table-stakes.
4. **Differentiation** — transparent scoring, fundamentals+technicals combined,
   leaderboard ranks for you, zero-friction guest access. Muted "instead of…" tags.

**Resolved in the [spec](specs/home-landing.md)** — routing (signed-out → landing,
signed-in → dashboard; "Start free" bootstraps a guest); the hero reuses live data +
`lib/format` via a small `ShowcaseScoreTable` rather than refactoring the shared
`TickerTable` (regression risk not worth it for a 5-column need); loops as muted webm.

**Still open:** live hero data source — the visitor's seeded starter list (#18) vs. a
fixed public "showcase" watchlist read endpoint. Depends on #18.

**Rough approach**
- New `features/landing/` page + route; gate in `App.tsx` on auth state.
- Reuse `ChartPanel` + `TickerTable` in a read-only/showcase mode for the hero.
- Static-but-animated media for the "how" loops; captured once from the app.
- Depends on **#18** for the built-in views to look compelling on arrival.

### 18. Curated starter watchlist (seed list)  🟡

**Intent:** today a new guest is seeded with `["AAPL","AMZN","GOOG","MSFT","NFLX",
"NVDA","TSLA","AMD","INTC"]` (all tech, heavy overlap) — so All Symbols and the
Leaderboard look thin/monotone on first visit. Seed a **diverse ~10-name starter**
spanning sectors and score profiles (e.g. AAPL · NVDA · MSFT · BRK-B · JNJ · COST ·
META · JPM · WMT) so the built-in views immediately demonstrate the scoring model's
range — "Riding strong trends: NVDA" alongside "Best value: BRK-B."

**Why it matters:** directly powers #17's live hero + built-in views. A curious
first-timer seeing a leaderboard that already looks *insightful* is the temptation
loop that converts a visit into a trial.

**Open questions**
- Rename the seeded list from "My Watchlist" to something warmer ("Starter picks")?
- Backend-only change ([`service.py`](../services/app/api/service.py) `_STARTER_SEED`);
  the user can add/remove freely, so it's a starting point, not a lock-in.

**Rough approach**
- Update the seed constant in `service.py`; add/adjust a seeding test
  ([`test_seeding.py`](../services/app/api/tests/test_seeding.py)).
