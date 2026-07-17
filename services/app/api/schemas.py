"""API response shapes — pure data (P1).

No colors, no formatted strings, no display labels. Frontends derive presentation
from these raw values via packages/view-logic.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel

from core.chips import build_chips
from core.models import ScoredTicker


class ScoresOut(BaseModel):
    fund: Optional[float] = None
    tech: Optional[float] = None
    combined: Optional[float] = None
    setup: Optional[float] = None


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
    # Setup-score raw inputs (for the Setup Metrics columns in the table)
    macdHistPct: Optional[float] = None   # MACD histogram as % of price
    macdBarsOnSide: Optional[int] = None  # bars histogram on current side of zero
    obvTrendPct: Optional[float] = None   # 20-bar OBV % change
    # SMA crossover signals: +N = above-cross N bars ago, -N = below-cross, None = no recent cross
    sma50CrossBars: Optional[int] = None
    sma200CrossBars: Optional[int] = None


class TickerRow(BaseModel):
    ticker: str
    name: str = ""
    price: Optional[float] = None
    dayChange: Optional[float] = None      # vs previous close, in dollars
    dayChangePct: Optional[float] = None   # same change as percent
    scores: ScoresOut = ScoresOut()
    signal: Optional[str] = None
    metrics: MetricsOut = MetricsOut()
    chips: List[Dict] = []
    lists: List[str] = []
    stale: bool = False


class SymbolOut(BaseModel):
    """One autocomplete match from the symbol universe (ADR-0011)."""
    symbol: str
    name: str
    exchange: str
    market: str


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
    volume: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    obv: Optional[float] = None


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
    metrics = {
        "pe": f.trailing_pe, "fwdPe": f.forward_pe, "peg": f.peg,
        "fcfYield": f.fcf_yield, "roe": f.roe,
        "rsi": m.rsi, "vsSma200": m.sma200_pct, "vsSma50": m.sma50_pct,
        "rangePos": m.range_pos, "sector": f.sector, "marketCap": f.market_cap,
        "macdHistPct": m.macd_hist_pct, "macdBarsOnSide": m.macd_bars_on_side,
        "obvTrendPct": m.obv_trend_pct,
        "sma50CrossBars": m.sma50_cross_bars, "sma200CrossBars": m.sma200_cross_bars,
    }
    return {
        "ticker": scored.ticker,
        "name": f.name,
        "price": f.price,
        "dayChange": f.day_change,
        "dayChangePct": f.day_change_pct,
        "scores": {"fund": s.fund, "tech": s.tech, "combined": s.combined, "setup": s.setup},
        "signal": scored.signal.value if scored.signal else None,
        "metrics": metrics,
        "chips": build_chips({"metrics": metrics}),
        "lists": lists or [],
        "stale": stale,
    }


def error_row(ticker: str, lists: Optional[List[str]] = None) -> Dict:
    """A ticker whose market data could not be fetched (FR-3.5)."""
    return {
        "ticker": ticker, "name": "", "price": None,
        "dayChange": None, "dayChangePct": None,
        "scores": {"fund": None, "tech": None, "combined": None},
        "signal": None, "metrics": {}, "lists": lists or [],
        "stale": True,
    }
