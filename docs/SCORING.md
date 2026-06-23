# Scoring Model

The scoring model carried over from the Bellwether prototype, unchanged. This is
the canonical reference for `services/core`. It must not be altered as a side
effect of infrastructure or migration work — changes here are deliberate,
reviewed decisions.

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
| ROE | 20% | 0.08 | 0%→17, 20%→50, 35%→77, 60%→96 |
| FCF Yield | 3.5% | 0.50 | 0%→15, 3.5%→50, 5%→68, 10%→96 |
| PEG | 1.5 | 1.50 (inverted) | 0.3→86, 1.0→68, 1.5→50, 2.0→32 |

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

## 2. Technical Score — "Is the setup right to buy now?"

Labels: `Bullish` (> 60) · `Neutral` (40–60) · `Bearish` (< 40). Computed from the
daily price series — no extra data call.

| Metric | Weight | Horizon | Shape |
|--------|--------|---------|-------|
| RSI-14 | **30%** | short-term momentum | peaks oversold, penalises overbought |
| Price vs SMA-200 | **30%** | long-term trend | peaks 0–15% above, penalises >30% |
| 52W range position | **30%** | medium-term entry | peaks 10–45% of range |
| Price vs SMA-50 | **10%** | medium-term (support) | same bell logic as SMA-200 |

```
Tech Score = round(
    (rsi×0.30 + sma200×0.30 + rng×0.30 + sma50×0.10) / available_weight, 1)
```

**RSI:** `<25→95 · 25–40→80 · 40–55→65 · 55–65→40 · 65–75→20 · >75→8`
**SMA-200 (asymmetric):** `<−20%→5 · −20..−10→20 · −10..−5→35 · −5..0→48 · 0..5→80 · 5..15→90 · 15..30→65 · 30..50→35 · >50→15`
**52W range pos:** `<10%→50 · 10–25→80 · 25–45→90 · 45–65→60 · 65–80→35 · >80→15`

---

## 3. Combined Signal — "What should I do?"

```
Combined Score = round(Fund × 0.70 + Tech × 0.30, 1)
```
Weighted toward fundamentals (valuation drives long-run returns; technicals inform
entry timing). `—` if either component is unavailable.

**Signal decision table:**

| Fund | Tech | Signal |
|------|------|--------|
| > 60 (Undervalued) | ≥ 40 | **Buy** |
| > 60 (Undervalued) | < 40 | **Neutral** |
| 35–60 (Fair) | any | **Neutral** |
| < 35 (Overvalued) | any | **Trim** |

`Watch` and `Hold` are intentionally collapsed into `Neutral`: no new money in, no
rotation out.
