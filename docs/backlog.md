# Backlog — planned enhancements

Captured, not yet built. Each item notes the intent, open questions, and a rough
approach so we can pick it up with context. Bigger items link forward to a phase in
[roadmap.md](roadmap.md); the discovery-flavoured ones lean on Phase 4's universe.

> Status legend: 🟢 small / well-understood · 🟡 medium / a decision or two ·
> 🔴 needs brainstorming or new data.

---

## 1. Ticker autocomplete + validation on Add Ticker  🟡

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

---

## 2. Multi-ticker entry (paste several at once)  🟢

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

---

## 3. Related-ticker suggestions  🔴

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

## 4. Remove the 1W chart timeframe  🟢

**Intent:** 1W adds little over 1M and clutters the toggle.

**Rough approach:** drop `"1W"` from the period toggles and the `TRADING_DAYS` /
`YEARS_TO_FETCH` maps in the three chart spots (`WatchlistDetailPage`,
`AllSymbolsPage`, `TickerDetailPage`). Default stays 1Y. Trivial — can ship anytime.

---

## 5. Apple-Stocks-style interactive chart  🟡→🔴

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

---

## Quick wins vs bigger bets

| Item | Effort | Notes |
|------|--------|-------|
| 4 — remove 1W | 🟢 trivial | ship anytime |
| 2 — multi-ticker add | 🟢 small | decision made (spaces **and** commas) |
| 1 — autocomplete + validation | 🟡 medium | needs a symbol universe (shared with Phase 4) |
| 5 — interactive chart | 🟡→🔴 | likely a charting-library decision |
| 3 — related suggestions | 🔴 | phased; leans on Phase 4 universe + new data |
