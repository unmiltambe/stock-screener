"""Unit tests for ScreenerService caching behaviour."""
from __future__ import annotations

from typing import Dict, Optional, Sequence

from adapters.memory import InMemoryCache, InMemoryWatchlistRepo
from api.service import ScreenerService
from core.models import Fundamentals, MarketSnapshot


class _CountingMarketData:
    """Returns partial data on first call, full data on subsequent calls."""

    def __init__(self, first_call_closes: bool = False, first_call_price: bool = False) -> None:
        self.calls: int = 0
        self._first_closes = first_call_closes
        self._first_price = first_call_price

    def fetch(self, symbols: Sequence[str], years: int = 2) -> Dict[str, Optional[MarketSnapshot]]:
        self.calls += 1
        out: Dict[str, Optional[MarketSnapshot]] = {}
        good_closes = [float(i) for i in range(300)]
        for sym in symbols:
            if self.calls == 1:
                closes = good_closes if self._first_closes else []
                price = 100.0 if self._first_price else None
                out[sym] = MarketSnapshot(
                    fundamentals=Fundamentals(name="Corp", price=price),
                    closes=closes,
                )
            else:
                out[sym] = MarketSnapshot(
                    fundamentals=Fundamentals(name="Corp", price=100.0),
                    closes=good_closes,
                )
        return out


def _svc(market):
    return ScreenerService(market, InMemoryCache(), InMemoryWatchlistRepo())


def test_partial_fundamentals_not_cached():
    """When .info fails (price=None), the row must NOT be cached."""
    # First call: price=None, closes present
    market = _CountingMarketData(first_call_closes=True, first_call_price=False)
    svc = _svc(market)

    rows1 = svc.scored_rows(["AAPL"])
    assert market.calls == 1
    assert rows1[0]["price"] is None

    rows2 = svc.scored_rows(["AAPL"])
    assert market.calls == 2  # re-fetched, not from cache
    assert rows2[0]["price"] == 100.0


def test_partial_closes_not_cached():
    """When yf.download() fails (closes=[]), the row must NOT be cached even if
    fundamentals succeeded — this is the All Symbols rate-limit scenario."""
    # First call: price present, closes empty
    market = _CountingMarketData(first_call_closes=False, first_call_price=True)
    svc = _svc(market)

    rows1 = svc.scored_rows(["AAPL"])
    assert market.calls == 1
    assert rows1[0]["price"] == 100.0
    assert rows1[0]["scores"]["tech"] is None  # no closes → no tech score

    rows2 = svc.scored_rows(["AAPL"])
    assert market.calls == 2  # re-fetched — not served from cache
    assert rows2[0]["scores"]["tech"] is not None  # now has closes → tech score computed


def test_full_data_is_cached():
    """When both fundamentals and closes succeed, subsequent calls use the cache."""
    market = _CountingMarketData(first_call_closes=True, first_call_price=True)
    svc = _svc(market)

    svc.scored_rows(["AAPL"])           # first call: full data, gets cached
    svc.scored_rows(["AAPL"])           # second call: from cache
    assert market.calls == 1


def test_etf_with_no_pe_is_cached():
    """An ETF has a price but no PE/ROE — that is valid data and must be cached."""

    class ETFMarket:
        calls = 0

        def fetch(self, symbols, years=2):
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


def test_day_change_surfaces_in_row():
    """day_change / day_change_pct from fundamentals reach the wire row (backlog #11)."""

    class DayChangeMarket:
        def fetch(self, symbols, years=2):
            return {
                s: MarketSnapshot(
                    fundamentals=Fundamentals(
                        name="Corp", price=102.0, day_change=2.0, day_change_pct=2.0
                    ),
                    closes=[float(i) for i in range(300)],
                )
                for s in symbols
            }

    row = _svc(DayChangeMarket()).scored_rows(["AAPL"])[0]
    assert row["dayChange"] == 2.0
    assert row["dayChangePct"] == 2.0


def test_day_change_absent_is_none():
    """A ticker with no previous-close data surfaces null day change, not an error."""
    market = _CountingMarketData(first_call_closes=True, first_call_price=True)
    row = _svc(market).scored_rows(["AAPL"])[0]
    assert row["dayChange"] is None
    assert row["dayChangePct"] is None
