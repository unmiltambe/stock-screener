from __future__ import annotations

import pytest

from core import metrics


def test_sma_basic():
    assert metrics.sma([1, 2, 3, 4, 5], 5) == 3.0
    assert metrics.sma([1, 2, 3, 4, 5], 2) == 4.5


def test_sma_too_short_returns_none():
    assert metrics.sma([1, 2], 5) is None


def test_rsi_all_gains_has_no_losses_returns_none():
    # Strictly increasing → avg_loss == 0 → guarded to None (prototype behaviour).
    assert metrics.rsi(list(range(1, 30))) is None


def test_rsi_in_range_for_mixed_series():
    closes = []
    price = 100.0
    # deterministic zig-zag so there are both gains and losses
    for i in range(40):
        price += 1.0 if i % 2 == 0 else -0.5
        closes.append(price)
    value = metrics.rsi(closes)
    assert value is not None
    assert 0 <= value <= 100


def test_compute_tech_metrics_range_position():
    closes = [10.0] * 200 + [15.0]
    m = metrics.compute_tech_metrics(closes, price=15.0, high_52w=20.0, low_52w=10.0)
    # price 15 within [10, 20] → 50% of range
    assert m.range_pos == pytest.approx(50.0, abs=0.1)


def test_compute_tech_metrics_handles_missing_range_bounds():
    closes = [10.0] * 60
    m = metrics.compute_tech_metrics(closes, price=10.0, high_52w=None, low_52w=None)
    assert m.range_pos is None
    # SMA-50 available (>=50 points), SMA-200 not (<200 points)
    assert m.sma50_pct is not None
    assert m.sma200_pct is None


def test_price_defaults_to_last_close():
    closes = [float(i) for i in range(1, 61)]
    m = metrics.compute_tech_metrics(closes)
    assert m.sma50_pct is not None


# ── EMA ───────────────────────────────────────────────────────────────────────

def test_ema_series_length_matches_input():
    closes = [float(i) for i in range(1, 31)]
    result = metrics.ema_series(closes, 12)
    assert len(result) == len(closes)


def test_ema_series_none_before_warmup():
    closes = [float(i) for i in range(1, 31)]
    result = metrics.ema_series(closes, 12)
    # first 11 positions are None (period-1)
    assert all(v is None for v in result[:11])
    assert result[11] is not None


def test_ema_series_too_short_returns_all_none():
    result = metrics.ema_series([1.0, 2.0], 12)
    assert all(v is None for v in result)


def test_ema_seed_equals_first_sma():
    closes = [10.0] * 12 + [20.0]
    result = metrics.ema_series(closes, 12)
    # seed at index 11 = SMA of first 12 values = 10.0
    assert result[11] == pytest.approx(10.0, abs=0.01)


# ── MACD ──────────────────────────────────────────────────────────────────────

def _zigzag(n: int, base: float = 100.0) -> list:
    closes = []
    price = base
    for i in range(n):
        price += 1.5 if i % 2 == 0 else -0.8
        closes.append(price)
    return closes


def test_macd_series_output_lengths_match_input():
    closes = _zigzag(100)
    macd, signal, hist = metrics.macd_series(closes)
    assert len(macd) == len(signal) == len(hist) == len(closes)


def test_macd_series_null_during_warmup():
    closes = _zigzag(100)
    macd, signal, hist = metrics.macd_series(closes)
    # first 25 positions: EMA-26 is None so MACD is None
    assert all(v is None for v in macd[:25])
    # signal needs 9 more points of MACD — first 33 signal values are None
    assert all(v is None for v in signal[:33])


def test_macd_histogram_equals_macd_minus_signal():
    closes = _zigzag(100)
    macd, signal, hist = metrics.macd_series(closes)
    for m, s, h in zip(macd, signal, hist):
        if m is not None and s is not None:
            assert h == pytest.approx(m - s, abs=1e-3)
        else:
            assert h is None


# ── OBV ───────────────────────────────────────────────────────────────────────

def test_obv_first_point_is_none():
    closes = [10.0, 11.0, 10.5]
    volumes = [1000.0, 2000.0, 1500.0]
    result = metrics.obv_series(closes, volumes)
    assert result[0] is None


def test_obv_rises_on_up_close():
    closes = [10.0, 11.0]
    volumes = [1000.0, 2000.0]
    result = metrics.obv_series(closes, volumes)
    assert result[1] == pytest.approx(2000.0)


def test_obv_falls_on_down_close():
    closes = [11.0, 10.0]
    volumes = [1000.0, 2000.0]
    result = metrics.obv_series(closes, volumes)
    assert result[1] == pytest.approx(-2000.0)


def test_obv_unchanged_on_flat_close():
    closes = [10.0, 10.0]
    volumes = [1000.0, 2000.0]
    result = metrics.obv_series(closes, volumes)
    assert result[1] == pytest.approx(0.0)


def test_obv_length_mismatch_returns_all_none():
    result = metrics.obv_series([1.0, 2.0], [100.0])
    assert all(v is None for v in result)
