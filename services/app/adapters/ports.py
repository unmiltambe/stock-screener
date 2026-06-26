"""Adapter interfaces (Protocols).

The application layer depends on these, never on concrete implementations. This
is what keeps the core pure (P3) and lets market-data / cache / persistence be
swapped — in-memory for tests and local runs, yfinance + DynamoDB in the cloud.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Protocol, Sequence, runtime_checkable

from core.models import MarketSnapshot, Watchlist


@runtime_checkable
class MarketDataPort(Protocol):
    """Fetches fundamentals + price history for tickers.

    Implementations should be resilient: a symbol that cannot be resolved maps to
    None rather than raising, so one bad ticker never fails a whole batch
    (FR-3.5). Implementations are responsible for throttling/batching upstream.
    """

    def fetch(self, symbols: Sequence[str]) -> Dict[str, Optional[MarketSnapshot]]:
        ...


@runtime_checkable
class CachePort(Protocol):
    """A TTL key/value cache (DynamoDB TTL in prod). Used for 15-min score cache."""

    def get(self, key: str) -> Optional[Any]:
        ...

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        ...


@runtime_checkable
class WatchlistRepo(Protocol):
    """Per-user watchlist persistence, keyed by a stable opaque `watchlist_id`
    (ADR-0004). Every method is scoped by user_id (P8)."""

    def list_all(self, user_id: str) -> List[Watchlist]:
        ...

    def get(self, user_id: str, watchlist_id: str) -> Optional[Watchlist]:
        ...

    def create(self, user_id: str, name: str) -> Watchlist:
        """Create a watchlist with a freshly minted id; returns it."""
        ...

    def rename(self, user_id: str, watchlist_id: str, new_name: str) -> None:
        ...

    def delete(self, user_id: str, watchlist_id: str) -> None:
        ...

    def add_ticker(self, user_id: str, watchlist_id: str, symbol: str) -> None:
        ...

    def remove_ticker(self, user_id: str, watchlist_id: str, symbol: str) -> None:
        ...
