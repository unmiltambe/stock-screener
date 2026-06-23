"""Technical indicators computed from a daily close series.

Pure functions over plain lists of floats — no pandas, no IO. This mirrors the
prototype's calculations (Cutler's RSI: simple moving average of gains/losses,
not Wilder smoothing) so scores match the original.
"""
from __future__ import annotations

from typing import List, Optional

from .models import TechMetrics


def sma(values: List[float], window: int) -> Optional[float]:
    """Simple moving average of the last `window` values, or None if too short."""
    if window <= 0 or len(values) < window:
        return None
    return sum(values[-window:]) / window


def rsi(closes: List[float], period: int = 14) -> Optional[float]:
    """Cutler's RSI over `period` daily deltas. None if insufficient data or no
    losses in the window (matching the prototype's guard against divide-by-zero)."""
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    window = deltas[-period:]
    avg_gain = sum(d for d in window if d > 0) / period
    avg_loss = sum(-d for d in window if d < 0) / period
    if avg_loss == 0:
        return None
    rs = avg_gain / avg_loss
    return round(100 - 100 / (1 + rs), 1)


def _pct_vs(price: Optional[float], reference: Optional[float]) -> Optional[float]:
    if price is None or reference in (None, 0):
        return None
    return round((price - reference) / reference * 100, 1)


def compute_tech_metrics(
    closes: List[float],
    price: Optional[float] = None,
    high_52w: Optional[float] = None,
    low_52w: Optional[float] = None,
) -> TechMetrics:
    """Derive RSI, SMA-50/200 distance, and 52-week range position.

    `price` defaults to the latest close when not supplied separately.
    """
    if price is None and closes:
        price = closes[-1]

    sma50 = sma(closes, 50)
    sma200 = sma(closes, 200)

    range_pos: Optional[float] = None
    if (
        price is not None
        and high_52w is not None
        and low_52w is not None
        and high_52w != low_52w
    ):
        range_pos = round((price - low_52w) / (high_52w - low_52w) * 100, 1)

    return TechMetrics(
        rsi=rsi(closes),
        sma50_pct=_pct_vs(price, sma50),
        sma200_pct=_pct_vs(price, sma200),
        range_pos=range_pos,
    )
