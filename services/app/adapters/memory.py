"""In-memory adapter implementations.

Used by unit tests and for running the API locally with no AWS / no network.
The fixture market data lets the whole stack run offline and deterministically.
"""
from __future__ import annotations

import datetime
import math
import time
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple

from core.models import Fundamentals, MarketSnapshot, Watchlist


# ── Cache ─────────────────────────────────────────────────────────────────────

class InMemoryCache:
    """TTL cache backed by a dict. Mirrors the CachePort semantics."""

    def __init__(self) -> None:
        self._store: Dict[str, Tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() >= expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._store[key] = (value, time.time() + ttl_seconds)


# ── Watchlist repo ────────────────────────────────────────────────────────────

class InMemoryWatchlistRepo:
    """Watchlists keyed by a minted opaque id (ADR-0004). The optional `seed`
    is given by name for ergonomics; ids are generated on construction."""

    def __init__(self, seed: Optional[Dict[str, Dict[str, List[str]]]] = None) -> None:
        # user_id -> { watchlist_id -> {"name": str, "tickers": [str]} }
        self._data: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # user_id -> {"first_name": str, "last_name": str}
        self._profiles: Dict[str, Dict[str, str]] = {}
        for user_id, lists in (seed or {}).items():
            for name, tickers in lists.items():
                self._data.setdefault(user_id, {})[self._new_id()] = {
                    "name": name, "tickers": [t.upper() for t in tickers],
                }

    @staticmethod
    def _new_id() -> str:
        return uuid.uuid4().hex

    @staticmethod
    def _to_watchlist(wid: str, rec: Dict[str, Any]) -> Watchlist:
        return Watchlist(id=wid, name=rec["name"], tickers=list(rec["tickers"]))

    def list_all(self, user_id: str) -> List[Watchlist]:
        return [self._to_watchlist(wid, rec)
                for wid, rec in self._data.get(user_id, {}).items()]

    def get(self, user_id: str, watchlist_id: str) -> Optional[Watchlist]:
        rec = self._data.get(user_id, {}).get(watchlist_id)
        return self._to_watchlist(watchlist_id, rec) if rec else None

    def create(self, user_id: str, name: str) -> Watchlist:
        wid = self._new_id()
        self._data.setdefault(user_id, {})[wid] = {"name": name, "tickers": []}
        return self._to_watchlist(wid, self._data[user_id][wid])

    def rename(self, user_id: str, watchlist_id: str, new_name: str) -> None:
        rec = self._data.get(user_id, {}).get(watchlist_id)
        if rec is not None:
            rec["name"] = new_name

    def delete(self, user_id: str, watchlist_id: str) -> None:
        self._data.get(user_id, {}).pop(watchlist_id, None)

    def add_ticker(self, user_id: str, watchlist_id: str, symbol: str) -> None:
        rec = self._data.get(user_id, {}).get(watchlist_id)
        if rec is None:
            return
        symbol = symbol.upper()
        if symbol not in rec["tickers"]:
            rec["tickers"].append(symbol)

    def remove_ticker(self, user_id: str, watchlist_id: str, symbol: str) -> None:
        rec = self._data.get(user_id, {}).get(watchlist_id)
        if rec is None:
            return
        symbol = symbol.upper()
        if symbol in rec["tickers"]:
            rec["tickers"].remove(symbol)

    def get_profile(self, user_id: str) -> Optional[Dict[str, str]]:
        prof = self._profiles.get(user_id)
        return dict(prof) if prof else None

    def set_profile(self, user_id: str, profile: Dict[str, str]) -> None:
        self._profiles[user_id] = dict(profile)

    def delete_all(self, user_id: str) -> None:
        self._data.pop(user_id, None)
        self._profiles.pop(user_id, None)


# ── Fixture market data ───────────────────────────────────────────────────────

def _synthetic_closes(base: float, n: int = 260, drift: float = 0.0003,
                      amp: float = 0.06) -> List[float]:
    """Deterministic close series: gentle drift + sine wave. Enough points to
    warm up SMA-200. No randomness so tests/offline runs are reproducible."""
    out: List[float] = []
    for i in range(n):
        trend = base * (1 + drift) ** i
        wobble = 1 + amp * math.sin(i / 9.0)
        out.append(round(trend * wobble, 2))
    return out


def _synthetic_dates(n: int) -> List[str]:
    """Weekday dates ending today, going back n calendar steps (skips weekends)."""
    dates: List[str] = []
    day = datetime.date.today()
    while len(dates) < n:
        if day.weekday() < 5:  # Mon–Fri
            dates.append(day.isoformat())
        day -= datetime.timedelta(days=1)
    dates.reverse()
    return dates


# A small offline universe with roughly realistic fundamentals.
_FIXTURES: Dict[str, Fundamentals] = {
    "AAPL": Fundamentals(name="Apple Inc.", sector="Technology", price=None,
                         market_cap=3.0e12, high_52w=260.0, low_52w=164.0,
                         trailing_pe=33.0, forward_pe=29.0, peg=2.1,
                         fcf_yield=3.2, roe=150.0),
    "NVDA": Fundamentals(name="NVIDIA Corporation", sector="Technology", price=None,
                         market_cap=3.05e12, high_52w=195.0, low_52w=86.0,
                         trailing_pe=41.2, forward_pe=30.8, peg=0.63,
                         fcf_yield=0.9, roe=114.3),
    "NFLX": Fundamentals(name="Netflix, Inc.", sector="Communication Services",
                         price=None, market_cap=4.2e11, high_52w=1340.0, low_52w=580.0,
                         trailing_pe=48.0, forward_pe=38.0, peg=1.58,
                         fcf_yield=7.6, roe=48.5),
    "GOOGL": Fundamentals(name="Alphabet Inc.", sector="Communication Services",
                          price=None, market_cap=2.1e12, high_52w=210.0, low_52w=140.0,
                          trailing_pe=26.0, forward_pe=22.0, peg=1.42,
                          fcf_yield=0.6, roe=38.9),
}

_BASE_PRICE = {"AAPL": 220.0, "NVDA": 125.0, "NFLX": 1100.0, "GOOGL": 185.0}


class FixtureMarketData:
    """MarketDataPort backed by static fixtures — fully offline & deterministic."""

    def fetch(self, symbols: Sequence[str], years: int = 2) -> Dict[str, Optional[MarketSnapshot]]:
        out: Dict[str, Optional[MarketSnapshot]] = {}
        for raw in symbols:
            sym = raw.upper()
            base = self._fundamentals_for(sym)
            if base is None:
                out[sym] = None  # unresolved symbol (FR-2.5 / FR-3.5)
                continue
            closes = _synthetic_closes(_BASE_PRICE.get(sym, 100.0))
            dates = _synthetic_dates(len(closes))
            funds = Fundamentals(**{**base.__dict__, "price": closes[-1]})
            out[sym] = MarketSnapshot(fundamentals=funds, closes=closes, dates=dates)
        return out

    @staticmethod
    def _fundamentals_for(symbol: str) -> Optional[Fundamentals]:
        return _FIXTURES.get(symbol)
