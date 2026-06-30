"""Unit tests for ScreenerService caching behaviour."""
from __future__ import annotations

from typing import Dict, Optional, Sequence

from adapters.memory import InMemoryCache, InMemoryWatchlistRepo
from api.service import ScreenerService
from core.models import Fundamentals, MarketSnapshot


class _PartialMarketData:
    """Returns a MarketSnapshot with empty fundamentals (simulates .info failure)
    but valid closes — mirrors the real yfinance_market behaviour when Yahoo
    rate-limits the .info call."""

    def fetch(self, symbols: Sequence[str]) -> Dict[str, Optional[MarketSnapshot]]:
        out: Dict[str, Optional[MarketSnapshot]] = {}
        for sym in symbols:
            # Real closes present; fundamentals failed (price=None)
            out[sym] = MarketSnapshot(
                fundamentals=Fundamentals(),   # price=None
                closes=[100.0 + i for i in range(300)],
            )
        return out


class _CountingMarketData:
    """Wraps _PartialMarketData but succeeds on the second call."""

    def __init__(self) -> None:
        self.calls: int = 0

    def fetch(self, symbols: Sequence[str]) -> Dict[str, Optional[MarketSnapshot]]:
        self.calls += 1
        out: Dict[str, Optional[MarketSnapshot]] = {}
        for sym in symbols:
            if self.calls == 1:
                # First call: fundamentals failed
                out[sym] = MarketSnapshot(fundamentals=Fundamentals(), closes=[float(i) for i in range(300)])
            else:
                # Subsequent calls: full data
                out[sym] = MarketSnapshot(
                    fundamentals=Fundamentals(name="Test Corp", price=100.0, market_cap=1_000_000),
                    closes=[float(i) for i in range(300)],
                )
        return out


def _svc(market):
    return ScreenerService(market, InMemoryCache(), InMemoryWatchlistRepo())


def test_partial_fundamentals_not_cached():
    """When .info fails (price=None), the row must NOT be cached.
    A second call to scored_rows must re-fetch from the adapter."""
    market = _CountingMarketData()
    svc = _svc(market)

    # First call: fundamentals failed → should NOT cache
    rows1 = svc.scored_rows(["AAPL"])
    assert market.calls == 1
    assert rows1[0]["price"] is None  # confirms partial row returned

    # Second call: should re-fetch (not hit cache) because price was None
    rows2 = svc.scored_rows(["AAPL"])
    assert market.calls == 2  # adapter called again — not served from cache
    assert rows2[0]["price"] == 100.0  # now full data


def test_full_fundamentals_are_cached():
    """When fundamentals succeed (price present), subsequent calls use the cache."""
    market = _CountingMarketData()
    svc = _svc(market)

    # Prime cache by calling twice (first call is partial, second populates cache)
    svc.scored_rows(["AAPL"])
    rows1 = svc.scored_rows(["AAPL"])
    assert market.calls == 2
    assert rows1[0]["price"] == 100.0

    # Third call: should hit cache — adapter NOT called again
    rows2 = svc.scored_rows(["AAPL"])
    assert market.calls == 2  # still 2; cache served the row
    assert rows2[0]["price"] == 100.0


def test_etf_with_no_pe_is_cached():
    """An ETF has a price but no PE/ROE — that is valid data and must be cached."""

    class ETFMarket:
        calls = 0

        def fetch(self, symbols):
            self.calls += 1
            return {
                s: MarketSnapshot(
                    fundamentals=Fundamentals(name="ETF", price=150.0, trailing_pe=None, roe=None),
                    closes=[float(i) for i in range(300)],
                )
                for s in symbols
            }

    market = ETFMarket()
    svc = _svc(market)

    svc.scored_rows(["SPY"])
    svc.scored_rows(["SPY"])  # should be cached
    assert market.calls == 1  # only fetched once
