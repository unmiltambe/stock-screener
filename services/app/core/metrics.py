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


def sma_series(values: List[float], window: int) -> List[Optional[float]]:
    """Rolling SMA aligned to `values`.

    Uses an expanding average for the first `window-1` points so chart lines
    start from day 1 with no leading gap. Once enough history is available the
    output is a standard N-period simple moving average."""
    out: List[Optional[float]] = []
    running = 0.0
    for i, v in enumerate(values):
        running += v
        if i >= window:
            running -= values[i - window]
        out.append(running / min(i + 1, window))
    return out


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


def ema_series(values: List[float], period: int) -> List[Optional[float]]:
    """Exponential moving average series, seeded from the first SMA of the window.

    Returns None for the first `period - 1` positions (insufficient data).
    Uses multiplier k = 2 / (period + 1), the standard for MACD charting."""
    out: List[Optional[float]] = [None] * (period - 1)
    if len(values) < period:
        return [None] * len(values)
    seed = sum(values[:period]) / period
    out.append(seed)
    k = 2 / (period + 1)
    prev = seed
    for v in values[period:]:
        prev = v * k + prev * (1 - k)
        out.append(prev)
    return out


def macd_series(
    closes: List[float],
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> tuple[List[Optional[float]], List[Optional[float]], List[Optional[float]]]:
    """MACD line, signal line, and histogram — all aligned to `closes`.

    Returns (macd_line, signal_line, histogram). Values are None during the EMA
    warm-up period (~slow + signal_period - 1 bars from the start)."""
    ema_fast = ema_series(closes, fast)
    ema_slow = ema_series(closes, slow)
    macd_line: List[Optional[float]] = [
        round(f - s, 4) if f is not None and s is not None else None
        for f, s in zip(ema_fast, ema_slow)
    ]
    # Signal line = EMA of MACD; only over the non-None portion
    non_null_start = next((i for i, v in enumerate(macd_line) if v is not None), None)
    signal_line: List[Optional[float]] = [None] * len(macd_line)
    if non_null_start is not None:
        macd_values = [v for v in macd_line[non_null_start:] if v is not None]
        signal_values = ema_series(macd_values, signal_period)
        for i, sv in enumerate(signal_values):
            signal_line[non_null_start + i] = sv
    histogram: List[Optional[float]] = [
        round(m - s, 4) if m is not None and s is not None else None
        for m, s in zip(macd_line, signal_line)
    ]
    return macd_line, signal_line, histogram


def obv_series(closes: List[float], volumes: List[float]) -> List[Optional[float]]:
    """On-Balance Volume cumulative series, aligned to `closes`.

    OBV rises when price closes up (volume adds), falls when price closes down
    (volume subtracts), unchanged on flat close. Returns None for the first
    point (no prior close to compare against)."""
    if not closes or not volumes or len(closes) != len(volumes):
        return [None] * len(closes)
    out: List[Optional[float]] = [None]
    cumulative = 0.0
    for i in range(1, len(closes)):
        if closes[i] > closes[i - 1]:
            cumulative += volumes[i]
        elif closes[i] < closes[i - 1]:
            cumulative -= volumes[i]
        out.append(round(cumulative, 0))
    return out


def _pct_vs(price: Optional[float], reference: Optional[float]) -> Optional[float]:
    if price is None or reference in (None, 0):
        return None
    return round((price - reference) / reference * 100, 1)


def rsi_3bar_slope(closes: List[float], period: int = 14) -> Optional[float]:
    """RSI change over the last 3 bars. Positive = rising momentum."""
    if len(closes) < period + 4:
        return None
    r_now = rsi(closes)
    r_prev = rsi(closes[:-3])
    if r_now is None or r_prev is None:
        return None
    return round(r_now - r_prev, 1)


def macd_scalars(
    closes: List[float],
    price: Optional[float] = None,
) -> tuple[Optional[float], Optional[bool], Optional[int]]:
    """Derive setup-score inputs from the MACD histogram series.

    Returns (hist_pct, hist_rising_3bar, bars_on_side):
      hist_pct        — last histogram value as % of price (sign = direction)
      hist_rising_3bar — True if histogram rose for 3 consecutive bars
      bars_on_side    — how many bars histogram has been on its current side of
                        zero; None if > 10 (signal too stale to be actionable)
    """
    _, _, histogram = macd_series(closes)
    hist_vals = [v for v in histogram if v is not None]
    if len(hist_vals) < 4:
        return None, None, None

    if price is None and closes:
        price = closes[-1]

    last = hist_vals[-1]
    hist_pct = round(last / price * 100, 3) if price else None
    hist_rising = hist_vals[-1] > hist_vals[-2] and hist_vals[-2] > hist_vals[-3]

    # Count bars the histogram has been on the same side of zero as today.
    current_sign = 1 if last > 0 else -1 if last < 0 else 0
    bars_on_side: Optional[int] = 1
    for v in reversed(hist_vals[:-1]):
        sign = 1 if v > 0 else -1 if v < 0 else 0
        if sign == current_sign or sign == 0:
            assert bars_on_side is not None
            bars_on_side += 1
        else:
            break
        if bars_on_side > 10:
            bars_on_side = None
            break

    return hist_pct, hist_rising, bars_on_side


def obv_trend_pct(
    closes: List[float],
    volumes: List[float],
    lookback: int = 20,
) -> Optional[float]:
    """20-bar OBV % change. Positive = accumulation, negative = distribution.

    Returns None if there is insufficient history or the base OBV is near zero
    (new listing or very low float — % change would be misleading)."""
    series = obv_series(closes, volumes)
    vals = [v for v in series if v is not None]
    if len(vals) < lookback + 1:
        return None
    base = vals[-(lookback + 1)]
    current = vals[-1]
    if abs(base) < 1:
        return None
    return round((current - base) / abs(base) * 100, 1)


def compute_tech_metrics(
    closes: List[float],
    price: Optional[float] = None,
    high_52w: Optional[float] = None,
    low_52w: Optional[float] = None,
    volumes: Optional[List[float]] = None,
) -> TechMetrics:
    """Derive RSI, SMA-50/200 distance, 52-week range position, and setup inputs.

    `price` defaults to the latest close when not supplied separately.
    `volumes` is optional — setup inputs that depend on OBV are None when omitted.
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

    hist_pct, hist_rising, bars_on_side = macd_scalars(closes, price)
    obv_pct = obv_trend_pct(closes, volumes) if volumes else None

    return TechMetrics(
        rsi=rsi(closes),
        sma50_pct=_pct_vs(price, sma50),
        sma200_pct=_pct_vs(price, sma200),
        range_pos=range_pos,
        rsi_slope=rsi_3bar_slope(closes),
        macd_hist_pct=hist_pct,
        macd_hist_rising=hist_rising,
        macd_bars_on_side=bars_on_side,
        obv_trend_pct=obv_pct,
    )
