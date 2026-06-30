"""Starter-watchlist seeding is once-only and race-safe (no duplicate lists).

Regression for the bug where ensure_seeded ran on every watchlist fetch and,
under eventually-consistent reads, re-seeded "My Watchlist" repeatedly.
"""
from __future__ import annotations

from adapters.memory import FixtureMarketData, InMemoryCache, InMemoryWatchlistRepo
from api.service import ScreenerService


def _svc():
    return ScreenerService(FixtureMarketData(), InMemoryCache(), InMemoryWatchlistRepo())


def _names(svc, user):
    return [w.name for w in svc._watchlists.list_all(user)]


def test_repeated_ensure_seeded_creates_exactly_one_starter():
    svc = _svc()
    for _ in range(25):                      # mimic many watchlist fetches in a session
        svc.ensure_seeded("user-1")
    assert _names(svc, "user-1") == ["My Watchlist"]


def test_ensure_seeded_skips_when_user_already_has_lists():
    svc = _svc()
    svc._watchlists.create("user-1", "ETFs")
    svc.ensure_seeded("user-1")
    assert _names(svc, "user-1") == ["ETFs"]   # no starter added on top


def test_migrated_user_gets_no_starter():
    svc = _svc()
    gu = "GUEST#g1"
    wl = svc._watchlists.create(gu, "My Picks")
    svc._watchlists.add_ticker(gu, wl.id, "NVDA")

    svc.migrate_guest("user-1", "g1")          # brings a list + claims the seed
    svc.ensure_seeded("user-1")                # must not add a starter
    assert _names(svc, "user-1") == ["My Picks"]


def test_account_deletion_allows_reseed():
    svc = _svc()
    svc.ensure_seeded("user-1")
    svc.delete_user_data("user-1")             # clears lists + seed marker
    svc.ensure_seeded("user-1")
    assert _names(svc, "user-1") == ["My Watchlist"]
