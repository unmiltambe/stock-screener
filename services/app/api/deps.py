"""Wiring & request dependencies.

Selects adapter implementations from environment variables so the same app runs
in-memory locally or cloud-backed in Lambda — without code changes.

  DATA_BACKEND   = memory | yfinance     (market data; default: memory)
  STORE_BACKEND  = memory | dynamo       (watchlists + score cache; default: memory)
  DDB_TABLE      = <table name>          (when STORE_BACKEND=dynamo)
  AUTH_MODE      = header | jwt          (default: header — local dev)

Auth note (P8): the request's user_id always comes from a trusted source decided
here — never from a path or body. In local `header` mode it's the `X-User-Id`
header (defaulting to a demo user); Phase 2 swaps in real Cognito JWT claims.
"""
from __future__ import annotations

import functools
import json
import os
import pathlib
import uuid

from fastapi import Header, HTTPException
from typing import Dict, List, Optional

from .service import ScreenerService

DEMO_USER = "local-dev"

# Realistic demo watchlists live in data, not code, so they're easy to maintain
# and replicate. Override with SEED_FILE (tests point at a small fixture).
_DEFAULT_SEED_FILE = pathlib.Path(__file__).parent / "seed_watchlists.json"


def _load_seed() -> Dict[str, Dict[str, List[str]]]:
    path = os.getenv("SEED_FILE", str(_DEFAULT_SEED_FILE))
    try:
        with open(path) as f:
            return {DEMO_USER: json.load(f)}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


@functools.lru_cache(maxsize=1)
def _build_service() -> ScreenerService:
    data_backend = os.getenv("DATA_BACKEND", "memory").lower()
    store_backend = os.getenv("STORE_BACKEND", "memory").lower()

    # ── market data ──
    if data_backend == "yfinance":
        from adapters.yfinance_market import YFinanceMarketData
        market = YFinanceMarketData()
    else:
        from adapters.memory import FixtureMarketData
        market = FixtureMarketData()

    # ── store (cache + repos) ──
    if store_backend == "dynamo":
        from adapters.dynamo import DynamoCache, DynamoWatchlistRepo
        table = os.environ["DDB_TABLE"]
        cache = DynamoCache(table)
        watchlists = DynamoWatchlistRepo(table)
    else:
        from adapters.memory import InMemoryCache, InMemoryWatchlistRepo
        cache = InMemoryCache()
        # Seed from the watchlists JSON so local/demo runs are non-empty (FR-2.4).
        watchlists = InMemoryWatchlistRepo(seed=_load_seed())

    return ScreenerService(market, cache, watchlists)


def get_service() -> ScreenerService:
    return _build_service()


def _guest_id(x_guest_id: Optional[str]) -> Optional[str]:
    """Namespace a client-supplied guest id (ADR-0009). Validates it parses as a
    UUID so the header can't inject an arbitrary identity; returns None for a
    missing/malformed value so callers can fall through."""
    if not x_guest_id:
        return None
    try:
        uuid.UUID(x_guest_id)
    except ValueError:
        return None
    return f"GUEST#{x_guest_id}"


def get_user_id(
    x_user_id: Optional[str] = Header(default=None),
    x_guest_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> str:
    """Resolve the user from a trusted source (P8) — never a path or body.

    - `jwt` (deployed): a validated Cognito Bearer token (ADR-0008) → verified
      `sub`; failing that, a client-supplied `X-Guest-Id` → `GUEST#<uuid>`
      (ADR-0009, try-before-login); otherwise 401.
    - `header` (local/tests): `X-User-Id`, defaulting to the demo user. Guest ids
      are intentionally ignored here so local/offline runs keep their seeded demo
      data and existing tests are unaffected.
    """
    mode = os.getenv("AUTH_MODE", "header").lower()
    if mode == "jwt":
        if authorization and authorization.lower().startswith("bearer "):
            from .auth import verify_cognito_jwt  # lazy: PyJWT only needed in jwt mode
            try:
                claims = verify_cognito_jwt(authorization.split(" ", 1)[1].strip())
            except Exception:
                raise HTTPException(
                    status_code=401, detail="Invalid token",
                    headers={"WWW-Authenticate": "Bearer"})
            return claims["sub"]
        guest = _guest_id(x_guest_id)
        if guest:
            return guest
        raise HTTPException(
            status_code=401, detail="Missing bearer token or guest id",
            headers={"WWW-Authenticate": "Bearer"})
    return x_user_id or DEMO_USER
