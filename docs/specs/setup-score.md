# Spec — Setup Score

**Status:** draft  
**Backlog items:** #2 (high-confidence setup scoring), #B1 (backtesting — see §Open questions)

---

## Goal

Add a **Setup score (0–100)** that answers one question: *"Is this a good entry point right now?"*

This is distinct from the existing scores:

| Score | Question | Inputs | Changes how often |
|---|---|---|---|
| Fundamental | Is this a high-quality business at a fair price? | ROE, FCF yield, PEG | Quarterly |
| Technical | Is the stock in a healthy trend? | RSI level, SMA distances, 52W range | Weekly |
| **Setup** | **Is this a good time to enter?** | **RSI zone + direction, SMA-200 proximity, MACD % direction, OBV trend** | **Daily** |

The typical use: filter for high Fund score (good business) + high Setup score (good timing) to surface swing-trade entry candidates for the current week.

---

## Relationship to the existing Technical score

Setup is a *refinement* of Technical, not a new independent dimension.

| | Technical score | Setup score |
|---|---|---|
| RSI | Rewards low RSI (oversold level) | Rewards RSI recovering upward from oversold |
| SMA-200 | Rewards being above SMA-200 broadly | Rewards being in the sweet spot (0–15% above) |
| SMA-50 | Minor weight (10%) | Not used — already captured by MACD |
| 52W range | Rewards mid-range position | Not used |
| MACD | Not used | Primary signal (35% weight) — momentum inflection |
| OBV | Not used | Confirmation signal (15% weight) — volume flow |

**Setup should NOT be incorporated into the Combined score.** Combined answers "is this a good stock?" (a stable, business-quality question). Setup answers "should I enter this week?" (a volatile, daily-conditions question). Mixing them would cause Combined to fluctuate daily with market noise, masking the fundamental signal that makes it useful for ranking.

Post-calibration option: if Setup proves predictive, consider replacing Technical in Combined with a blended `tech × 0.60 + setup × 0.40`. That enriches the Technical dimension without adding a new top-level dimension or double-counting.

---

## Formula

```
setup_score = weighted_average(
  rsi_setup_subscore      * 0.25,
  sma200_proximity_score  * 0.25,
  macd_histogram_score    * 0.35,
  obv_trend_score         * 0.15,
)
```

Same graceful degradation as existing scores: if fewer than 2 inputs are available, return `None`.

---

## Sub-scores

### 1. RSI zone (25%)

The existing Tech RSI sub-score rewards *level* — how oversold is the stock? That is correct for Tech ("is the trend healthy?"). Setup needs a different curve: it rewards RSI *recovering upward from an oversold zone*, not just being low.

| RSI | Setup interpretation | Score |
|---|---|---|
| < 25 | Deeply oversold — may still be falling | 50 |
| 25–40 | Recovering from oversold — ideal entry zone | 90 |
| 40–55 | Neutral momentum | 70 |
| 55–65 | Slightly extended | 40 |
| 65–75 | Extended, chasing risk | 20 |
| > 75 | Overbought | 8 |

**RSI direction adjustment (v1):** Add ±10 pts based on 3-bar RSI slope: +10 if RSI is rising, −10 if falling. This matters most in the 25–55 zone where a falling RSI at 42 (falling knife) and a rising RSI at 42 (bounce forming) are very different setups.

Note: the existing Tech score intentionally omits RSI direction because it measures *level* (how oversold), not *trajectory*. That omission is correct for Tech. The v1 direction adjustment here is a Setup-specific addition.

**v2 improvement:** Weight the adjustment by magnitude of slope, not just sign.

### 2. SMA-200 proximity (25%)

The Tech score uses SMA-200 distance as a broad trend-health signal. Setup wants the *sweet spot*: close to but above SMA-200, meaning the stock is in a healthy trend but not overextended. Being >30% above SMA-200 is a chase; being >10% below may be a broken trend.

| vs SMA-200 | Setup interpretation | Score |
|---|---|---|
| < −10% | Below long-term trend — avoid | 10 |
| −10% to 0% | Beneath SMA-200, caution | 35 |
| 0% to +10% | Just above — ideal pullback entry zone | 90 |
| +10% to +20% | Healthy uptrend | 70 |
| +20% to +35% | Extended | 40 |
| > +35% | Overextended — don't chase | 15 |

### 3. MACD histogram direction (35% — highest weight)

The histogram = MACD line − Signal line (using standard 12/26/9 parameters).

A histogram crossing from negative to positive is the primary swing entry signal. We score both the state and the recency of the cross.

| Histogram state | Score |
|---|---|
| Just crossed positive (last **3** bars) | 95 |
| Positive and still rising | 80 |
| Negative but rising 3 consecutive bars | 60 |
| Negative, flat | 35 |
| Negative and falling | 15 |
| Just crossed negative (last 3 bars) | 10 |

**"Just crossed" window: 3 bars** (≈ 3 trading days). Beyond 3 bars post-cross, the move is underway and the signal loses its entry-timing precision. (Previous draft said 5 — corrected here.)

**Table display:** Normalize as `histogram / price × 100` (percent of stock price). This makes it comparable across tickers in the table. A $186 AAPL histogram of +0.42 = +0.23%; a $900 NVDA histogram of +0.42 = +0.05% — very different signals. Raw histogram values only make sense on a single stock's chart, which still shows them raw (no change to chart panel).

### 4. OBV 20-bar trend (15% — confirmation)

OBV adds volume on up days, subtracts on down days, creating a cumulative flow line. Rising OBV while price consolidates signals quiet accumulation. Declining OBV signals distribution.

**Lookback: 20 bars** (≈ 1 calendar month). Short enough to reflect current accumulation; long enough to smooth noise. 10 bars is too reactive (one bad week dominates); 50 bars misses recent shifts in positioning.

| OBV 20-bar % change | Interpretation | Score |
|---|---|---|
| > +5% | Strong accumulation | 90 |
| +2% to +5% | Moderate accumulation | 75 |
| −2% to +2% | Neutral | 50 |
| −5% to −2% | Mild distribution | 30 |
| < −5% | Active distribution | 15 |

**Table display:** `▲ +3.2%` or `▼ −1.8%` — signed %, colored positive/negative. Do not show the raw OBV integer (meaningless in isolation; varies by float size).

---

## Data requirements

All inputs are already available in `MarketSnapshot` — no new data sources needed:

| Input | Source | Status |
|---|---|---|
| RSI (level + 3-bar slope) | `snapshot.closes` | Already in `TechMetrics`; add slope |
| vs SMA-200 | `snapshot.closes` | Already in `TechMetrics` (reuse) |
| MACD histogram (last value + 3-bar direction) | `snapshot.closes` | Computed in chart panel only; move to `core/metrics.py` |
| OBV 20-bar % change | `snapshot.closes` + `snapshot.volumes` | Computed in chart panel only; move to `core/metrics.py` |

`volumes` is already in `MarketSnapshot`. No adapter changes required.

---

## Implementation plan

### Backend

1. **`core/metrics.py`** — add:
   - `compute_macd(closes)` → `(hist_value, hist_normalized_pct, is_rising_3bar, bars_since_cross)`
   - `compute_obv_trend(closes, volumes)` → `(obv_change_20bar_pct,)`
   - `rsi_3bar_slope(closes)` → `float` (for RSI direction adjustment)
2. **`core/models.py`** — extend `TechMetrics`:
   - `macd_hist_pct: Optional[float]` — histogram as % of price
   - `macd_hist_rising: Optional[bool]` — 3-bar histogram slope positive
   - `macd_bars_since_cross: Optional[int]` — bars since last zero-cross (None if > 10)
   - `obv_trend_pct: Optional[float]` — 20-bar OBV % change
   - `rsi_slope: Optional[float]` — 3-bar RSI direction (+/-)
3. **`core/scoring.py`** — add:
   - `rsi_setup_subscore(rsi, rsi_slope)` — RSI zone table + ±10 direction adjustment
   - `sma200_proximity_subscore(sma200_pct)` — proximity sweet-spot table
   - `macd_hist_subscore(hist_pct, hist_rising, bars_since_cross)` — histogram direction table
   - `obv_trend_subscore(obv_change_pct)` — OBV trend table
   - `setup_score(rsi, rsi_slope, sma200_pct, macd_hist_pct, macd_hist_rising, bars_since_cross, obv_change_pct)` — weighted combine
4. **`core/models.py`** — add `setup: Optional[float]` to `Scores`.
5. **`api/schemas.py`** — expose `setup` in ticker response; expose new `TechMetrics` fields.
6. **Tests** — unit tests for each new sub-score; integration test that `setup` is in [0, 100].

### Frontend

7. **`TickerTable.tsx`** — table header changes:
   - Add "Setup Metrics" column group sub-heading with two columns: **MACD %** and **OBV**
   - Add **Setup** score column under Scores group, just before Signal
   - Both raw columns are sortable; collapsed to Setup-only after calibration period
8. **`TickerDetailPage.tsx`** — add Setup row to the score bars in the header:
   ```
   Fundamental  ████░░  58
   Technical    ███░░░  47
   Setup        ██████  82   ← new
   ```
9. **Tooltip on Setup column header:** "Entry timing score (0–100). Combines RSI recovery zone, SMA-200 proximity, MACD momentum inflection, and OBV accumulation. High = favorable swing entry conditions. Not a buy signal — use alongside Fundamental score."

---

## UI column layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Scores]                │  [Setup Metrics]  │  [Scores]  │                 │
│  Fund  Tech  Combined    │  MACD %   OBV     │  Setup     │  Signal         │
├─────────────────────────────────────────────────────────────────────────────┤
│  74    58    70.4        │  +0.23%  ▲+3.2%  │  82        │  ● Neutral      │
└─────────────────────────────────────────────────────────────────────────────┘
```

"Setup Metrics" columns (MACD %, OBV %) show the raw inputs so the user can calibrate intuition. After a few days, collapse to the Setup score column only.

---

## Open questions

1. **RSI direction threshold for ±10 adj** — is ±10 pts the right magnitude? Revisit after seeing real data.
2. **OBV normalisation edge case** — if OBV 20 bars ago was near zero (new listing or low-float stock), the % change is misleading. Add a guard: if `abs(obv_base) < threshold`, return `None` for that component.
3. **MACD histogram "bars since cross" cap** — currently scoring 95 for crosses within 3 bars, then drops to the "positive and rising" bucket (80). Verify this cliff doesn't create perverse ranking artifacts.

---

## Backlog items spawned

**#B1 — Backtest Setup score against forward returns**

Validate whether high Fund + high Setup predicts positive 1-week and 1-month forward returns above the baseline. All data is available via yfinance history. Requires either:
- Running the scoring algorithm backward over historical snapshots (simpler), or
- Building a lightweight snapshot store to accumulate live scores over time (richer, required for ongoing validation)

Goal: verify score weights are predictive, not just plausible; adjust weights if needed.

