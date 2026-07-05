"""GET /v1/symbols/search (ADR-0011) — with the universe dependency overridden so
the test never touches the network."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.app import create_app
from api.deps import _build_service, get_universe
from core.models import SymbolInfo

FAKE = [
    SymbolInfo("AAPL", "Apple Inc.", "NASDAQ", "US"),
    SymbolInfo("APP", "AppLovin Corporation", "NASDAQ", "US"),
    SymbolInfo("SPY", "SPDR S&P 500 ETF Trust", "NYSE Arca", "US"),
]


@pytest.fixture()
def client():
    _build_service.cache_clear()
    app = create_app()
    app.dependency_overrides[get_universe] = lambda: FAKE
    return TestClient(app)


def test_search_returns_ranked_matches(client):
    r = client.get("/v1/symbols/search", params={"q": "app"})
    assert r.status_code == 200
    data = r.json()
    assert data[0]["symbol"] == "APP"                       # exact first
    assert {"symbol", "name", "exchange", "market"} <= set(data[0])


def test_search_requires_q(client):
    assert client.get("/v1/symbols/search").status_code == 422           # q missing
    assert client.get("/v1/symbols/search", params={"q": ""}).status_code == 422  # min_length=1


def test_search_no_match_is_empty(client):
    r = client.get("/v1/symbols/search", params={"q": "ZZZZZ"})
    assert r.status_code == 200 and r.json() == []
