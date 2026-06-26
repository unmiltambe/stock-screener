from __future__ import annotations

import time

from adapters import ports
from adapters.memory import (
    FixtureMarketData,
    InMemoryCache,
    InMemoryWatchlistRepo,
)
from core import score_snapshot
from core.models import Signal


def test_implementations_satisfy_ports():
    assert isinstance(InMemoryCache(), ports.CachePort)
    assert isinstance(InMemoryWatchlistRepo(), ports.WatchlistRepo)
    assert isinstance(FixtureMarketData(), ports.MarketDataPort)


def test_cache_get_set_and_expiry():
    cache = InMemoryCache()
    cache.set("k", 123, ttl_seconds=60)
    assert cache.get("k") == 123
    cache.set("short", 1, ttl_seconds=0)
    time.sleep(0.01)
    assert cache.get("short") is None
    assert cache.get("missing") is None


def test_watchlist_crud_is_user_scoped_and_id_keyed():
    repo = InMemoryWatchlistRepo()
    wl = repo.create("u1", "Tech")
    assert wl.id and wl.name == "Tech" and wl.tickers == []

    repo.add_ticker("u1", wl.id, "aapl")    # lowercased input
    repo.add_ticker("u1", wl.id, "AAPL")    # dup ignored
    assert repo.get("u1", wl.id).tickers == ["AAPL"]
    # other user sees nothing
    assert repo.list_all("u2") == []

    # rename keeps the same id (identity is stable across rename — ADR-0004)
    repo.rename("u1", wl.id, "Big Tech")
    renamed = repo.get("u1", wl.id)
    assert renamed.id == wl.id and renamed.name == "Big Tech"

    repo.remove_ticker("u1", wl.id, "AAPL")
    assert repo.get("u1", wl.id).tickers == []
    repo.delete("u1", wl.id)
    assert repo.list_all("u1") == []


def test_watchlist_seed_assigns_ids():
    repo = InMemoryWatchlistRepo(seed={"u1": {"Tech": ["AAPL"], "ETFs": ["SPY"]}})
    lists = repo.list_all("u1")
    assert {w.name for w in lists} == {"Tech", "ETFs"}
    assert all(w.id for w in lists)
    # names need not be unique — two lists can share a name, distinguished by id
    a = repo.create("u1", "Tech")
    b = repo.create("u1", "Tech")
    assert a.id != b.id


def test_fixture_market_data_scores_end_to_end():
    md = FixtureMarketData()
    snaps = md.fetch(["NVDA", "NFLX", "ZZZZ"])
    assert snaps["ZZZZ"] is None              # unresolved symbol → None

    nvda = score_snapshot("NVDA", snaps["NVDA"])
    assert nvda.scores.fund is not None
    assert nvda.scores.tech is not None
    assert nvda.scores.combined is not None
    assert nvda.signal in (Signal.BUY, Signal.NEUTRAL, Signal.TRIM)
    # NVDA fixture (ROE 114, PEG 0.63) should land undervalued-ish
    assert nvda.scores.fund > 55
