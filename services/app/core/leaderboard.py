"""Leaderboard filter/sort functions — pure, operates on pre-scored wire dicts.

Rows arrive with a `chips` field already populated by `row_from_scored` (via
`core.chips.build_chips`). These functions filter and sort; they do not build chips.

Design: inputs and outputs are plain dicts (same shape as the API wire format)
so these functions are independently testable and reusable for any ticker set —
watchlist today, full universe tomorrow.
"""
from __future__ import annotations

from typing import Dict, List, Tuple

_ENTRY_LABEL_ORDER = {"MACD↑": 0, "SMA50↑": 1, "SMA200↑": 2}
_EXIT_LABEL_ORDER  = {"MACD↓": 0, "SMA50↓": 1, "SMA200↓": 2}


def _entry_chips(row: Dict) -> List[Dict]:
    return [c for c in row.get("chips", []) if "↑" in c["label"]]


def _exit_chips(row: Dict) -> List[Dict]:
    return [c for c in row.get("chips", []) if "↓" in c["label"]]


def entry_signals(
    rows: List[Dict],
    fund_threshold: float = 50.0,
) -> List[Dict]:
    """Rows with at least one entry chip and fund ≥ fund_threshold.

    Sorted MACD↑ first, then SMA50↑, SMA200↑; within each group by setup score desc.
    """
    result = []
    for row in rows:
        fund = (row.get("scores") or {}).get("fund")
        if fund is None or fund < fund_threshold:
            continue
        chips = _entry_chips(row)
        if not chips:
            continue
        result.append(row)

    result.sort(key=lambda r: (
        _ENTRY_LABEL_ORDER.get(_entry_chips(r)[0]["label"], 99),
        -((r.get("scores") or {}).get("setup") or 0),
    ))
    return result


def exit_warnings(
    rows: List[Dict],
    fund_threshold: float = 50.0,
) -> List[Dict]:
    """Rows with at least one exit chip and fund ≥ fund_threshold.

    Quality floor keeps speculative names out. Sorted by combined score asc (worst first).
    """
    result = []
    for row in rows:
        fund = (row.get("scores") or {}).get("fund")
        if fund is None or fund < fund_threshold:
            continue
        chips = _exit_chips(row)
        if not chips:
            continue
        result.append(row)

    result.sort(key=lambda r: (
        _EXIT_LABEL_ORDER.get(_exit_chips(r)[0]["label"], 99),
        (r.get("scores") or {}).get("combined") or 100,
    ))
    return result


def best_positioned(rows: List[Dict], top_n: int = 10) -> List[Dict]:
    """Top N by combined score — the stable 'what to hold or research' view."""
    scored = [r for r in rows if (r.get("scores") or {}).get("combined") is not None]
    return sorted(scored, key=lambda r: r["scores"]["combined"], reverse=True)[:top_n]


def top_movers(
    rows: List[Dict],
    top_n: int = 10,
    min_move_pct: float = 0.5,
) -> Tuple[List[Dict], List[Dict]]:
    """Returns (gainers, decliners) — top N each by absolute day change %.

    Moves smaller than min_move_pct are filtered as noise.
    """
    with_change = [r for r in rows if r.get("dayChangePct") is not None]
    gainers = sorted(
        [r for r in with_change if r["dayChangePct"] >= min_move_pct],
        key=lambda r: r["dayChangePct"],
        reverse=True,
    )[:top_n]
    decliners = sorted(
        [r for r in with_change if r["dayChangePct"] <= -min_move_pct],
        key=lambda r: r["dayChangePct"],
    )[:top_n]
    return gainers, decliners
