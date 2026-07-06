"""Adapter interfaces (Protocols).

The application layer depends on these, never on concrete implementations. This
is what keeps the core pure (P3) and lets market-data / cache / persistence be
swapped — in-memory for tests and local runs, yfinance + DynamoDB in the cloud.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Protocol, Sequence, runtime_checkable

from core.models import MarketSnapshot, SymbolInfo, Watchlist

# Identity namespace for unauthenticated guest sessions (ADR-0009). A guest user
# id is `GUEST#<uuid>`; authenticated users are the bare Cognito `sub`. Defined
# here (shared) so the auth layer that mints it and the store that applies a TTL
# to guest items agree on one prefix.
GUEST_PREFIX = "GUEST#"


def is_guest(user_id: str) -> bool:
    return user_id.startswith(GUEST_PREFIX)


@runtime_checkable
class MarketDataPort(Protocol):
    """Fetches fundamentals + price history for tickers.

    Implementations should be resilient: a symbol that cannot be resolved maps to
    None rather than raising, so one bad ticker never fails a whole batch
    (FR-3.5). Implementations are responsible for throttling/batching upstream.
    """

    def fetch(self, symbols: Sequence[str], years: int = 2) -> Dict[str, Optional[MarketSnapshot]]:
        ...


@runtime_checkable
class SymbolUniversePort(Protocol):
    """Provides one market's tradable symbol list (ADR-0011). `market` is the code
    (e.g. "US"); `fetch()` returns the full list — the caller caches it (fetched once,
    served to all, never per user request, P5). Markets are additive: a registry
    composes the enabled markets into one searchable set."""

    market: str

    def fetch(self) -> List[SymbolInfo]:
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

    # ── user profile + account lifecycle (single-table, same USER# partition) ──

    def get_profile(self, user_id: str) -> Optional[Dict[str, str]]:
        """The user's profile attributes (e.g. {'first_name','last_name'}), or None."""
        ...

    def set_profile(self, user_id: str, profile: Dict[str, str]) -> None:
        ...

    def delete_all(self, user_id: str) -> None:
        """Remove every item for the user — watchlists + profile (account deletion)."""
        ...

    def try_mark_seeded(self, user_id: str) -> bool:
        """Atomically claim the one-time seed for this user. Returns True for the
        single caller that set the marker, False if it already existed — so starter
        seeding happens exactly once even under concurrent, eventually-consistent
        reads (the dedup that prevents duplicate starter lists)."""
        ...
