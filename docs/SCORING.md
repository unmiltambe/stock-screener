# Scoring Model

The scoring model carried over from the Bellwether prototype, unchanged. This is
the canonical reference for `services/app/core`. It must not be altered as a side
effect of infrastructure or migration work — changes here are deliberate,
reviewed decisions.

> **See also:** [docs/ui-columns.md](ui-columns.md) for how each metric is
> displayed in the UI (column definitions, color thresholds, tooltip text).

Every score is 0–100 (higher = better) and degrades gracefully: a sub-score is
dropped and weights re-normalize if an input is missing; the score shows `—` if
fewer than 2 inputs are available.

---

## 1. Fundamental Score — "Is this a good company at a good price?"

Labels: `Undervalued` (> 60) · `Fair` (35–60) · `Overvalued` (< 35).

### Inputs and weights

| Metric | Weight | Question | Direction |
|--------|--------|----------|-----------|
| ROE | **35%** | Is this a high-quality business worth owning? | Higher = better |
| FCF Yield | **35%** | Is the valuation backed by real cash generation? | Higher = better |
| PEG | **30%** | Am I paying a fair price for the growth I'm getting? | Lower = better |

Three non-overlapping lenses: quality (ROE), cash reality (FCF yield), and
price-for-growth (PEG). Fwd P/E is deliberately excluded — PEG subsumes it
(PEG = Fwd P/E ÷ growth), so including both double-counts valuation.

### Normalisation — sigmoid (no hard caps)

Each raw metric → 0–100 sub-score via an S-curve, giving diminishing returns at
extremes (40→50% ROE matters less than 10→20%) and avoiding threshold cliffs.

```
sigmoid(x, k, midpoint) = 100 / (1 + e^(−k × (x − midpoint)))
```
- At `x = midpoint`: score = 50 (market average). `k` controls steepness.
- For lower-is-better metrics (PEG): negate `k` to invert.

| Sub-score | Midpoint | k | Anchors (illustrative) |
|-----------|----------|---|------------------------|
| ROE | 20% | 0.08 | 0%→17, 20%→50, 35%→77, 60%→96 · **capped at 60%** |
| FCF Yield | 3.5% | 0.50 | 0%→15, 3.5%→50, 5%→68, 10%→96 |
| PEG | 1.5 | 1.50 (inverted) | 0.3→86, 1.0→68, 1.5→50, 2.0→32 |

> **ROE cap:** Input is clamped to `min(roe_pct, 60)` before the sigmoid. Companies
> recovering from losses can show 300–600% ROE due to near-zero book equity — not a
> signal of quality, just accounting math. At 60% the sigmoid already returns ~96/100;
> anything higher is noise. Use ROCE when available for a more reliable quality signal.

> Anchor numbers are illustrative (rounded to ~whole points) — the **formula** and
> the worked composite examples below are authoritative. Tests validate against the
> sigmoid directly, not these anchors.

### Combined formula

```
Fund Score = round(
    (roe_score × 0.35 + fcf_score × 0.35 + peg_score × 0.30) / available_weight, 1)
```
`available_weight` re-normalises to 1.0 if any input is missing.

### Known caveats (carry these into any "suggest" feature)

1. **Mega-cap FCF compression** — FCF Yield = FCF ÷ Market Cap; $3–5T caps read
   structurally low even with huge absolute FCF (NVDA, GOOGL, AAPL, MSFT, AMZN).
2. **Banks/financials** — no traditional FCF; ROE uses regulatory capital. Treat
   the Fund Score as unreliable; consider suppressing for the financial sector.
3. **Utilities/telecoms/capital-intensive** — heavy maintenance capex; the 20% ROE
   midpoint (calibrated for asset-light firms) reads them too low.
4. **Pre-profit firms** — PEG/ROE unreliable near-zero/negative earnings; score
   under-represents the thesis.
5. **ETFs/funds** — ROE/FCF/PEG meaningless; suppress the Fund Score (`—`).

> These caveats matter even more for **discovery** ([ADR-0003](decisions/0003-discovery-engine.md)):
> a screener ranking a broad universe must not naively surface a bank or ETF as
> "undervalued." Sector-aware suppression/normalisation is an open question there.

---

## 2. Technical Score — "Is the trend healthy?"

Labels: `Bullish` (> 60) · `Neutral` (40–60) · `Bearish` (< 40). Computed from the
daily price series — no extra data call.

| Metric | Weight | Horizon | Shape |
|--------|--------|---------|-------|
| RSI-14 | **35%** | short-term momentum | peaks oversold, penalises overbought |
| Price vs SMA-200 | **40%** | long-term trend | peaks 0–15% above, penalises >30% |
| Price vs SMA-50 | **25%** | medium-term trend | same bell logic as SMA-200 |

```
Tech Score = round(
    (rsi×0.35 + sma200×0.40 + sma50×0.25) / available_weight, 1)
```

**RSI:** `<25→95 · 25–40→80 · 40–55→65 · 55–65→40 · 65–75→20 · >75→8`
**SMA-200 (asymmetric):** `<−20%→5 · −20..−10→20 · −10..−5→35 · −5..0→48 · 0..5→80 · 5..15→90 · 15..30→65 · 30..50→35 · >50→15`
**SMA-50:** same asymmetric bell as SMA-200.

> **52W range position removed.** It penalised stocks near their 52W high regardless
> of whether the move reflected real fundamental improvement (e.g. a post-turnaround
> stock making new highs). SMA-200 and SMA-50 already capture overextension from trend;
> adding range was redundant and introduced a systematic bias against momentum names.

---

## 3. Setup Score — "Is this a good entry point right now?"

Labels: `Favorable` (> 60) · `Neutral` (40–60) · `Wait` (< 40). A refinement of the
Technical score focused on entry timing — changes daily with MACD/OBV.

| Metric | Weight | Signal |
|--------|--------|--------|
| RSI zone + direction | **25%** | Rewards RSI recovering from oversold (25–55); ±10 adj for 3-bar slope |
| SMA-200 proximity | **25%** | Sweet spot: 0–10% above SMA-200 |
| MACD histogram | **35%** | Just crossed positive (≤3 bars)→95; positive+rising→80; negative+falling→15 |
| OBV 20-bar % change | **15%** | >+5%→90; +2..5%→75; ±2%→50; −2..−5%→30; <−5%→15 |

```
Setup Score = round(
    (rsi_setup×0.25 + sma200_prox×0.25 + macd_hist×0.35 + obv_trend×0.15) / available_weight, 1)
```

> Setup is a *decomposition* of what drives a good entry within the Technical
> dimension — not an independent axis like Fundamentals. It deliberately shares RSI
> and SMA-200 inputs with Tech but measures different aspects (direction vs level).

---

## 4. Combined Signal — "What should I do?"

**Effective weights across all signals: Fund 70% · Tech 21% · Setup 9%**

```
tech_effective = tech × 0.70 + setup × 0.30   (falls back to pure tech if setup unavailable)
Combined Score = round(Fund × 0.70 + tech_effective × 0.30, 1)
```

Weighted heavily toward fundamentals (valuation drives long-run returns). Setup blends
into the technical bucket at 30% weight — enough to nudge the score when timing is
clearly good or bad, not enough to destabilise a clear signal day-to-day. `—` if Fund
or Tech is unavailable.

**Signal decision table:**

| Fund | Tech | Signal |
|------|------|--------|
| > 60 (Undervalued) | ≥ 40 | **Buy** |
| > 60 (Undervalued) | < 40 | **Neutral** |
| 35–60 (Fair) | any | **Neutral** |
| < 35 (Overvalued) | any | **Trim** |

`Watch` and `Hold` are intentionally collapsed into `Neutral`: no new money in, no
rotation out.
