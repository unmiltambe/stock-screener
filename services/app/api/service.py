"""Application service — orchestrates adapters + the pure core.

Holds no web/HTTP concerns and no presentation. Depends only on the adapter
Protocols, so it runs identically with in-memory or cloud-backed adapters.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Sequence

from adapters.ports import CachePort, MarketDataPort, WatchlistRepo
from core import score_snapshot, sma_series

from . import schemas

SCORE_TTL_SECONDS = 900  # 15 minutes (FR-3.3/3.4)

# Starter content for a brand-new user, so the first experience isn't empty
# (FR-2.4). Generic — distinct from the owner's demo seed (seed_watchlists.json).
STARTER_WATCHLISTS = {"My Watchlist": ["AAPL", "MSFT", "NVDA"]}


class ScreenerService:
    def __init__(
        self,
        market: MarketDataPort,
        cache: CachePort,
        watchlists: WatchlistRepo,
    ) -> None:
        self._market = market
        self._cache = cache
        self._watchlists = watchlists

    # ── scoring (cache-first) ─────────────────────────────────────────────────

    def scored_rows(self, symbols: Sequence[str]) -> List[Dict]:
        """Return wire rows for `symbols`, cache-first; one upstream fetch for the
        misses, never per-symbol storms (P5). Order is preserved."""
        symbols = [s.upper() for s in symbols]
        rows: Dict[str, Dict] = {}
        misses: List[str] = []

        for sym in symbols:
            cached = self._cache.get(self._key(sym))
            if cached is not None:
                rows[sym] = cached
            else:
                misses.append(sym)

        if misses:
            snapshots = self._market.fetch(misses)
            for sym in misses:
                snap = snapshots.get(sym)
                if snap is None:
                    rows[sym] = schemas.error_row(sym)
                    continue  # don't cache transient failures
                row = schemas.row_from_scored(score_snapshot(sym, snap))
                # Only cache when both fundamentals AND closes succeeded.
                # - price=None → .info was rate-limited; retry next request
                # - closes=[] → yf.download() was rate-limited; retry next request
                # ETFs (price present, PE/ROE absent) and new IPOs (<200 days of
                # history) are fine: they have a price and non-empty closes.
                if snap.fundamentals.price is not None and snap.closes:
                    self._cache.set(self._key(sym), row, SCORE_TTL_SECONDS)
                rows[sym] = row

        return [rows[s] for s in symbols]

    # ── watchlists (keyed by stable id — ADR-0004) ────────────────────────────

    def ensure_seeded(self, user_id: str) -> None:
        """Seed starter watchlists for a user who has none (FR-2.4). Idempotent
        while the user keeps at least one list."""
        if self._watchlists.list_all(user_id):
            return
        for name, tickers in STARTER_WATCHLISTS.items():
            wl = self._watchlists.create(user_id, name)
            for t in tickers:
                self._watchlists.add_ticker(user_id, wl.id, t)

    def list_watchlists(self, user_id: str) -> List[Dict]:
        lists = sorted(self._watchlists.list_all(user_id), key=lambda w: w.name)
        return [{"id": w.id, "name": w.name, "count": len(w.tickers)} for w in lists]

    def get_watchlist(self, user_id: str, watchlist_id: str) -> Optional[List[Dict]]:
        wl = self._watchlists.get(user_id, watchlist_id)
        if wl is None:
            return None
        return self.scored_rows(wl.tickers)

    def create_watchlist(self, user_id: str, name: str) -> Dict:
        wl = self._watchlists.create(user_id, name)
        return {"id": wl.id, "name": wl.name}

    def rename_watchlist(self, user_id: str, watchlist_id: str, new_name: str) -> bool:
        if self._watchlists.get(user_id, watchlist_id) is None:
            return False
        self._watchlists.rename(user_id, watchlist_id, new_name)
        return True

    def delete_watchlist(self, user_id: str, watchlist_id: str) -> None:
        self._watchlists.delete(user_id, watchlist_id)

    def add_ticker(self, user_id: str, watchlist_id: str, symbol: str) -> bool:
        if self._watchlists.get(user_id, watchlist_id) is None:
            return False
        self._watchlists.add_ticker(user_id, watchlist_id, symbol)
        return True

    def remove_ticker(self, user_id: str, watchlist_id: str, symbol: str) -> bool:
        if self._watchlists.get(user_id, watchlist_id) is None:
            return False
        self._watchlists.remove_ticker(user_id, watchlist_id, symbol)
        return True

    # ── leaderboard ───────────────────────────────────────────────────────────

    def leaderboard(self, user_id: str) -> Dict[str, List[Dict]]:
        """Aggregate every ticker across the user's lists (de-duplicated, with
        membership by list name) and build ranked views (FR-5.1/5.2)."""
        membership: Dict[str, List[str]] = {}
        for wl in self._watchlists.list_all(user_id):
            for t in wl.tickers:
                membership.setdefault(t.upper(), []).append(wl.name)

        rows = self.scored_rows(list(membership.keys()))
        for row in rows:
            row["lists"] = membership.get(row["ticker"], [])

        def by(metric: str, reverse: bool):
            scored = [r for r in rows if r["scores"].get(metric) is not None]
            return sorted(scored, key=lambda r: r["scores"][metric], reverse=reverse)

        return {
            "top_opportunities": by("combined", reverse=True)[:5],
            "reconsider": by("combined", reverse=False)[:5],
            "best_value": by("fund", reverse=True)[:5],
            "best_momentum": by("tech", reverse=True)[:5],
        }

    # ── chart ─────────────────────────────────────────────────────────────────

    def chart(self, symbol: str, years: int = 1) -> Optional[Dict]:
        symbol = symbol.upper()
        snap = self._market.fetch([symbol], years=years).get(symbol)
        if snap is None or not snap.closes:
            return None
        closes = snap.closes
        dates = snap.dates
        sma50 = sma_series(closes, 50)
        sma200 = sma_series(closes, 200)
        points = [
            {
                "t": dates[i] if i < len(dates) else str(i),
                "price": closes[i],
                "sma50": sma50[i],
                "sma200": sma200[i],
            }
            for i in range(len(closes))
        ]
        return {"ticker": symbol, "points": points}

    @staticmethod
    def _key(symbol: str) -> str:
        return f"score:{symbol}"
