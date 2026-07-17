# Spec — Leaderboard redesign

**Status:** planned  
**Branch:** `feat/leaderboard-redesign`  
**Backlog item:** #20  

---

## Problem

The current leaderboard mixes two fundamentally different types of information on the same page:

- **State** (slow-changing): Best Value, Best Momentum, Top Opportunities — these barely change day to day. A novice investor doesn't know what to do with "Best Value" if there's no trigger.
- **Events** (time-sensitive): Today's Movers — things that happened today, requiring time-sensitive attention.

Adding crossover signals (MACD, SMA-50, SMA-200) as more sections would have pushed the page to 11 sections. Instead, this redesign collapses everything into 4 cards across 2 groups by unifying event types and removing state-only cards.

---

## Design principle

> **Leaderboard = daily briefing, not dashboard.**  
> One question: "Should I do anything today?"  
> Three answers: Act · Watch · Monitor.

---

## Layout: 2 groups, 4 cards

```
┌────────────────────────── ACT ──────────────────────────┐
│  Entry Signals              Exit Warnings               │
│  (fresh buys)               (fresh breaks)              │
└──────────────────────── MONITOR ────────────────────────┘
│  Best Positioned            Today's Movers              │
│  (combined score ranking)   (up / down)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Card specs

### 1. Entry Signals

**Purpose:** Stocks from your tracked universe where a positive crossover just fired with strong fundamentals behind it.

**Filter criteria (all must be true):**
- `macd_bars_on_side ≤ 10` AND `macd_hist_pct > 0` → label: **MACD↑** + age (e.g. "MACD↑ 3d")
- OR price crossed above SMA-50 within last 10 bars → label: **SMA50↑** + age
- OR price crossed above SMA-200 within last 10 bars → label: **SMA200↑** + age
- Fund score ≥ 55 (quality gate — keeps junk out)

Note: `macd_hist_rising = True` is NOT required. The 10-bar cap handles staleness — any cross within 10 bars is still actionable. Requiring `hist_rising` would drop valid entries on consolidation days.

**Display:** Group by signal type (MACD↑ first, then SMA50↑, SMA200↑). Within each group, sort by setup score descending. Age shown directly on the chip ("MACD↑ 3d") so freshness is visible without additional columns.

**Ticker row:** event label chip(s) · ticker · name (truncated) · Signal (Buy/Neutral/Trim)

No score numbers shown — the event label IS the signal.

**Cap:** None. If 12 stocks match today, show 12. Cards expand vertically. If 0 match, show: *"No fresh entry signals today."*

**Backend:** New `entry_signals` leaderboard key. Requires:
- Existing: `macd_bars_on_side`, `macd_hist_pct` — already in `TechMetrics`
- New: `sma50_cross_bars` and `sma200_cross_bars` — bars since price crossed above/below each MA (positive = above cross, negative = below cross, None = no cross in 30-bar lookback). Computed in `core/metrics.py`.

---

### 2. Exit Warnings

**Purpose:** Stocks from your watchlists (not full universe — only stocks you track) where a breakdown signal just fired.

**Filter criteria (any is sufficient):**
- `macd_bars_on_side ≤ 5` AND `macd_hist_pct < 0` → label: **MACD↓**
- OR price crossed below SMA-50 within last 5 bars → label: **SMA50↓**
- OR price crossed below SMA-200 within last 5 bars → label: **SMA200↓**

No fund score filter — if you own it, you need to see the warning regardless of quality.

**Display:** Same grouping pattern as Entry Signals (by label type, then by combined score ascending — worst first within each group).

**Ticker row:** event label chip · ticker · name · Signal

**Cap:** None.

**Backend:** New `exit_warnings` leaderboard key. Watchlist-only (reuse existing per-user ticker set).

---

### 3. Best Positioned

**Purpose:** The highest combined-score stocks across your tracked universe. Stable, changes weekly. The answer to "what's worth holding or researching?"

**Filter:** All tracked tickers with combined score available.

**Sort:** Combined score descending.

**Display:** Rank · ticker · name · Signal · combined score (colored)

**Cap:** Top 15. This is a ranking — #16 and below aren't actionable. 15 is generous enough that a user with a large universe sees meaningful depth without the list becoming noise.

**Replaces:** "Top Opportunities", "Best Value", "Best Momentum", "Worth a Second Look" — all four collapsed into one card. Fund/tech/setup sort options still exist on the All Symbols table for users who want to drill by specific dimension.

---

### 4. Today's Movers

**Redesign:** Merge the current two cards (Top Movers + Biggest Drops) into one card with a side-by-side two-column layout inside it. Saves a full grid slot.

**Display:** Two columns within one card — ↑ Gainers (left) · ↓ Decliners (right). Top 10 each direction, or all that moved > 1% if fewer than 10.

**Ticker row:** ticker · name · day change % (colored)

---

## What gets removed

| Removed section | Where it goes |
|---|---|
| Best Value (fund score ranking) | Sort column on All Symbols table (already exists) |
| Best Momentum (setup score ranking) | Sort column on All Symbols table (already exists) |
| Worth a Second Look (low combined) | Implicit in Exit Warnings; full list via All Symbols sort |
| Top Opportunities (combined ranking) | Replaced by Best Positioned (same data, cleaner name) |

The filter backlog item (#4) also simplifies: preset sort buttons on the All Symbols table cover "show me best value / best momentum" without a general filter builder.

---

## SMA crossover detection (new backend work)

Two new scalar functions in `core/metrics.py`:

```python
def sma_cross_bars(closes: List[float], period: int, lookback: int = 30) -> Optional[int]:
    """
    Returns bars since price last crossed the SMA, within lookback.
    Positive = bars since above-cross (price > SMA for this many bars).
    Negative = bars since below-cross (price < SMA for this many bars).
    None if no cross found within lookback bars (price hasn't switched sides recently).
    """
```

Called for period=50 and period=200 separately. Results stored in `TechMetrics` as:
- `sma50_cross_bars: Optional[int]`
- `sma200_cross_bars: Optional[int]`

Entry Signals filter: value in [1, 10] (positive, within 10 bars).
Exit Warnings filter: value in [-10, -1] (negative, within 10 bars).

Exposed via API in the ticker response and used by the leaderboard endpoint to build `entry_signals` and `exit_warnings` lists.

---

## Frontend changes

- `LeaderboardPage.tsx`: replace `SECTIONS` array (4 items) with 2-group layout
- New `SignalRow` component: event label chip + ticker + name + signal (no score)
- `EntrySignalsCard`, `ExitWarningsCard`: grouped by label type, variable-length list
- `BestPositionedCard`: keep existing `Row` component (rank + ticker + score), cap at 15
- `MoversCard`: two-column layout, merge existing `topMovers`/`bottomMovers` into one card

---

## Resolved decisions

1. **Entry Signals fund threshold**: 55. ✓
2. **Signal window**: 10 bars (2 trading weeks). 5 was too tight — a cross that fired Monday is still actionable the following Monday. Age shown on chip. ✓
3. **Exit Warnings scope**: watchlist-only. Code designed so expansion to full universe is a one-line change. ✓
4. **Entry Signals MACD condition**: `hist_rising` NOT required. 10-bar window handles staleness; requiring `hist_rising` drops valid entries on consolidation days. ✓
5. **Gap between Entry Signals and Best Positioned**: Minimal in the current 69-ticker universe (most fund ≥ 55 stocks land in Best Positioned top 15). A "Worth Watching" bridge card is deferred to Phase 4 when the S&P 500 universe makes the gap real.

---

## Backlog items spawned

- Implement `sma_cross_bars` in `core/metrics.py` and wire into `TechMetrics`
- Update leaderboard API endpoint to compute `entry_signals` and `exit_warnings`
- Frontend: LeaderboardPage redesign per this spec
