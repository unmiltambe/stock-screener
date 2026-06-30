"""Guest → account migration (ADR-0009) and the guest-TTL helper."""
from __future__ import annotations

from adapters.memory import FixtureMarketData, InMemoryCache, InMemoryWatchlistRepo
from adapters.ports import GUEST_PREFIX, is_guest
from api.service import ScreenerService


def _svc():
    return ScreenerService(FixtureMarketData(), InMemoryCache(), InMemoryWatchlistRepo())


def _seed_guest(repo, guest_id: str):
    gu = f"{GUEST_PREFIX}{guest_id}"
    wl = repo.create(gu, "My Picks")
    repo.add_ticker(gu, wl.id, "NVDA")
    repo.add_ticker(gu, wl.id, "AAPL")
    return gu


def test_migrate_moves_lists_and_clears_guest():
    svc = _svc()
    guest_id = "abc-123"
    gu = _seed_guest(svc._watchlists, guest_id)

    migrated = svc.migrate_guest("user-1", guest_id)
    assert migrated == 1

    # user now owns the list (with its tickers)…
    user_lists = svc._watchlists.list_all("user-1")
    assert [w.name for w in user_lists] == ["My Picks"]
    assert set(user_lists[0].tickers) == {"NVDA", "AAPL"}
    # …and the guest has nothing left
    assert svc._watchlists.list_all(gu) == []


def test_migrate_is_idempotent():
    svc = _svc()
    guest_id = "def-456"
    _seed_guest(svc._watchlists, guest_id)

    assert svc.migrate_guest("user-1", guest_id) == 1
    assert svc.migrate_guest("user-1", guest_id) == 0  # nothing left to move
    assert len(svc._watchlists.list_all("user-1")) == 1  # not duplicated


def test_migrate_merges_into_existing_user_lists():
    svc = _svc()
    svc._watchlists.create("user-1", "Existing")
    _seed_guest(svc._watchlists, "ghi-789")

    svc.migrate_guest("user-1", "ghi-789")
    names = sorted(w.name for w in svc._watchlists.list_all("user-1"))
    assert names == ["Existing", "My Picks"]  # additive merge


def test_is_guest_predicate():
    assert is_guest(f"{GUEST_PREFIX}whatever") is True
    assert is_guest("cognito-sub-123") is False


def test_guest_ttl_only_for_guests():
    from adapters.dynamo import _guest_ttl  # imported here (boto3 only needed for this)

    assert _guest_ttl("real-user") is None
    ttl = _guest_ttl(f"{GUEST_PREFIX}x")
    assert isinstance(ttl, int) and ttl > 0
