"""FastAPI application — the request path (docs/design.md §3).

Thin HTTP layer: validate, resolve the user, delegate to ScreenerService, return
pure data. No scoring and no IO live here. Data routes are versioned under /v1
(ADR-0004); /health is unversioned.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import schemas
from .deps import get_service, get_user_id
from .service import ScreenerService


def create_app() -> FastAPI:
    app = FastAPI(title="stock-screener API", version="0.1.0")

    # CORS so the SPA (different origin in dev) can call the API.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tightened to the CloudFront origin in prod (Phase 2/3)
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Interim Basic Auth gate (ADR-0005) — protects the whole app except /health.
    # No-op locally unless BASIC_AUTH_PASS is set; required on the hosted deploy.
    from .auth import basic_auth_guard

    @app.middleware("http")
    async def _basic_auth(request, call_next):
        denied = basic_auth_guard(request)
        return denied if denied is not None else await call_next(request)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    v1 = APIRouter(prefix="/v1")

    # ── watchlists (keyed by stable id — ADR-0004) ────────────────────────────

    @v1.get("/watchlists", response_model=List[schemas.WatchlistSummary])
    def list_watchlists(svc: ScreenerService = Depends(get_service),
                        user_id: str = Depends(get_user_id)):
        return svc.list_watchlists(user_id)

    @v1.post("/watchlists", status_code=201, response_model=schemas.WatchlistOut)
    def create_watchlist(body: schemas.WatchlistNameIn,
                        svc: ScreenerService = Depends(get_service),
                        user_id: str = Depends(get_user_id)):
        return svc.create_watchlist(user_id, body.name)

    @v1.get("/watchlists/{watchlist_id}", response_model=List[schemas.TickerRow])
    def get_watchlist(watchlist_id: str,
                    svc: ScreenerService = Depends(get_service),
                    user_id: str = Depends(get_user_id)):
        rows = svc.get_watchlist(user_id, watchlist_id)
        if rows is None:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        return rows

    @v1.patch("/watchlists/{watchlist_id}", response_model=schemas.WatchlistOut)
    def rename_watchlist(watchlist_id: str, body: schemas.WatchlistNameIn,
                        svc: ScreenerService = Depends(get_service),
                        user_id: str = Depends(get_user_id)):
        if not svc.rename_watchlist(user_id, watchlist_id, body.name):
            raise HTTPException(status_code=404, detail="Watchlist not found")
        return {"id": watchlist_id, "name": body.name}

    @v1.delete("/watchlists/{watchlist_id}", status_code=204)
    def delete_watchlist(watchlist_id: str,
                        svc: ScreenerService = Depends(get_service),
                        user_id: str = Depends(get_user_id)):
        svc.delete_watchlist(user_id, watchlist_id)  # idempotent

    @v1.put("/watchlists/{watchlist_id}/tickers/{symbol}", status_code=204)
    def add_ticker(watchlist_id: str, symbol: str,
                svc: ScreenerService = Depends(get_service),
                user_id: str = Depends(get_user_id)):
        if not svc.add_ticker(user_id, watchlist_id, symbol):
            raise HTTPException(status_code=404, detail="Watchlist not found")

    @v1.delete("/watchlists/{watchlist_id}/tickers/{symbol}", status_code=204)
    def remove_ticker(watchlist_id: str, symbol: str,
                    svc: ScreenerService = Depends(get_service),
                    user_id: str = Depends(get_user_id)):
        if not svc.remove_ticker(user_id, watchlist_id, symbol):
            raise HTTPException(status_code=404, detail="Watchlist not found")

    # ── leaderboard, scores, chart ────────────────────────────────────────────

    @v1.get("/leaderboard")
    def leaderboard(svc: ScreenerService = Depends(get_service),
                    user_id: str = Depends(get_user_id)):
        return svc.leaderboard(user_id)

    @v1.get("/scores", response_model=List[schemas.TickerRow])
    def scores(tickers: str = Query(..., description="comma-separated symbols"),
            svc: ScreenerService = Depends(get_service),
            user_id: str = Depends(get_user_id)):
        symbols = [t.strip() for t in tickers.split(",") if t.strip()]
        if not symbols:
            raise HTTPException(status_code=400, detail="No tickers provided")
        return svc.scored_rows(symbols)

    @v1.get("/tickers/{symbol}/chart", response_model=schemas.ChartOut)
    def chart(symbol: str, years: int = Query(default=1, ge=1, le=10),
            svc: ScreenerService = Depends(get_service),
            user_id: str = Depends(get_user_id)):
        result = svc.chart(symbol, years)
        if result is None:
            raise HTTPException(status_code=404, detail=f"No chart data for {symbol}")
        return result

    app.include_router(v1)

    # Interim server-rendered demo UI (ADR-0005) — temporary sidecar at /ui, does
    # not touch the /v1 JSON API. Removed when the React SPA lands.
    from .demo_ui import router as demo_router
    app.include_router(demo_router)

    return app


app = create_app()
