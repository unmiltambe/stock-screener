"""Domain data shapes shared by the pure core and its callers.

These are plain dataclasses / enums with no IO and no framework dependencies.
See docs/SCORING.md for the model these represent.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class Signal(str, Enum):
    BUY = "Buy"
    NEUTRAL = "Neutral"
    TRIM = "Trim"


@dataclass(frozen=True)
class Watchlist:
    """A user's named watchlist. Identified by a stable opaque `id` (see
    ADR-0004) — `name` is a mutable attribute, not the key."""
    id: str
    name: str
    tickers: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class Fundamentals:
    """Raw per-ticker fundamentals as supplied by a market-data adapter.

    Every numeric field is optional: upstream sources routinely omit values
    (e.g. ETFs have no ROE). The scoring functions degrade gracefully.
    """
    name: str = ""
    sector: Optional[str] = None
    price: Optional[float] = None
    market_cap: Optional[float] = None
    high_52w: Optional[float] = None
    low_52w: Optional[float] = None
    trailing_pe: Optional[float] = None
    forward_pe: Optional[float] = None
    peg: Optional[float] = None
    fcf_yield: Optional[float] = None   # percent, e.g. 7.6 == 7.6%
    roe: Optional[float] = None         # percent, e.g. 48.5 == 48.5%
    day_change: Optional[float] = None      # price change vs previous close, in dollars
    day_change_pct: Optional[float] = None  # same change as percent, e.g. 1.8 == +1.8%


@dataclass(frozen=True)
class SymbolInfo:
    """One tradable symbol in the universe (ADR-0011). `symbol` is the canonical
    (yfinance/Yahoo) id — e.g. US `AAPL`/`BRK-B`, NSE `RELIANCE.NS` — so mixed-market
    watchlists resolve through the existing data path."""
    symbol: str
    name: str
    exchange: str            # display name, e.g. "NASDAQ", "NYSE"
    market: str = "US"


@dataclass(frozen=True)
class MarketSnapshot:
    """An adapter's complete answer for one ticker: fundamentals + price history.

    `closes` is the daily close series (oldest → newest), long enough to warm up
    the SMA-200 / RSI-14 windows. `dates` is the parallel ISO-8601 date series
    (YYYY-MM-DD); may be empty for synthetic/test snapshots. This is the contract
    between a MarketDataPort and the pure core.
    """
    fundamentals: Fundamentals
    closes: List[float] = field(default_factory=list)
    dates: List[str] = field(default_factory=list)    # YYYY-MM-DD, same length as closes
    volumes: List[float] = field(default_factory=list) # daily volume, same length as closes


@dataclass(frozen=True)
class TechMetrics:
    rsi: Optional[float] = None
    sma50_pct: Optional[float] = None
    sma200_pct: Optional[float] = None
    range_pos: Optional[float] = None   # position within 52w range, percent
    # Setup-score inputs (computed alongside tech metrics)
    rsi_slope: Optional[float] = None       # 3-bar RSI change (positive = rising)
    macd_hist_pct: Optional[float] = None   # histogram as % of price (+ bullish, - bearish)
    macd_hist_rising: Optional[bool] = None # True if histogram rose for 3 consecutive bars
    macd_bars_on_side: Optional[int] = None # bars histogram has been on its current side of zero
    obv_trend_pct: Optional[float] = None   # 20-bar OBV % change (+ accumulation, - distribution)
    # SMA crossover signals: positive = bars since above-cross, negative = below-cross, None = no recent cross
    sma50_cross_bars: Optional[int] = None
    sma200_cross_bars: Optional[int] = None


@dataclass(frozen=True)
class Scores:
    fund: Optional[float] = None
    tech: Optional[float] = None
    combined: Optional[float] = None
    setup: Optional[float] = None


@dataclass(frozen=True)
class ScoredTicker:
    ticker: str
    fundamentals: Fundamentals
    metrics: TechMetrics
    scores: Scores
    signal: Optional[Signal] = None
