"""Starter-watchlist seeding is once-only and race-safe (no duplicate lists).

Regression for the bug where ensure_seeded ran on every watchlist fetch and,
under eventually-consistent reads, re-seeded "Starter picks" repeatedly.
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
    assert _names(svc, "user-1") == ["Starter picks"]


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
    assert _names(svc, "user-1") == ["Starter picks"]


# ── init_session: bootstrap exactly once (the dup-on-every-sign-in fix) ─────────

def test_init_session_seeds_once_over_many_calls():
    svc = _svc()
    for _ in range(10):                         # mimic many app loads / refreshes
        svc.init_session("user-1")
    assert _names(svc, "user-1") == ["Starter picks"]


def test_init_session_migrates_then_never_recopies_guest_starter():
    svc = _svc()
    # First sign-in: guest g1 had a real list → migrated, no starter on top.
    g1 = "GUEST#g1"
    wl = svc._watchlists.create(g1, "My Picks")
    svc._watchlists.add_ticker(g1, wl.id, "NVDA")
    r1 = svc.init_session("user-1", "g1")
    assert r1["bootstrapped"] and r1["migrated"] == 1
    assert _names(svc, "user-1") == ["My Picks"]

    # Later: signed out, browsed as guest g2 (auto-seeded a starter), signs back in.
    svc._seed_starter("GUEST#g2")
    r2 = svc.init_session("user-1", "g2")
    assert r2["bootstrapped"] is False          # marker already set → no-op
    assert _names(svc, "user-1") == ["My Picks"]  # NO duplicate 'Starter picks'


def test_init_session_seeds_guest_once():
    svc = _svc()
    svc.init_session("GUEST#abc")
    svc.init_session("GUEST#abc")
    assert _names(svc, "GUEST#abc") == ["Starter picks"]
