# ADR-0012 — Chart indicators: MACD + OBV, sub-panel layout

**Status:** accepted  
**Date:** 2026-07-07

---

## Context

The price chart currently shows Price + SMA-50 + SMA-200. For swing traders and
value investors timing an entry, two questions are unanswered by the existing
signals: "is momentum shifting?" and "is there institutional conviction behind
this move?" Adding MACD and OBV answers both without introducing a new data source.

---

## Decision

Add **MACD(12,26,9)** and **OBV** to the chart as toggleable sub-panels below the
price chart. SMA-50 and SMA-200 become independently toggleable on the price chart.

---

## Alternatives considered

**Raw volume bar chart** — rejected. Daily volume is too noisy to read
trend. OBV (On-Balance Volume) accumulates signed volume so the trend of
accumulation vs distribution is visible. Same data, more signal.

**RSI on chart** — rejected. RSI is already visible in the sidebar as a scored
metric with context (the 30/70 bands are what matter, not the shape). Adding it to
the chart would duplicate information and clutter the panel. MACD is the non-
redundant addition.

**Overlaying MACD on the price chart** — rejected. MACD oscillates around zero
and shares no Y-axis scale with price. Overlay would require a secondary Y-axis
that visually conflicts with the price scale. Separate sub-panel is the industry
standard (TradingView, Thinkorswim).

**Always-on sub-panels** — rejected. Most users open the chart panel for a quick
price + trend read. Showing MACD and OBV by default adds cognitive load for users
who don't need them. Toggleable with sensible defaults (SMAs on, MACD/OBV off)
respects the "minimum information, user decides to go deeper" principle.

**Separate `/chart` page per ticker** — rejected. The inline chart panel is
already in the spec (home-landing.md D2) and is a product differentiator. Deeper
indicators belong on the existing TickerDetailPage chart, not a new surface.

---

## Consequences

- `MarketSnapshot` gains a `volumes` field. Both adapters (yfinance, memory/fixture)
  must supply it. The memory adapter returns deterministic synthetic volumes — tests
  remain offline.
- `ChartPoint` schema gains five new optional fields (`macd`, `macd_signal`,
  `macd_hist`, `obv`, `volume`). Old clients ignoring these fields continue to work.
- EMA warm-up means the first ~33 MACD points are null. The frontend renders from
  the first non-null point; this matches industry-standard charting behaviour.
- No change to the scoring model (SCORING.md is frozen; MACD is chart-only here).
  Adding MACD to the Tech Score is a separate deliberate decision gated by backlog #9.
