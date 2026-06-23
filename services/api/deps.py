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
import os

from fastapi import Header, HTTPException
from typing import Optional

from .service import ScreenerService

DEMO_USER = "local-dev"


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
        # Seed a starter watchlist so local runs are non-empty (FR-2.4).
        watchlists = InMemoryWatchlistRepo(seed={
            DEMO_USER: {
                "Big Tech": ["AAPL", "NVDA", "GOOGL"],
                "Streaming": ["NFLX"],
            }
        })

    return ScreenerService(market, cache, watchlists)


def get_service() -> ScreenerService:
    return _build_service()


def get_user_id(x_user_id: Optional[str] = Header(default=None)) -> str:
    """Resolve the authenticated user (P8). Header mode for local dev; Phase 2
    replaces this with Cognito JWT claim extraction behind the API Gateway
    authorizer."""
    mode = os.getenv("AUTH_MODE", "header").lower()
    if mode == "jwt":
        # Placeholder: in prod the API Gateway JWT authorizer validates the token
        # and passes the verified `sub` claim through the request context.
        raise HTTPException(status_code=501, detail="JWT auth lands in Phase 2")
    return x_user_id or DEMO_USER
