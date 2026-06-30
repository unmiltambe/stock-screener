"""yfinance-backed MarketDataPort.

Batches the price download (one request for all symbols) and parallelises the
per-ticker `.info` fundamentals fetch (6 workers) — the approach proven in the
prototype to stay under Yahoo's rate limits. One bad symbol maps to None rather
than failing the batch (FR-3.5). Transient/rate-limit resilience is delegated to
the source-agnostic `with_retry` helper (adapters/retry.py)."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Optional, Sequence

import yfinance as yf

from core.models import Fundamentals, MarketSnapshot

from .retry import with_retry

_MAX_WORKERS = 6
_SCORE_HISTORY_YEARS = 2   # years fetched for scoring (enough for SMA-200 warm-up)


def _fundamentals(sym: str) -> Optional[Fundamentals]:
    def fetch() -> Fundamentals:
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

    return with_retry(fetch, on_exhausted=None, label=f"fundamentals[{sym}]")


def _closes_by_symbol(
    symbols: Sequence[str], years: int = _SCORE_HISTORY_YEARS
) -> Dict[str, tuple]:
    """Return {sym: (dates, closes)} for each symbol. Both lists are parallel and
    in chronological order (oldest → newest). `dates` are ISO-8601 strings.

    yf.download() is a single batch HTTP request and the most common casualty of
    rate-limiting under load, so an empty result is treated as a transient failure
    and retried (via with_retry's is_valid hook), not accepted as "no data"."""
    if not symbols:
        return {}

    def _extract(data) -> Dict[str, tuple]:
        out: Dict[str, tuple] = {}
        if data is None or data.empty:
            return out
        close = data["Close"]
        if hasattr(close, "columns"):
            for sym in symbols:
                if sym in close.columns:
                    col = close[sym].dropna()
                    out[sym] = (
                        [str(d.date()) for d in col.index],
                        [float(x) for x in col.tolist()],
                    )
        else:
            col = close.dropna()
            out[symbols[0]] = (
                [str(d.date()) for d in col.index],
                [float(x) for x in col.tolist()],
            )
        return out

    def fetch() -> Dict[str, tuple]:
        data = yf.download(
            list(symbols), period=f"{years}y", auto_adjust=True,
            progress=False, group_by="column",
        )
        return _extract(data)

    return with_retry(
        fetch,
        is_valid=bool,  # non-empty dict = success; empty = retry
        on_exhausted={},
        label=f"closes[{len(symbols)} symbols]",
    )


class YFinanceMarketData:
    def fetch(self, symbols: Sequence[str], years: int = _SCORE_HISTORY_YEARS) -> Dict[str, Optional[MarketSnapshot]]:
        symbols = [s.upper() for s in symbols]
        closes_data = _closes_by_symbol(symbols, years)

        funds: Dict[str, Optional[Fundamentals]] = {}
        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
            futures = {pool.submit(_fundamentals, s): s for s in symbols}
            for fut in as_completed(futures):
                funds[futures[fut]] = fut.result()

        out: Dict[str, Optional[MarketSnapshot]] = {}
        for sym in symbols:
            f = funds.get(sym)
            dates, series = closes_data.get(sym, ([], []))
            if f is None and not series:
                out[sym] = None
                continue
            out[sym] = MarketSnapshot(fundamentals=f or Fundamentals(), closes=series, dates=dates)
        return out
