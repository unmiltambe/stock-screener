"""Symbol universe adapters (ADR-0011).

Per-market providers of the tradable symbol list, behind `SymbolUniversePort`.
US: the NASDAQ Trader directory (every US-listed symbol incl. ETFs). Markets are
**additive** — `load_universe()` composes the *enabled* markets into one searchable
set, each fetched once and cached in-process with a TTL (P5: one upstream fetch per
market per TTL window across all users, never per request).
"""
from __future__ import annotations

import os
import time
from typing import Dict, List, Optional

import httpx

from core.models import SymbolInfo

# NASDAQ Trader "Listing Exchange" code → display name.
_US_EXCHANGES = {
    "N": "NYSE", "Q": "NASDAQ", "A": "NYSE American",
    "P": "NYSE Arca", "Z": "Cboe BZX", "V": "IEX",
}
# HTTPS (Lambda-safe; FTP is often blocked through NAT).
_NASDAQ_TRADED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt"

# A screener wants common stock + ETFs. We drop warrants/rights/units/preferreds —
# also the symbols whose ids most often mismatch Yahoo. Matched by security-name
# *structure* (last word / a definite common-stock ending), NOT loose substrings —
# so "Bright"/"United"/"Preferred Bank" (real common stocks) aren't false-dropped.
_COMMON_ENDINGS = ("COMMON STOCK", "COMMON SHARES", "COMMON SHARE", "ORDINARY SHARES")
_EXCLUDE_LAST_WORD = {"WARRANT", "WARRANTS", "RIGHT", "RIGHTS", "UNIT", "UNITS"}


def normalize_symbol(sym: str) -> str:
    """Map an exchange-feed symbol to Yahoo/yfinance's form. US class shares use
    '.'/'/' as the class separator; Yahoo uses '-' (BRK.B / BRK/B → BRK-B). See
    ADR-0011 'Risk'."""
    return sym.replace(".", "-").replace("/", "-").strip().upper()


def _is_common_or_etf(name: str, is_etf: bool) -> bool:
    if is_etf:
        return True
    up = " ".join(name.upper().replace(",", " ").split())
    if up.endswith(_COMMON_ENDINGS):     # unambiguously common — keep (e.g. "Preferred Bank Common Stock")
        return True
    words = up.split()
    if words and words[-1] in _EXCLUDE_LAST_WORD:  # "... Warrant/Right/Unit" — drop
        return False
    if "PREFERRED" in up or " PFD" in up:          # preferreds not ending in "Common Stock"
        return False
    return True                          # default keep: ADRs, class shares, etc.


def parse_nasdaq_traded(text: str) -> List[SymbolInfo]:
    """Parse the pipe-delimited NASDAQ Trader `nasdaqtraded.txt` into US symbols.
    Cols: 0 Nasdaq-Traded | 1 Symbol | 2 Security Name | 3 Listing Exchange |
    5 ETF | 7 Test Issue. Skips the header row and the `File Creation Time` footer."""
    out: List[SymbolInfo] = []
    for line in text.splitlines()[1:]:  # skip header
        if line.startswith("File Creation Time"):
            break
        cols = line.split("|")
        if len(cols) < 8:
            continue
        traded, symbol, name, listing_ex = cols[0], cols[1], cols[2], cols[3]
        is_etf, test_issue = cols[5] == "Y", cols[7]
        if traded != "Y" or test_issue == "Y" or not symbol:
            continue
        if not _is_common_or_etf(name, is_etf):
            continue
        canonical = normalize_symbol(symbol)
        if not canonical:
            continue
        out.append(SymbolInfo(
            symbol=canonical,
            name=name.strip(),
            exchange=_US_EXCHANGES.get(listing_ex, listing_ex),
            market="US",
        ))
    return out


class UsSymbolUniverse:
    """US symbol universe from the NASDAQ Trader directory (ADR-0011)."""

    market = "US"

    def fetch(self) -> List[SymbolInfo]:
        resp = httpx.get(_NASDAQ_TRADED_URL, timeout=30.0)
        resp.raise_for_status()
        return parse_nasdaq_traded(resp.text)


# ── registry: compose the enabled markets, cached in-process with a TTL ──────────

_MARKET_ADAPTERS: Dict[str, type] = {"US": UsSymbolUniverse}
_CACHE_TTL_SECONDS = 24 * 3600            # the directory changes ~daily
_cache: Dict[str, tuple] = {}             # market -> (fetched_at, list[SymbolInfo])


def _enabled_markets() -> List[str]:
    """The set of enabled markets (additive, not either-or). US only today."""
    raw = os.getenv("ENABLED_MARKETS", "US")
    return [m.strip().upper() for m in raw.split(",") if m.strip()]


def load_universe(now: Optional[float] = None) -> List[SymbolInfo]:
    """The composed universe across enabled markets, each cached per market with a
    TTL. One upstream fetch per market per TTL window across all users (P5)."""
    now = time.time() if now is None else now
    composed: List[SymbolInfo] = []
    for market in _enabled_markets():
        adapter_cls = _MARKET_ADAPTERS.get(market)
        if adapter_cls is None:
            continue
        cached = _cache.get(market)
        if cached is None or now - cached[0] > _CACHE_TTL_SECONDS:
            _cache[market] = (now, adapter_cls().fetch())
        composed.extend(_cache[market][1])
    return composed
