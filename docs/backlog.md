# Backlog — planned enhancements

Captured, not yet built. Each item notes the intent, open questions, and a rough
approach so we can pick it up with context. Bigger items link forward to a phase in
[roadmap.md](roadmap.md); the discovery-flavoured ones lean on Phase 4's universe.

Grouped by category so related work stays together regardless of when it was
captured.

> Status legend: 🟢 small / well-understood · 🟡 medium / a decision or two ·
> 🔴 needs brainstorming or new data.

---

## Watchlist / Add Ticker

### 1. Ticker autocomplete + validation on Add Ticker  🟡

**Intent:** today the Add Ticker box accepts any string, so non-tickers (typos,
junk) get added and then render as empty rows. Validate against real symbols and
offer type-ahead suggestions.

**Open questions**
- **Symbol source.** yfinance has no clean search API. Options: (a) a bundled
  static symbol list (NASDAQ/NYSE/AMEX listings — a few MB, refreshed periodically);
  (b) a small curated universe (e.g. S&P 500 + popular names) — overlaps with Phase 4;
  (c) a third-party symbol-search API.
- Validate *eagerly* (block unknown symbols on add) or *softly* (allow, but flag)?

**Rough approach**
- Backend `GET /v1/symbols/search?q=` over a symbol universe (name + ticker match),
  returning `{symbol, name, exchange}`. Cache aggressively (universe changes rarely).
- Frontend: debounced type-ahead dropdown on the Add box; Enter/click picks a match.
- Validation: reject add when the symbol isn't in the universe **or** fails to
  resolve a price (covers ETFs/foreign tickers the static list may miss).
- Shares the universe with Phase 4 discovery — build once.

### 2. Multi-ticker entry (paste several at once)  🟢

**Intent:** let users add several tickers in one go from the Add box.

**Decision — accept both spaces and commas.** Tickers contain neither, so splitting
on any run of `[,\s]+` is unambiguous and forgiving: `"AAPL, MSFT NVDA"` →
`[AAPL, MSFT, NVDA]`. No reason to make commas mandatory. Uppercase, dedupe, drop
blanks.

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

---

## Chart / Graph

### 4. Remove the 1W chart timeframe  🟢

**Intent:** 1W adds little over 1M and clutters the toggle.

**Rough approach:** drop `"1W"` from the period toggles and the `TRADING_DAYS` /
`YEARS_TO_FETCH` maps in the three chart spots (`WatchlistDetailPage`,
`AllSymbolsPage`, `TickerDetailPage`). Default stays 1Y. Trivial — can ship anytime.

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
  than #9's weight slider — likely fine as local-only unless it's cheap to fold into
  the same per-user preferences blob if #9 adds one.

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
- Sequencing with #8 (tech-score re-evaluation): the *chart display* of MACD doesn't
  need the scoring question resolved first — these can ship independently. If #8
  concludes MACD should feed the Tech Score, `macd_series()` added here is reused
  directly as that scoring input (same pattern as `sma()` already feeding both the
  chart and the Tech Score today).

---

## Scoring model

> Changes here are deliberate per [SCORING.md](SCORING.md)'s own header — "must not
> be altered as a side effect of infrastructure or migration work." Both items below
> are exactly the kind of *deliberate, reviewed* change that doc calls for.

### 8. Re-evaluate the Technical Score formula, consider adding MACD  🔴

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

### 9. User-adjustable Fundamental/Technical weight slider  🟡

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

## Quick wins vs bigger bets

| Item | Effort | Notes |
|------|--------|-------|
| 4 — remove 1W | 🟢 trivial | ship anytime |
| 2 — multi-ticker add | 🟢 small | decision made (spaces **and** commas) |
| 6 — SMA 50/200 toggles | 🟢 small | decision made (independent toggles); likely frontend-only if SMA series already in chart payload |
| 1 — autocomplete + validation | 🟡 medium | needs a symbol universe (shared with Phase 4) |
| 7 — MACD on graph | 🟡 medium | decision made (separate panel); needs backend MACD computation |
| 9 — fund/tech weight slider | 🟡 medium | decision made (persist per-user); Signal-table question still open |
| 5 — interactive chart | 🟡→🔴 | likely a charting-library decision |
| 3 — related suggestions | 🔴 | phased; leans on Phase 4 universe + new data |
| 8 — re-evaluate Tech Score / MACD | 🔴 | deliberate analysis session, not a quick decision; SCORING.md explicitly gates this |
