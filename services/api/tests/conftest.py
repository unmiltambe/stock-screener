"""Shared test setup for the API tests.

Pins the seed watchlists to a small, fixed fixture (seed_test.json) so the tests
stay decoupled from the realistic production seed (api/seed_watchlists.json) —
changing the demo data never breaks the suite.
"""
from __future__ import annotations

import pathlib

import pytest

from api.deps import _build_service

_SEED = pathlib.Path(__file__).parent / "seed_test.json"


@pytest.fixture(autouse=True)
def _fixed_seed(monkeypatch):
    monkeypatch.setenv("SEED_FILE", str(_SEED))
    _build_service.cache_clear()
    yield
    _build_service.cache_clear()
