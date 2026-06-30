"""API tests against the in-memory backend (offline, deterministic).

Uses FastAPI's TestClient; the demo user is pre-seeded with two watchlists.
Data routes are under /v1 and keyed by stable watchlist id (ADR-0004).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.deps import _build_service
from api.app import create_app


@pytest.fixture()
def client():
    _build_service.cache_clear()  # fresh in-memory state per test
    return TestClient(create_app())


def _id_for(client, name: str) -> str:
    return next(w["id"] for w in client.get("/v1/watchlists").json() if w["name"] == name)


def test_health_is_unversioned(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_seeded_watchlists_listed_with_ids(client):
    r = client.get("/v1/watchlists")
    assert r.status_code == 200
    items = r.json()
    assert {w["name"]: w["count"] for w in items} == {"Big Tech": 3, "Streaming": 1}
    assert all(w["id"] for w in items)  # every list has a stable id


def test_get_watchlist_by_id_is_scored(client):
    rows = client.get(f"/v1/watchlists/{_id_for(client, 'Big Tech')}").json()
    assert {row["ticker"] for row in rows} == {"AAPL", "NVDA", "GOOGL"}
    nvda = next(r for r in rows if r["ticker"] == "NVDA")
    assert nvda["scores"]["combined"] is not None
    assert nvda["signal"] in ("Buy", "Neutral", "Trim")
    assert nvda["name"]  # fundamentals populated


def test_unknown_watchlist_404(client):
    assert client.get("/v1/watchlists/does-not-exist").status_code == 404


def test_add_and_remove_ticker_roundtrip(client):
    wid = _id_for(client, "Big Tech")
    client.put(f"/v1/watchlists/{wid}/tickers/msft")
    rows = client.get(f"/v1/watchlists/{wid}").json()
    msft = next((r for r in rows if r["ticker"] == "MSFT"), None)
    assert msft is not None and msft["stale"] is True  # added (normalised), not in fixtures
    client.delete(f"/v1/watchlists/{wid}/tickers/MSFT")
    rows = client.get(f"/v1/watchlists/{wid}").json()
    assert "MSFT" not in {r["ticker"] for r in rows}


def test_add_ticker_to_missing_watchlist_404(client):
    assert client.put("/v1/watchlists/nope/tickers/AAPL").status_code == 404


def test_create_returns_id_then_delete(client):
    created = client.post("/v1/watchlists", json={"name": "Temp"})
    assert created.status_code == 201
    wid = created.json()["id"]
    assert wid and created.json()["name"] == "Temp"
    client.delete(f"/v1/watchlists/{wid}")
    assert "Temp" not in {w["name"] for w in client.get("/v1/watchlists").json()}


def test_rename_keeps_id_changes_name(client):
    wid = _id_for(client, "Streaming")
    r = client.patch(f"/v1/watchlists/{wid}", json={"name": "Video"})
    assert r.status_code == 200 and r.json() == {"id": wid, "name": "Video"}
    # same id, new name (URL stable across rename — ADR-0004)
    after = {w["id"]: w["name"] for w in client.get("/v1/watchlists").json()}
    assert after[wid] == "Video"


def test_names_need_not_be_unique(client):
    a = client.post("/v1/watchlists", json={"name": "Dup"}).json()["id"]
    b = client.post("/v1/watchlists", json={"name": "Dup"}).json()["id"]
    assert a != b


def test_scores_endpoint(client):
    rows = client.get("/v1/scores", params={"tickers": "NVDA,NFLX"}).json()
    assert {r["ticker"] for r in rows} == {"NVDA", "NFLX"}


def test_leaderboard_shape_and_membership(client):
    lb = client.get("/v1/leaderboard").json()
    assert set(lb) == {"top_opportunities", "reconsider", "best_value", "best_momentum"}
    everything = lb["top_opportunities"] + lb["best_value"]
    nvda = next((r for r in everything if r["ticker"] == "NVDA"), None)
    if nvda:
        assert nvda["lists"] == ["Big Tech"]  # membership by list name


def test_all_symbols_dedups_with_membership(client):
    # Seeded user has Big Tech (AAPL, NVDA, GOOGL) and Streaming (NFLX).
    rows = client.get("/v1/all-symbols").json()
    tickers = {r["ticker"] for r in rows}
    assert {"AAPL", "NVDA", "GOOGL", "NFLX"} <= tickers
    # each unique ticker appears exactly once (deduplicated)
    assert len(tickers) == len(rows)
    nvda = next(r for r in rows if r["ticker"] == "NVDA")
    assert nvda["lists"] == ["Big Tech"]  # membership attached


def test_all_symbols_membership_merges_across_lists(client):
    # Add NVDA to Streaming too — it should now report both lists, once.
    streaming = _id_for(client, "Streaming")
    client.put(f"/v1/watchlists/{streaming}/tickers/NVDA")
    rows = client.get("/v1/all-symbols").json()
    nvda_rows = [r for r in rows if r["ticker"] == "NVDA"]
    assert len(nvda_rows) == 1  # still deduplicated
    assert set(nvda_rows[0]["lists"]) == {"Big Tech", "Streaming"}


def test_chart_has_overlays(client):
    out = client.get("/v1/tickers/NVDA/chart").json()
    assert out["ticker"] == "NVDA"
    assert len(out["points"]) > 200
    assert out["points"][-1]["sma200"] is not None  # warmed up by end of series


def test_user_isolation(client):
    r = client.get("/v1/watchlists", headers={"X-User-Id": "someone-else"})
    assert r.json() == []
