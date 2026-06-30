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
    dates: List[str] = field(default_factory=list)  # YYYY-MM-DD, same length as closes


@dataclass(frozen=True)
class TechMetrics:
    rsi: Optional[float] = None
    sma50_pct: Optional[float] = None
    sma200_pct: Optional[float] = None
    range_pos: Optional[float] = None   # position within 52w range, percent


@dataclass(frozen=True)
class Scores:
    fund: Optional[float] = None
    tech: Optional[float] = None
    combined: Optional[float] = None


@dataclass(frozen=True)
class ScoredTicker:
    ticker: str
    fundamentals: Fundamentals
    metrics: TechMetrics
    scores: Scores
    signal: Optional[Signal] = None
