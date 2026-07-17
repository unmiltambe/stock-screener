"""Crossover chip computation — shared by schemas (all rows) and leaderboard (filtering).

A chip represents one active technical crossover: which indicator, direction,
and how many bars ago it fired. The frontend renders them as coloured badges.
"""
from __future__ import annotations

from typing import Dict, List

CHIPS_MAX_BARS = 5


def build_chips(row: Dict, max_bars: int = CHIPS_MAX_BARS) -> List[Dict]:
    """Return all active crossover chips for a wire-format row dict.

    Entry chips (↑) fire when a positive crossover occurred within max_bars.
    Exit chips (↓) fire on negative crossovers. Both kinds can coexist on a row.
    """
    m = row.get("metrics", {})
    chips: List[Dict] = []

    macd_pct = m.get("macdHistPct")
    macd_bars = m.get("macdBarsOnSide")
    if macd_pct is not None and macd_bars is not None and 1 <= macd_bars <= max_bars:
        if macd_pct > 0:
            chips.append({"label": "MACD↑", "bars": macd_bars})
        elif macd_pct < 0:
            chips.append({"label": "MACD↓", "bars": macd_bars})

    sma50 = m.get("sma50CrossBars")
    if sma50 is not None:
        if 1 <= sma50 <= max_bars:
            chips.append({"label": "SMA50↑", "bars": sma50})
        elif -max_bars <= sma50 <= -1:
            chips.append({"label": "SMA50↓", "bars": abs(sma50)})

    sma200 = m.get("sma200CrossBars")
    if sma200 is not None:
        if 1 <= sma200 <= max_bars:
            chips.append({"label": "SMA200↑", "bars": sma200})
        elif -max_bars <= sma200 <= -1:
            chips.append({"label": "SMA200↓", "bars": abs(sma200)})

    return chips
