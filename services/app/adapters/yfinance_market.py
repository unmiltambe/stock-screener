"""yfinance-backed MarketDataPort.

Batches the price download (one request for all symbols) and parallelises the
per-ticker `.info` fundamentals fetch (6 workers) — the approach proven in the
prototype to stay under Yahoo's rate limits. One bad symbol maps to None rather
than failing the batch (FR-3.5).
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Sequence

import yfinance as yf

from core.models import Fundamentals, MarketSnapshot

logger = logging.getLogger(__name__)

_MAX_WORKERS = 6
_HISTORY_PERIOD = "2y"  # enough to warm up SMA-200
_FUNDAMENTALS_RETRIES = 2  # retry transient rate-limit errors
_RETRY_BACKOFF = 1.0       # seconds between retries (doubles each attempt)


def _fundamentals(sym: str) -> Optional[Fundamentals]:
    last_exc: Optional[Exception] = None
    for attempt in range(_FUNDAMENTALS_RETRIES + 1):
        try:
            info = yf.Ticker(sym).info
            price = info.get("currentPrice") or info.get("regularMarketPrice")
            mktcap = info.get("marketCap")
            fcf = info.get("freeCashflow")
            roe = info.get("returnOnEquity")
            return Fundamentals(
                name=info.get("longName") or info.get("shortName") or "",
                sector=info.get("sector"),
                price=price,
                market_cap=mktcap,
                high_52w=info.get("fiftyTwoWeekHigh"),
                low_52w=info.get("fiftyTwoWeekLow"),
                trailing_pe=info.get("trailingPE"),
                forward_pe=info.get("forwardPE"),
                peg=info.get("pegRatio"),
                fcf_yield=round(fcf / mktcap * 100, 1) if fcf and mktcap else None,
                roe=round(roe * 100, 1) if roe is not None else None,
            )
        except Exception as exc:
            last_exc = exc
            if attempt < _FUNDAMENTALS_RETRIES:
                time.sleep(_RETRY_BACKOFF * (2 ** attempt))
    logger.warning("fundamentals failed for %s after %d attempts: %s", sym, _FUNDAMENTALS_RETRIES + 1, last_exc)
    return None


def _closes_by_symbol(symbols: Sequence[str]) -> Dict[str, List[float]]:
    if not symbols:
        return {}
    data = yf.download(
        list(symbols), period=_HISTORY_PERIOD, auto_adjust=True,
        progress=False, group_by="column",
    )
    out: Dict[str, List[float]] = {}
    if data is None or data.empty:
        return out
    close = data["Close"]
    if hasattr(close, "columns"):  # multiple symbols → DataFrame
        for sym in symbols:
            if sym in close.columns:
                out[sym] = [float(x) for x in close[sym].dropna().tolist()]
    else:  # single symbol → Series
        out[symbols[0]] = [float(x) for x in close.dropna().tolist()]
    return out


class YFinanceMarketData:
    def fetch(self, symbols: Sequence[str]) -> Dict[str, Optional[MarketSnapshot]]:
        symbols = [s.upper() for s in symbols]
        closes = _closes_by_symbol(symbols)

        funds: Dict[str, Optional[Fundamentals]] = {}
        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
            futures = {pool.submit(_fundamentals, s): s for s in symbols}
            for fut in as_completed(futures):
                funds[futures[fut]] = fut.result()

        out: Dict[str, Optional[MarketSnapshot]] = {}
        for sym in symbols:
            f = funds.get(sym)
            series = closes.get(sym, [])
            if f is None and not series:
                out[sym] = None
                continue
            out[sym] = MarketSnapshot(fundamentals=f or Fundamentals(), closes=series)
        return out
