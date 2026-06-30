"""API response shapes — pure data (P1).

No colors, no formatted strings, no display labels. Frontends derive presentation
from these raw values via packages/view-logic.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel

from core.models import ScoredTicker


class ScoresOut(BaseModel):
    fund: Optional[float] = None
    tech: Optional[float] = None
    combined: Optional[float] = None


class MetricsOut(BaseModel):
    pe: Optional[float] = None
    fwdPe: Optional[float] = None
    peg: Optional[float] = None
    fcfYield: Optional[float] = None
    roe: Optional[float] = None
    rsi: Optional[float] = None
    vsSma200: Optional[float] = None
    vsSma50: Optional[float] = None
    rangePos: Optional[float] = None
    sector: Optional[str] = None
    marketCap: Optional[float] = None


class TickerRow(BaseModel):
    ticker: str
    name: str = ""
    price: Optional[float] = None
    scores: ScoresOut = ScoresOut()
    signal: Optional[str] = None
    metrics: MetricsOut = MetricsOut()
    lists: List[str] = []
    stale: bool = False


class WatchlistSummary(BaseModel):
    id: str
    name: str
    count: int


class WatchlistOut(BaseModel):
    id: str
    name: str


class ChartPoint(BaseModel):
    t: str                       # ISO date, or index label for offline fixtures
    price: float
    sma50: Optional[float] = None
    sma200: Optional[float] = None


class ChartOut(BaseModel):
    ticker: str
    points: List[ChartPoint]


class WatchlistNameIn(BaseModel):
    """Body for create (POST) and rename (PATCH) — a partial representation of the
    watchlist resource (ADR-0004)."""
    name: str


class MigrateGuestIn(BaseModel):
    """Body for POST /v1/auth/migrate-guest — the guest UUID to absorb (ADR-0009)."""
    guest_id: str


class SessionInitIn(BaseModel):
    """Body for POST /v1/session/init — optional prior guest UUID to migrate when a
    user signs in. Omitted/empty for a plain (guest or returning) bootstrap."""
    guest_id: str = ""


class ProfileIn(BaseModel):
    """Body for PUT /v1/profile — how the user wants to be addressed."""
    first_name: str = ""
    last_name: str = ""


class ProfileOut(BaseModel):
    first_name: str = ""
    last_name: str = ""


def row_from_scored(
    scored: ScoredTicker,
    lists: Optional[List[str]] = None,
    stale: bool = False,
) -> Dict:
    """Map a domain ScoredTicker to the wire dict. Returns a plain dict so the
    result is cache-serialisable (the same shape the cache stores)."""
    f = scored.fundamentals
    m = scored.metrics
    s = scored.scores
    return {
        "ticker": scored.ticker,
        "name": f.name,
        "price": f.price,
        "scores": {"fund": s.fund, "tech": s.tech, "combined": s.combined},
        "signal": scored.signal.value if scored.signal else None,
        "metrics": {
            "pe": f.trailing_pe, "fwdPe": f.forward_pe, "peg": f.peg,
            "fcfYield": f.fcf_yield, "roe": f.roe,
            "rsi": m.rsi, "vsSma200": m.sma200_pct, "vsSma50": m.sma50_pct,
            "rangePos": m.range_pos, "sector": f.sector, "marketCap": f.market_cap,
        },
        "lists": lists or [],
        "stale": stale,
    }


def error_row(ticker: str, lists: Optional[List[str]] = None) -> Dict:
    """A ticker whose market data could not be fetched (FR-3.5)."""
    return {
        "ticker": ticker, "name": "", "price": None,
        "scores": {"fund": None, "tech": None, "combined": None},
        "signal": None, "metrics": {}, "lists": lists or [],
        "stale": True,
    }
