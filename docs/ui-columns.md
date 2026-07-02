# UI Column Reference

Canonical definition of every column shown in the watchlist detail table.
This is the single source of truth for:
- what the column measures
- how to interpret the value
- the color thresholds used in the UI
- the tooltip text shown to users

Ported from the Bellwether prototype (SPEC.md §6). See [SCORING.md](SCORING.md)
for the mathematical derivation of the composite scores.

---

## Column order

```
Ticker | Company | Price | Chg % | Mkt Cap
  ↳ Fundamental inputs: P/E | Fwd P/E | PEG | FCF Yield | ROE
  ↳ Technical inputs:   RSI | vs 200d  | vs 50d | 52W Range
  ↳ Scores:             Fundamental | Technical | Overall | Signal
```

> **Display labels vs concept names.** The score columns render as **Fundamental /
> Technical / Overall** in the UI (compact headers); this doc keeps the fuller
> concept names (Fundamental Score / Technical Score / Combined Score) in the
> section headings below. Same columns, shorter labels.

> **Adaptive decimals.** Fundamental + technical metric values drop to whole numbers
> once `|value| ≥ 10` (e.g. `24`, `+18%`, `45%`); below that they keep their normal
> precision (`3.5`, `0.63`, `+7.2%`). Purely presentational (`fmtNumAdaptive` /
> `fmtPctAdaptive` / `fmtPctAbsAdaptive` in `lib/format.ts`) — score inputs are the
> full-precision values, unaffected.

---

## Identity columns

### Ticker
Symbol as listed on the exchange. Monospace font.  
**Tooltip:** "Stock ticker symbol."

### Company
Full company name, truncated at ~26 characters to avoid layout overflow.  
**Tooltip:** "Full company name."

### Price
Current market price, formatted as `$213.07`.  
**Tooltip:** "Current market price."

### Chg %
Daily change as a signed percentage vs the previous close (`+1.8%` / `-7.4%`).
During market hours this is today's move so far; outside hours it's the last
completed regular session. Green when positive, red when negative, dim at zero/`—`.
Adaptive decimals (`+7.4%`, `-17%`). Sortable — sort by it for the day's biggest
movers. Computed from `price − previousClose`; see [specs/day-change.md](specs/day-change.md).  
**Tooltip:** "Change since the previous close. During market hours this is today's move so far; outside hours it's the last completed session."

### Mkt Cap
Market capitalisation, formatted as `$2.1T` / `$450B` / `$12B`.  
No color coding — informational context only.  
**Tooltip:** "Market capitalisation. Larger = more established. Smaller = more growth potential but higher risk."

---

## Fundamental input columns

These are the raw metrics that feed the **Fundamental Score**. They are displayed
for transparency and manual cross-checking. Scoring weights are in SCORING.md.

### P/E (Trailing)
Price divided by last 12 months of actual earnings (trailing twelve months).

> For reference only. Fwd P/E is more useful for growth companies because
> trailing P/E can be distorted by one-off charges or low-base earnings quarters.

No color coding — reference metric only (grey/dim).  
**Tooltip:** "Trailing P/E — price vs last 12 months of actual earnings. For reference only. Fwd P/E is more useful for growth companies. < 15 cheap | 15–25 fair | > 25 expensive"

### Fwd P/E
Price divided by next 12 months of analyst-estimated earnings.

No color coding — reference metric only (grey/dim).  
**Tooltip:** "Price vs next 12 months of expected earnings. More useful than trailing P/E for growth companies. < 15 cheap | 15–25 fair | > 25 expensive"

### PEG
PEG ratio = Fwd P/E ÷ earnings growth rate. Adjusts valuation for growth.

| Range | Color | Interpretation |
|-------|-------|----------------|
| < 1.0 | 🟢 Green | Getting more growth than you're paying for |
| 1.0–2.0 | 🟡 Amber | Fair price for the growth |
| > 2.0 | 🔴 Red | Expensive relative to growth |
| null | Dim | Not available (pre-profit, negative growth) |

**Tooltip:** "Is it cheap? Adjusts P/E for growth — are you paying a fair price for the growth you're getting? < 1 getting more growth than you're paying for | 1–2 fair | > 2 expensive relative to growth"

> **Why not Fwd P/E alone:** PEG subsumes Fwd P/E. PEG = Fwd P/E ÷ growth rate,
> so including both in the score would double-count the same valuation signal.

### FCF Yield
Free cash flow as a percentage of market cap. Measures how much real cash the
business generates relative to what you're paying.

Catches companies where earnings look good but cash conversion is weak (e.g.
heavy stock-based comp or working capital drag).

| Range | Color | Interpretation |
|-------|-------|----------------|
| > 8% | 🟢 Green | Very strong — high conviction in earnings quality |
| 4–8% | 🟢 Green | Good — above S&P 500 average (~4%) |
| 0–4% | 🟡 Amber | Weak — cash generation below market average |
| < 0% | 🔴 Red | Burning cash — earnings not converting to cash |
| null | Dim | Not available (banks, ETFs) |

**Tooltip:** "Is it generating cash? Free cash flow as % of market cap. How much real cash the business generates vs what you're paying. Catches companies where earnings look good but cash conversion is weak. < 0% burning cash | ~4% S&P 500 average | > 8% very strong"

> **Known limitation:** Mega-cap companies ($3T+) are structurally penalised
> because FCF Yield = FCF ÷ Market Cap. NVDA, AAPL, MSFT, AMZN, GOOGL will
> show low FCF Yield not because cash generation is weak but because their
> market caps are enormous. Cross-check against ROE and PEG for these names.

### ROE
Return on equity = net income ÷ shareholders' equity. Measures how efficiently
management compounds capital. High sustained ROE indicates a competitive moat.

| Range | Color | Interpretation |
|-------|-------|----------------|
| > 30% | 🟢 Green | Strong moat — exceptional capital efficiency |
| 15–30% | 🟡 Amber | Solid — above S&P 500 average (~20%) |
| ≤ 15% | 🔴 Red | Weak — below-average capital efficiency |
| null | Dim | Not available |

**Tooltip:** "Return on equity — net income ÷ shareholders' equity. Measures how efficiently management turns capital into profit. High ROE sustained over time signals a competitive moat. < 10% weak | 15–25% solid | > 30% strong moat"

> **Known limitation:** Banks and financials use regulatory capital as the
> denominator — ROE is not comparable across sectors. Utility/telecom ROE is
> depressed by heavy maintenance capex. See SCORING.md §Known Caveats.

---

## Technical input columns

These are the raw signals that feed the **Technical Score**. Displayed for
transparency. Scoring weights in SCORING.md.

### RSI
14-day Relative Strength Index. Momentum oscillator ranging 0–100.
Measures whether a stock has been pushed too far in one direction recently.

| Range | Color | Interpretation |
|-------|-------|----------------|
| < 30 | 🟢 Green | Oversold — potential entry opportunity |
| 30–70 | Dim | Neutral momentum |
| > 70 | 🔴 Red | Overbought — stretched, avoid chasing |

**Tooltip:** "Is momentum healthy? 14-day momentum oscillator — has the stock been pushed too far in one direction? < 30 oversold — potential entry | 30–70 neutral | > 70 overbought — stretched"

### vs 200d (Price vs SMA-200)
Distance of the current price from the 200-day simple moving average, as a
signed percentage. Positive = above (uptrend). Negative = below (downtrend).

The scoring is **asymmetric**: being just above SMA-200 (0–15%) is the ideal
entry zone — the long-term trend is confirmed without the stock being stretched.

| Range | Color | Interpretation |
|-------|-------|----------------|
| 0–15% | 🟢 Green | Ideal entry zone — uptrend, not yet stretched |
| 15–30% | 🟡 Amber | Getting extended |
| > 30% | 🔴 Red | Stretched — avoid chasing |
| < 0% | 🔴 Red | Below 200d MA — downtrend |

**Tooltip:** "Is the trend intact? Distance from the 200-day moving average. Positive = above (uptrend) | Negative = below (downtrend). 0–15% above is the ideal entry zone: confirmed uptrend, not yet stretched."

### vs 50d (Price vs SMA-50)
Distance from the 50-day SMA, as a signed percentage. Medium-term supporting
signal. A pullback toward SMA-50 while still above SMA-200 is often a good
entry point. 10% weight in the Technical Score (vs 30% for SMA-200).

| Range | Color | Interpretation |
|-------|-------|----------------|
| −5% to +10% | 🟢 Green | Near support — healthy |
| +10% to +20% | 🟡 Amber | Getting extended above 50d |
| Outside range | 🔴 Red | Either far extended or broken below 50d |

**Tooltip:** "Distance from the 50-day moving average — short-term trend health. Pulling back toward SMA-50 while above SMA-200 is often a good entry point."

### 52W Range
Position of the current price within its 52-week high/low range, shown as
both a mini progress bar and a percentage (0% = 52W low, 100% = 52W high).

| Range | Color | Interpretation |
|-------|-------|----------------|
| 10–45% | 🟢 Green | Lower half — potential discount entry |
| < 10% | 🟡 Amber | Near 52W low — may be a falling knife |
| 45–65% | Dim | Middle range — neutral |
| 65–80% | 🟡 Amber | Upper range — getting extended |
| > 80% | 🔴 Red | Near 52W high — avoid chasing |

**Tooltip:** "Where the current price sits within its 52-week high/low range. Lower in the range = potential discount entry. Near the top = be cautious chasing. Sweet spot: 10–45% of range."

---

## Score columns

These are the composite 0–100 scores derived from the input columns above.
Full mathematical derivation in [SCORING.md](SCORING.md).

### Fundamental Score
Composite quality + valuation score. Higher = better quality at a better price.

| Range | Label | Color |
|-------|-------|-------|
| > 60 | Undervalued | 🟢 Green |
| 35–60 | Fair | 🟡 Amber |
| < 35 | Overvalued | 🔴 Red |

**Inputs:** ROE (35%), FCF Yield (35%), PEG (30%) — sigmoid normalised.  
**Tooltip:** "Composite quality + valuation score (0–100). Higher = better. > 60 Undervalued | 35–60 Fair | < 35 Overvalued. Inputs: ROE (35%), FCF Yield (35%), PEG (30%). Normalised via sigmoid — no hard caps."

### Technical Score
Composite momentum + entry quality score. Higher = more bullish setup.

| Range | Label | Color |
|-------|-------|-------|
| > 60 | Bullish | 🟢 Green |
| 40–60 | Neutral | 🟡 Amber |
| < 40 | Bearish | 🔴 Red |

**Inputs:** RSI-14 (30%), vs SMA-200 (30%), 52W range position (30%), vs SMA-50 (10%).  
**Tooltip:** "Composite momentum score (0–100). Higher = more bullish setup. > 60 Bullish | 40–60 Neutral | < 40 Bearish. Inputs: RSI (30%), SMA-200 (30%), 52W range (30%), SMA-50 (10%)"

### Combined Score
Weighted blend of Fundamental and Technical scores.

```
Combined = Fundamental × 0.70 + Technical × 0.30
```

Weighted toward fundamentals: valuation is the primary determinant of long-run
returns; technicals inform entry timing. `—` if either component is unavailable.

| Range | Interpretation |
|-------|----------------|
| ≥ 65 | Strong buy candidate |
| 35–65 | Neutral |
| < 35 | Avoid |

**Tooltip:** "Overall score combining valuation and momentum (0–100). = Fundamental × 70% + Technical × 30%. ≥ 65 strong buy candidate | 35–65 neutral | < 35 avoid"

### Signal
Action signal derived from the Fundamental and Technical scores. See
SCORING.md §3 for the full decision table.

| Signal | Color | Meaning |
|--------|-------|---------|
| Buy | 🟢 Green | Undervalued + constructive technical setup |
| Neutral | 🟡 Amber | No strong conviction — hold, don't add or trim |
| Trim | 🔴 Red | Overvalued — consider rotating out |

**Tooltip:** "Action signal derived from Fundamental + Technical scores. Buy = undervalued with a constructive technical setup. Trim = overvalued — consider rotating out. Neutral = no strong conviction either way."

> **Watch and Hold are intentionally absent.** The watchlist doesn't track
> whether you own a stock. "Hold" is meaningless for a monitoring tool.
> Both collapse into Neutral: no new money in, no rotation out.

---

## Sorting

Click any column header to sort the table by that column. Click again to reverse direction. The active sort column is highlighted in blue with a ↑ / ↓ indicator. Null values always sink to the bottom regardless of direction.

**Default sort:** each watchlist defaults to Ticker ↑ (alphabetical). The All Symbols view defaults to Combined Score ↓ (best picks first).

**Persistence:** sort preference is remembered per watchlist in `localStorage` (`wl-sort-<watchlistId>` and `wl-sort-_all` for All Symbols). Preferences survive page refreshes and browser restarts but are local to the browser.

**Recommended sort patterns:**

| Goal | Sort column | Direction |
|------|-------------|-----------|
| Best overall picks | Combined Score | ↓ Descending |
| Best value (cheapest quality) | Fundamental Score | ↓ Descending |
| Best entry timing | Technical Score | ↓ Descending |
| Show Buy signals first | Signal | ↑ Ascending (Buy < Neutral < Trim alphabetically) |
| Most oversold (RSI) | RSI | ↑ Ascending |
| Lowest in 52W range | 52W Range | ↑ Ascending |

> **Note on Signal sort:** Signal sorts alphabetically (Buy → Neutral → Trim ascending).
> For a "best picks first" view, sorting by Combined Score descending is usually
> more useful than sorting by Signal directly.

---

## Stale data flag

When a TickerRow has `stale: true`, the score was served from the 15-minute
cache and the underlying market data may be up to 15 minutes old. This is
normal during market hours — yfinance data is cached to avoid rate limits.

---

## Future columns (not yet built)

| Column | Status | Notes |
|--------|--------|-------|
| Comment | Planned | Per-ticker analyst note (user-written) |
| Sentiment | Future | News API sentiment (Bullish/Mixed/Bearish) — Phase 5 |
| Sector | Hidden | Available in `metrics.sector`; used for future sector-relative scoring |
