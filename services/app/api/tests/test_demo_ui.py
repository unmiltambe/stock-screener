"""Tests for the interim server-rendered demo UI (ADR-0005)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.app import create_app
from api.deps import _build_service


@pytest.fixture()
def client():
    _build_service.cache_clear()
    return TestClient(create_app())


def test_root_redirects_to_ui(client):
    r = client.get("/", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "/ui"


def test_index_lists_watchlists_when_open(client, monkeypatch):
    monkeypatch.delenv("BASIC_AUTH_PASS", raising=False)  # auth open
    r = client.get("/ui")
    assert r.status_code == 200
    assert "Big Tech" in r.text and "Streaming" in r.text


def test_watchlist_page_renders_scores(client, monkeypatch):
    monkeypatch.delenv("BASIC_AUTH_PASS", raising=False)
    wid = next(w["id"] for w in client.get("/v1/watchlists").json()
            if w["name"] == "Big Tech")
    r = client.get(f"/ui/watchlists/{wid}")
    assert r.status_code == 200
    assert "NVDA" in r.text and "<table" in r.text


def test_unknown_watchlist_page_404(client, monkeypatch):
    monkeypatch.delenv("BASIC_AUTH_PASS", raising=False)
    assert client.get("/ui/watchlists/nope").status_code == 404


def test_basic_auth_enforced_when_configured(monkeypatch):
    monkeypatch.setenv("BASIC_AUTH_USER", "admin")
    monkeypatch.setenv("BASIC_AUTH_PASS", "secret")
    _build_service.cache_clear()
    c = TestClient(create_app())
    assert c.get("/ui").status_code == 401
    assert c.get("/ui", auth=("admin", "wrong")).status_code == 401
    assert c.get("/ui", auth=("admin", "secret")).status_code == 200


# ── CRUD via the UI forms ─────────────────────────────────────────────────────

def _id_for(client, name):
    return next(w["id"] for w in client.get("/v1/watchlists").json() if w["name"] == name)


def test_create_watchlist_via_form(client, monkeypatch):
    monkeypatch.delenv("BASIC_AUTH_PASS", raising=False)
    r = client.post("/ui/create", data={"name": "Energy"})  # follows 303 → page
    assert r.status_code == 200 and "Energy" in r.text
    assert "Energy" in {w["name"] for w in client.get("/v1/watchlists").json()}


def test_add_and_remove_ticker_via_form(client, monkeypatch):
    monkeypatch.delenv("BASIC_AUTH_PASS", raising=False)
    wid = _id_for(client, "Big Tech")
    client.post(f"/ui/watchlists/{wid}/add", data={"symbol": "msft"})
    assert "MSFT" in client.get(f"/ui/watchlists/{wid}").text
    client.post(f"/ui/watchlists/{wid}/remove", data={"symbol": "MSFT"})
    assert "MSFT" not in client.get(f"/ui/watchlists/{wid}").text


def test_rename_via_form(client, monkeypatch):
    monkeypatch.delenv("BASIC_AUTH_PASS", raising=False)
    wid = _id_for(client, "Streaming")
    r = client.post(f"/ui/watchlists/{wid}/rename", data={"name": "Video"})
    assert r.status_code == 200 and "Video" in r.text
    assert {w["id"]: w["name"] for w in client.get("/v1/watchlists").json()}[wid] == "Video"


def test_delete_watchlist_via_form(client, monkeypatch):
    monkeypatch.delenv("BASIC_AUTH_PASS", raising=False)
    wid = _id_for(client, "Streaming")
    client.post(f"/ui/watchlists/{wid}/delete")
    assert "Streaming" not in {w["name"] for w in client.get("/v1/watchlists").json()}
