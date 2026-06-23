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
