"""Profile + account-deletion endpoints (header mode → demo user).

In header mode there's no Cognito pool, so DELETE /v1/account wipes the user's
stored data and the identity-deletion step is a no-op (verified separately).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.deps import _build_service
from api.app import create_app


@pytest.fixture()
def client():
    _build_service.cache_clear()
    return TestClient(create_app())


def test_profile_starts_empty_then_round_trips(client):
    assert client.get("/v1/profile").json() == {"first_name": "", "last_name": ""}

    r = client.put("/v1/profile", json={"first_name": "  Ada ", "last_name": "Lovelace"})
    assert r.status_code == 200
    assert r.json() == {"first_name": "Ada", "last_name": "Lovelace"}  # trimmed

    assert client.get("/v1/profile").json()["first_name"] == "Ada"


def test_delete_account_wipes_watchlists_and_profile(client):
    client.put("/v1/profile", json={"first_name": "Ada", "last_name": "L"})
    assert client.get("/v1/watchlists").json()  # demo user seeded with lists

    assert client.delete("/v1/account").status_code == 204

    assert client.get("/v1/watchlists").json() == []
    assert client.get("/v1/profile").json() == {"first_name": "", "last_name": ""}


def test_profile_survives_unrelated_user(client):
    client.put("/v1/profile", json={"first_name": "Ada", "last_name": "L"})
    # a different user has their own (empty) profile
    other = client.get("/v1/profile", headers={"X-User-Id": "someone-else"}).json()
    assert other == {"first_name": "", "last_name": ""}
