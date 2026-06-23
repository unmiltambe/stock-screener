"""Interim server-rendered demo UI.

⚠️ Temporary stepping stone (ADR-0005). The target frontend is a React SPA that
consumes the pure `/v1` JSON API (P1). This module renders HTML on the server so a
rudimentary site can be hosted *now*, before the SPA exists. It is an isolated
sidecar mounted at `/ui` — deletable in one step when the SPA lands, and it does
not touch the JSON API.

Edits go through plain HTML forms (POST → action → 303 redirect back). With the
in-memory store they are **not durable** across restarts — see ADR-0005 / the
banner in the UI. No CSRF tokens: acceptable for a single-user Basic-Auth demo.
"""
from __future__ import annotations

import html
from typing import Optional

from fastapi import APIRouter, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from .deps import DEMO_USER, get_service
from .service import ScreenerService

router = APIRouter()

_STYLE = """
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1420;
       color:#e6e6e6;margin:0;padding:24px;max-width:1100px}
  a{color:#6ab0f5;text-decoration:none} a:hover{text-decoration:underline}
  h1{font-size:1.3rem;margin:0 0 4px} .sub{color:#8a93a6;font-size:.85rem;margin-bottom:14px}
  table{border-collapse:collapse;width:100%;font-size:.9rem}
  th,td{padding:6px 10px;text-align:right;border-bottom:1px solid #222b3a}
  th{color:#8a93a6;font-weight:600} th:first-child,td:first-child,
  th:nth-child(2),td:nth-child(2){text-align:left}
  tr:hover{background:#161d2b} .pill{padding:1px 7px;border-radius:4px;font-weight:700}
  .muted{color:#5b6478}
  .card{display:inline-block;margin:4px 10px 4px 0;padding:10px 14px;background:#161d2b;
        border:1px solid #222b3a;border-radius:8px;vertical-align:top}
  input{background:#0f1420;border:1px solid #2a3445;color:#e6e6e6;border-radius:6px;
        padding:6px 9px;font-size:.9rem}
  button{background:#1e2a44;border:1px solid #2f3f5e;color:#cfe0ff;border-radius:6px;
        padding:6px 11px;font-size:.9rem;cursor:pointer}
  button:hover{background:#274066}
  button.danger{background:#3a1d22;border-color:#5e2f37;color:#ffb3bd}
  button.x{padding:1px 7px;background:transparent;border:none;color:#e57385;font-size:1rem}
  form.inline{display:inline}
  .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 18px}
  .banner{background:#2a2410;border:1px solid #5a4d18;color:#d9c98a;padding:8px 12px;
        border-radius:8px;font-size:.82rem;margin-bottom:16px}
</style>
"""

_BANNER = ('<div class="banner">⚠️ Demo: edits are in-memory and reset when the '
           'server restarts or wakes from idle. Persistence is a follow-up.</div>')


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


def _redirect(path: str) -> RedirectResponse:
    # 303 → browser issues a GET on the target (POST-redirect-GET).
    return RedirectResponse(url=path, status_code=303)


# ── pages ─────────────────────────────────────────────────────────────────────

@router.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/ui")


@router.get("/ui", response_class=HTMLResponse)
def index(svc: ScreenerService = Depends(get_service)):
    lists = svc.list_watchlists(DEMO_USER)
    cards = ""
    for w in lists:
        wid = html.escape(w["id"])
        cards += (
            f'<div class="card"><a href="/ui/w/{wid}"><b>{html.escape(w["name"])}</b></a>'
            f'<br><span class="muted">{w["count"]} tickers</span><br>'
            f'<form class="inline" method="post" action="/ui/w/{wid}/delete" '
            f'onsubmit="return confirm(\'Delete this watchlist?\')">'
            f'<button class="danger" style="margin-top:8px">Delete</button></form></div>'
        )
    if not cards:
        cards = '<p class="muted">No watchlists yet — create one below.</p>'
    new_form = (
        '<form class="bar" method="post" action="/ui/create">'
        '<input name="name" placeholder="New watchlist name" required>'
        '<button>Create watchlist</button></form>'
    )
    body = (f"<h1>Bellwether — watchlists</h1>"
            f'<div class="sub">Live scores · click a list to view</div>'
            f"{_BANNER}{new_form}{cards}")
    return _page("Watchlists", body)


@router.get("/ui/w/{watchlist_id}", response_class=HTMLResponse)
def watchlist(watchlist_id: str, svc: ScreenerService = Depends(get_service)):
    meta = next((w for w in svc.list_watchlists(DEMO_USER) if w["id"] == watchlist_id), None)
    rows = svc.get_watchlist(DEMO_USER, watchlist_id)
    if meta is None or rows is None:
        return HTMLResponse(_page("Not found",
                            '<p>Watchlist not found. <a href="/ui">Back</a></p>'),
                            status_code=404)
    wid = html.escape(watchlist_id)
    name = html.escape(meta["name"])

    controls = (
        f'<div class="bar">'
        f'<form class="inline" method="post" action="/ui/w/{wid}/rename">'
        f'<input name="name" value="{name}" required><button>Rename</button></form>'
        f'<form class="inline" method="post" action="/ui/w/{wid}/add">'
        f'<input name="symbol" placeholder="Ticker symbol" required>'
        f'<button>Add ticker</button></form>'
        f'<form class="inline" method="post" action="/ui/w/{wid}/delete" '
        f'onsubmit="return confirm(\'Delete this watchlist?\')">'
        f'<button class="danger">Delete list</button></form></div>'
    )

    head = ("<tr><th>Ticker</th><th>Company</th><th>Price</th><th>Fund</th><th>Tech</th>"
            "<th>Combined</th><th>Signal</th><th>PEG</th><th>RSI</th><th></th></tr>")
    trs = []
    for r in rows:
        m, s = r["metrics"], r["scores"]
        sym = html.escape(r["ticker"])
        price = f'${r["price"]:.2f}' if r.get("price") else '<span class="muted">—</span>'
        peg = f'{m["peg"]:.2f}' if m.get("peg") is not None else '<span class="muted">—</span>'
        rsi = f'{m["rsi"]:.0f}' if m.get("rsi") is not None else '<span class="muted">—</span>'
        remove = (f'<form class="inline" method="post" action="/ui/w/{wid}/remove">'
                  f'<input type="hidden" name="symbol" value="{sym}">'
                  f'<button class="x" title="Remove">✕</button></form>')
        trs.append(
            f'<tr><td><b>{sym}</b></td>'
            f'<td>{html.escape((r.get("name") or "")[:28])}</td>'
            f'<td>{price}</td><td>{_g(s["fund"])}</td><td>{_g(s["tech"])}</td>'
            f'<td>{_g(s["combined"])}</td><td>{_signal(r.get("signal"))}</td>'
            f'<td>{peg}</td><td>{rsi}</td><td>{remove}</td></tr>'
        )
    table = (f"<table>{head}{''.join(trs)}</table>" if rows
             else '<p class="muted">No tickers yet — add one above.</p>')
    body = (f'<a href="/ui">← watchlists</a><h1>{name}</h1>'
            f'<div class="sub">{len(rows)} tickers · live data · cached 15 min</div>'
            f"{_BANNER}{controls}{table}")
    return _page(name, body)


# ── actions (POST → 303 redirect) ─────────────────────────────────────────────

@router.post("/ui/create")
def create(name: str = Form(...), svc: ScreenerService = Depends(get_service)):
    name = name.strip()
    if not name:
        return _redirect("/ui")
    wl = svc.create_watchlist(DEMO_USER, name)
    return _redirect(f"/ui/w/{wl['id']}")


@router.post("/ui/w/{watchlist_id}/rename")
def rename(watchlist_id: str, name: str = Form(...),
        svc: ScreenerService = Depends(get_service)):
    name = name.strip()
    if name:
        svc.rename_watchlist(DEMO_USER, watchlist_id, name)
    return _redirect(f"/ui/w/{watchlist_id}")


@router.post("/ui/w/{watchlist_id}/delete")
def delete(watchlist_id: str, svc: ScreenerService = Depends(get_service)):
    svc.delete_watchlist(DEMO_USER, watchlist_id)
    return _redirect("/ui")


@router.post("/ui/w/{watchlist_id}/add")
def add(watchlist_id: str, symbol: str = Form(...),
        svc: ScreenerService = Depends(get_service)):
    symbol = symbol.strip()
    if symbol:
        svc.add_ticker(DEMO_USER, watchlist_id, symbol)
    return _redirect(f"/ui/w/{watchlist_id}")


@router.post("/ui/w/{watchlist_id}/remove")
def remove(watchlist_id: str, symbol: str = Form(...),
        svc: ScreenerService = Depends(get_service)):
    if symbol.strip():
        svc.remove_ticker(DEMO_USER, watchlist_id, symbol.strip())
    return _redirect(f"/ui/w/{watchlist_id}")
