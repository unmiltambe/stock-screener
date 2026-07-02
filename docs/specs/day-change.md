# Spec — Daily change (% today) on watchlist rows + chart sidebar

**Status:** in progress · **Date:** 2026-07-02 · Backlog [#11](../backlog.md)

## Goal

Show each stock's **daily change** on the watchlist/All-Symbols table (a column
right after Price) and in the chart-panel sidebar. Minimal version ships the
**percentage** only; the dollar value is carried through the API so the later
$/% toggle ([backlog #11](../backlog.md)) needs no backend change.

## Behavior — "today" vs "last session"

- **During trading hours:** today's change so far = current price − previous close.
- **Outside trading hours** (overnight, weekends, holidays): the last completed
  regular session's change.

We get this for free from Yahoo without writing market-hours logic: the fields we
read (`regularMarketPrice` / `previousClose`) already track the current regular
session while open and the last completed one when closed. No timezone/holiday
calendar needed on our side.

## Data source decision — compute, don't trust the % field

yfinance `.info` exposes `regularMarketChangePercent`, but its unit is ambiguous
(the codebase already treats `returnOnEquity` as a fraction needing `× 100`, so we
don't trust a raw percent field). Instead we **compute** from values we already use:

```
prev_close = info["regularMarketPreviousClose"] or info["previousClose"]
day_change     = price - prev_close                 # price = currentPrice or regularMarketPrice (already fetched)
day_change_pct = (price - prev_close) / prev_close * 100
```

Computing from the same `price` we display keeps the row coherent
(`price − change == prev_close`) and gives us both the $ and % values. Both are
`None` when either input is missing (ETFs/thin data degrade gracefully, like every
other metric).

**Not intraday.** This is a scalar off the already-fetched `.info` dict — it does
**not** need, and must not pull in, the intraday minute-bar fetch that the 1D-chart
feature ([backlog #8](../backlog.md)) requires. That's a separate `.history(interval=…)`
data path; conflating them here would be speculative. Day-change follows the
existing `.info` fundamentals pattern (same shape as `fcf_yield`/`roe`).

## Changes by layer

**Backend**
- `core/models.py` — `Fundamentals` gains `day_change` and `day_change_pct`
  (`Optional[float]`, percent for the latter).
- `adapters/yfinance_market.py` — `_fundamentals()` reads `regularMarketPreviousClose`
  (fallback `previousClose`) and computes both, rounded (2 dp $ / 2 dp %).
- `api/schemas.py` — `TickerRow` gains top-level `dayChange` and `dayChangePct`
  (next to `price`, not inside `metrics` — it's price-level, and the frontend column
  sits beside Price). `row_from_scored()` maps them; `error_row()` nulls them.

**Frontend**
- `api/types.ts` — `TickerRow` gains `dayChange`, `dayChangePct`.
- `lib/format.ts` — add `dayChangeColor(v)` → `text-pos` (>0) / `text-neg` (<0) /
  `text-dim` (0/None). Reuse existing `fmtPctAdaptive` (signed, `+1.8%`) for display.
- `features/watchlists/TickerTable.tsx`:
  - New "Chg %" column immediately after Price (bump the first group-header
    `colSpan` 4 → 5; add a `<Th sortK="dayChangePct">` and a row `<td>`).
  - `BASE_ACCESSORS` gains `dayChangePct` so the column sorts (enables the
    "today's movers" glance, [backlog #12](../backlog.md)).
  - Chart-panel sidebar: show the signed % beside the large price (line ~237).
  - `TIPS` gains a `dayChange` entry.

**Out of scope (deferred):** the $/% toggle (#11 full), a dedicated movers strip
(#12), TickerDetailPage's own price header (trivial follow-up), intraday 1D chart (#8).

## Testing

- Backend: unit-test the compute (positive/negative/zero/missing-input) and that
  `row_from_scored` surfaces the fields; confirm existing row-shape tests still pass
  (fields are optional with defaults → backward compatible).
- Frontend: `npm run build`; load a watchlist and the chart panel — verify the
  column renders, colors by sign, sorts, and shows `—` when data is missing.
