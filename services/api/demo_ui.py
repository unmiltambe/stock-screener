"""Interim server-rendered demo UI.

⚠️ Temporary stepping stone (ADR-0005). The target frontend is a React SPA that
consumes the pure `/v1` JSON API (P1). This module renders HTML on the server so a
rudimentary site can be hosted *now*, before the SPA exists. It is an isolated
sidecar mounted at `/ui` — deletable in one step when the SPA lands, and it does
not touch the JSON API. Read-only: it views scores; editing is via the API.
"""
from __future__ import annotations

import html
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, RedirectResponse

from .deps import DEMO_USER, get_service
from .service import ScreenerService

router = APIRouter()

_STYLE = """
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1420;
       color:#e6e6e6;margin:0;padding:24px;max-width:1100px}
  a{color:#6ab0f5;text-decoration:none} a:hover{text-decoration:underline}
  h1{font-size:1.3rem;margin:0 0 4px} .sub{color:#8a93a6;font-size:.85rem;margin-bottom:18px}
  table{border-collapse:collapse;width:100%;font-size:.9rem}
  th,td{padding:6px 10px;text-align:right;border-bottom:1px solid #222b3a}
  th{color:#8a93a6;font-weight:600;text-align:right} th:first-child,td:first-child,
  th:nth-child(2),td:nth-child(2){text-align:left}
  tr:hover{background:#161d2b} .pill{padding:1px 7px;border-radius:4px;font-weight:700}
  .muted{color:#5b6478} .card{display:inline-block;margin:4px 10px 4px 0;padding:10px 14px;
       background:#161d2b;border:1px solid #222b3a;border-radius:8px}
</style>
"""


def _g(v: Optional[float], good: float = 60, ok: float = 40) -> str:
    if v is None:
        return '<span class="muted">—</span>'
    color = "#2ecc71" if v >= good else "#f39c12" if v >= ok else "#e74c3c"
    return f'<span style="color:{color};font-weight:700">{v:.0f}</span>'


def _signal(s: Optional[str]) -> str:
    if not s:
        return '<span class="muted">—</span>'
    color = {"Buy": "#2ecc71", "Trim": "#e74c3c"}.get(s, "#f39c12")
    return f'<span class="pill" style="background:{color}22;color:{color}">{html.escape(s)}</span>'


def _page(title: str, body: str) -> str:
    return f"<!doctype html><html><head><meta charset=utf-8><title>{html.escape(title)}" \
           f"</title>{_STYLE}</head><body>{body}</body></html>"


@router.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/ui")


@router.get("/ui", response_class=HTMLResponse)
def index(svc: ScreenerService = Depends(get_service)):
    lists = svc.list_watchlists(DEMO_USER)
    cards = "".join(
        f'<a class="card" href="/ui/w/{html.escape(w["id"])}">'
        f'<b>{html.escape(w["name"])}</b><br><span class="muted">{w["count"]} tickers</span></a>'
        for w in lists
    ) or '<p class="muted">No watchlists yet.</p>'
    body = (f"<h1>Bellwether — watchlists</h1>"
            f'<div class="sub">Live scores · read-only demo</div>{cards}')
    return _page("Watchlists", body)


@router.get("/ui/w/{watchlist_id}", response_class=HTMLResponse)
def watchlist(watchlist_id: str, svc: ScreenerService = Depends(get_service)):
    rows = svc.get_watchlist(DEMO_USER, watchlist_id)
    if rows is None:
        return HTMLResponse(_page("Not found",
                            '<p>Watchlist not found. <a href="/ui">Back</a></p>'),
                            status_code=404)
    head = ("<tr><th>Ticker</th><th>Company</th><th>Price</th><th>Fund</th>"
            "<th>Tech</th><th>Combined</th><th>Signal</th><th>PEG</th><th>RSI</th></tr>")
    trs = []
    for r in rows:
        m, s = r["metrics"], r["scores"]
        price = f'${r["price"]:.2f}' if r.get("price") else '<span class="muted">—</span>'
        peg = f'{m["peg"]:.2f}' if m.get("peg") is not None else '<span class="muted">—</span>'
        rsi = f'{m["rsi"]:.0f}' if m.get("rsi") is not None else '<span class="muted">—</span>'
        trs.append(
            f'<tr><td><b>{html.escape(r["ticker"])}</b></td>'
            f'<td>{html.escape((r.get("name") or "")[:28])}</td>'
            f'<td>{price}</td><td>{_g(s["fund"])}</td><td>{_g(s["tech"])}</td>'
            f'<td>{_g(s["combined"])}</td><td>{_signal(r.get("signal"))}</td>'
            f'<td>{peg}</td><td>{rsi}</td></tr>'
        )
    body = (f'<a href="/ui">← watchlists</a><h1>Scores</h1>'
            f'<div class="sub">{len(rows)} tickers · live data · cached 15 min</div>'
            f"<table>{head}{''.join(trs)}</table>")
    return _page("Scores", body)
