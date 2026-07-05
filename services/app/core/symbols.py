"""Pure symbol search/ranking (ADR-0011) — no IO, no framework (P3).

Ranks a symbol universe against a query for autocomplete: exact ticker match first,
then ticker prefix, then a name substring. Operates over the composed universe the
API assembles from the enabled markets.
"""
from __future__ import annotations

from typing import List

from core.models import SymbolInfo


def search_symbols(universe: List[SymbolInfo], query: str, limit: int = 8) -> List[SymbolInfo]:
    q = (query or "").strip().upper()
    if not q:
        return []

    exact: List[SymbolInfo] = []
    prefix: List[SymbolInfo] = []
    name_hit: List[SymbolInfo] = []
    for s in universe:
        sym = s.symbol.upper()
        if sym == q:
            exact.append(s)
        elif sym.startswith(q):
            prefix.append(s)
        elif q in s.name.upper():
            name_hit.append(s)

    # Within each tier, order deterministically: prefix by (length, symbol) so the
    # closest/shortest ticker leads; name hits alphabetically by symbol.
    prefix.sort(key=lambda s: (len(s.symbol), s.symbol))
    name_hit.sort(key=lambda s: s.symbol)

    return (exact + prefix + name_hit)[:limit]
