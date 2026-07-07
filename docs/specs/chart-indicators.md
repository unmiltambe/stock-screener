# Spec — Chart Indicators (SMA toggles, MACD, OBV)

**Status:** implementing · **Backlog items:** #6 (SMA toggles), #7 (MACD), new OBV

---

## Goal

Turn the price chart panel into a complete entry-timing tool for swing traders and
value investors. Three additions:

1. **SMA toggles** — show/hide SMA-50 and SMA-200 lines independently.
2. **MACD panel** — MACD line, signal line, histogram. Answers: "is momentum shifting?"
3. **OBV panel** — On-Balance Volume cumulative line. Answers: "is smart money behind
   this move?"

All three panels are toggleable (off by default for MACD and OBV; SMA lines on by
default). No new data source — MACD is derived from the existing closes series;
OBV adds volume which yfinance already provides alongside closes.

---

## Why MACD + OBV (not raw volume, not RSI on chart)

| Signal | Already visible | On chart? | Verdict |
|--------|----------------|-----------|---------|
| RSI | Yes — sidebar metric | No | Sidebar is sufficient; chart overlay adds noise |
| SMA-50/200 | Yes — chart lines | Yes (toggleable) | Keep, make hideable |
| MACD | No | No | Add — catches momentum turns before RSI reacts |
| Raw volume | No | No | Too noisy; OBV is the distilled version |
| OBV | No | No | Add — shows accumulation/distribution beneath price |

The killer combination for a value-investor swing entry: good Fund score + price
near SMA-200 + MACD crossover forming + OBV trending up.

See ADR-0012 for the layout decision.

---

## Data contract (backend → frontend)

New fields on every `ChartPoint`:

| Field | Type | Description |
|-------|------|-------------|
| `macd` | `float \| null` | MACD line (EMA-12 − EMA-26). Null for first ~33 bars |
| `macd_signal` | `float \| null` | Signal line (EMA-9 of MACD) |
| `macd_hist` | `float \| null` | Histogram (MACD − signal) |
| `obv` | `float \| null` | Cumulative On-Balance Volume |
| `volume` | `float \| null` | Raw daily volume (included for tooltip) |

`null` values on MACD are normal during the EMA warm-up period (~33 bars). The
frontend renders the line starting from the first non-null point.

---

## MACD computation

Standard MACD(12, 26, 9):
- `ema_series(closes, 12)` → EMA-12
- `ema_series(closes, 26)` → EMA-26
- `macd_line = ema12 − ema26` (null when either EMA is null, i.e. first 25 bars)
- `signal_line = ema_series(macd_line, 9)` (null for first 33 bars total)
- `histogram = macd_line − signal_line`

EMA uses the standard multiplier: `k = 2 / (period + 1)`. Seeded from the first
SMA of the window (not from the first price) to match industry-standard charting.

---

## OBV computation

```
obv[0] = 0
obv[i] = obv[i-1] + volume[i]  if close[i] > close[i-1]
        obv[i-1] - volume[i]  if close[i] < close[i-1]
        obv[i-1]              if close[i] == close[i-1]
```

Direction matters, not magnitude. A rising OBV while price consolidates signals
accumulation (institutions buying quietly).

---

## UI layout

```
┌─────────────────────────────────────────────────────┐
│  Ticker sidebar  │  Price + SMA-50 + SMA-200        │  ← existing (SMA toggleable)
│                  │  [period buttons] [SMA50✓] [SMA200✓] [MACD] [OBV]
│                  ├──────────────────────────────────┤
│                  │  MACD histogram + lines          │  ← new, shown when toggled
│                  ├──────────────────────────────────┤
│                  │  OBV line                        │  ← new, shown when toggled
└─────────────────────────────────────────────────────┘
```

- Toggle buttons live in the chart header row, right of period selector.
- Each toggle is a small pill: active = filled accent, inactive = ghost.
- Price panel height shrinks when sub-panels are shown so total height is bounded.
- SMA lines on by default; MACD and OBV off by default (don't overwhelm new users).
- Landing hero (`hideClose` mode) always shows price only — no sub-panel toggles.

---

## States to handle (P10)

- **Loading:** spinner in chart area, sub-panels show nothing.
- **Null MACD values** (warmup): chart line starts from first non-null point.
- **No volume data:** OBV panel shows "No volume data" message, toggle disabled.
- **Short history (< 34 bars):** MACD entirely null — panel shows "Not enough data".
- **1W / 1M periods:** MACD/OBV still shown but will have very few points.

---

## Files touched

**Backend:**
- `services/app/core/metrics.py` — add `ema_series`, `macd_series`, `obv_series`
- `services/app/core/models.py` — add `volumes: List[float]` to `MarketSnapshot`
- `services/app/adapters/yfinance_market.py` — fetch + pass volume series
- `services/app/adapters/memory.py` — synthetic volumes for offline fixtures
- `services/app/api/schemas.py` — extend `ChartPoint`
- `services/app/api/service.py` — compute + attach indicators in `chart()`
- `services/app/core/tests/test_metrics.py` — EMA, MACD, OBV unit tests

**Frontend:**
- `apps/web/src/api/types.ts` — extend `ChartPoint`
- `apps/web/src/features/watchlists/TickerTable.tsx` — extend `ChartPanel`

**Docs:**
- `docs/decisions/0012-chart-indicators.md` — ADR (layout, OBV over raw volume)
- `docs/backlog.md` — close #6, #7; add OBV as done
- `docs/screens.md` — update S3 chart panel data/actions
