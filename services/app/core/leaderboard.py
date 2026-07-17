"""Leaderboard filter functions — pure, operates on pre-scored wire dicts.

Each function takes the list of scored rows returned by service.scored_rows and
returns a filtered/sorted subset. Entry/exit functions annotate each row with a
`chips` list so the frontend can render event labels ("MACD↑ 3d") without
duplicating the filter logic.

Design: inputs and outputs are plain dicts (same shape as the API wire format)
so these functions are independently testable and reusable for any ticker set —
watchlist today, full universe tomorrow.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple


def _entry_chips(row: Dict, max_bars: int) -> List[Dict]:
    m = row.get("metrics", {})
    chips = []

    macd_pct = m.get("macdHistPct")
    macd_bars = m.get("macdBarsOnSide")
    if macd_pct is not None and macd_pct > 0 and macd_bars is not None and 1 <= macd_bars <= max_bars:
        chips.append({"label": "MACD↑", "bars": macd_bars})

    sma50 = m.get("sma50CrossBars")
    if sma50 is not None and 1 <= sma50 <= max_bars:
        chips.append({"label": "SMA50↑", "bars": sma50})

    sma200 = m.get("sma200CrossBars")
    if sma200 is not None and 1 <= sma200 <= max_bars:
        chips.append({"label": "SMA200↑", "bars": sma200})

    return chips


def _exit_chips(row: Dict, max_bars: int) -> List[Dict]:
    m = row.get("metrics", {})
    chips = []

    macd_pct = m.get("macdHistPct")
    macd_bars = m.get("macdBarsOnSide")
    if macd_pct is not None and macd_pct < 0 and macd_bars is not None and 1 <= macd_bars <= max_bars:
        chips.append({"label": "MACD↓", "bars": macd_bars})

    sma50 = m.get("sma50CrossBars")
    if sma50 is not None and -max_bars <= sma50 <= -1:
        chips.append({"label": "SMA50↓", "bars": abs(sma50)})

    sma200 = m.get("sma200CrossBars")
    if sma200 is not None and -max_bars <= sma200 <= -1:
        chips.append({"label": "SMA200↓", "bars": abs(sma200)})

    return chips


_ENTRY_LABEL_ORDER = {"MACD↑": 0, "SMA50↑": 1, "SMA200↑": 2}
_EXIT_LABEL_ORDER = {"MACD↓": 0, "SMA50↓": 1, "SMA200↓": 2}


def entry_signals(
    rows: List[Dict],
    fund_threshold: float = 50.0,
    max_bars: int = 10,
) -> List[Dict]:
    """Stocks where a positive crossover fired within max_bars and fund ≥ fund_threshold.

    Each returned row gains a `chips` key: a list of {label, bars} dicts, one per
    active signal. Sorted MACD first, then SMA50, SMA200; within each group by
    setup score descending.
    """
    result = []
    for row in rows:
        fund = (row.get("scores") or {}).get("fund")
        if fund is None or fund < fund_threshold:
            continue
        chips = _entry_chips(row, max_bars)
        if not chips:
            continue
        result.append({**row, "chips": chips})

    result.sort(key=lambda r: (
        _ENTRY_LABEL_ORDER.get(r["chips"][0]["label"], 99),
        -((r.get("scores") or {}).get("setup") or 0),
    ))
    return result


def exit_warnings(
    rows: List[Dict],
    fund_threshold: float = 50.0,
    max_bars: int = 10,
) -> List[Dict]:
    """Stocks where a negative crossover fired within max_bars and fund ≥ fund_threshold.

    Quality floor keeps speculative names out of the warning list — you care
    about warnings for stocks with real fundamental backing. Within each signal
    group, sorted by combined score ascending (worst first, so urgent names rise).
    """
    result = []
    for row in rows:
        fund = (row.get("scores") or {}).get("fund")
        if fund is None or fund < fund_threshold:
            continue
        chips = _exit_chips(row, max_bars)
        if not chips:
            continue
        result.append({**row, "chips": chips})

    result.sort(key=lambda r: (
        _EXIT_LABEL_ORDER.get(r["chips"][0]["label"], 99),
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
