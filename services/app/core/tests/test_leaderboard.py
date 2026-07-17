"""Tests for sma_cross_bars (core/metrics.py) and core/leaderboard.py."""
from __future__ import annotations

import pytest

from core.metrics import sma_cross_bars
from core.leaderboard import best_positioned, entry_signals, exit_warnings, top_movers


# ── sma_cross_bars ────────────────────────────────────────────────────────────


def _above_cross_series(period: int, bars_above: int) -> list[float]:
    """Build a close series that crossed above its SMA exactly `bars_above` bars ago."""
    # First `period` bars: price = 100 (below would be ambiguous; keep flat)
    # Then one bar slightly below SMA to establish a "below" position
    # Then `bars_above` bars at 150 (well above SMA)
    base = [100.0] * period
    below = [50.0]  # pull SMA down momentarily then go back; simpler: just extend below
    above = [200.0] * bars_above
    return base + below + above


def test_sma_cross_bars_above():
    closes = _above_cross_series(period=5, bars_above=3)
    result = sma_cross_bars(closes, period=5)
    # Should be positive (above-cross), magnitude == bars_above
    assert result is not None
    assert result > 0
    assert result == 3


def test_sma_cross_bars_below():
    # Opposite: cross below
    base = [100.0] * 5
    above = [200.0]          # one bar well above SMA
    below = [10.0] * 4       # 4 bars well below
    closes = base + above + below
    result = sma_cross_bars(closes, period=5)
    assert result is not None
    assert result < 0
    assert result == -4


def test_sma_cross_bars_no_cross_returns_none():
    # Price consistently above SMA for > 30 bars — no recent cross
    closes = [50.0] * 10 + [200.0] * 50   # 60 bars above after initial
    result = sma_cross_bars(closes, period=10)
    assert result is None


def test_sma_cross_bars_insufficient_data():
    # Fewer than period+1 bars → None
    assert sma_cross_bars([1.0, 2.0, 3.0], period=5) is None


def test_sma_cross_bars_lookback_respected():
    # Cross happened 35 bars ago (outside default lookback=30)
    base = [100.0] * 5
    below = [50.0]
    above = [200.0] * 35
    closes = base + below + above
    result = sma_cross_bars(closes, period=5, lookback=30)
    assert result is None  # cross is outside the lookback window


# ── leaderboard functions ─────────────────────────────────────────────────────

def _row(
    ticker: str,
    fund: float | None = 60.0,
    tech: float | None = 60.0,
    combined: float | None = 60.0,
    setup: float | None = 70.0,
    day_change_pct: float | None = None,
    macd_hist_pct: float | None = None,
    macd_bars: int | None = None,
    sma50_cross: int | None = None,
    sma200_cross: int | None = None,
) -> dict:
    return {
        "ticker": ticker,
        "name": f"{ticker} Corp",
        "dayChangePct": day_change_pct,
        "scores": {"fund": fund, "tech": tech, "combined": combined, "setup": setup},
        "signal": "Neutral",
        "metrics": {
            "macdHistPct": macd_hist_pct,
            "macdBarsOnSide": macd_bars,
            "sma50CrossBars": sma50_cross,
            "sma200CrossBars": sma200_cross,
        },
        "lists": [],
    }


class TestEntrySignals:
    def test_macd_fresh_cross_included(self):
        rows = [_row("AAPL", macd_hist_pct=0.5, macd_bars=3)]
        result = entry_signals(rows)
        assert len(result) == 1
        assert result[0]["chips"] == [{"label": "MACD↑", "bars": 3}]

    def test_macd_too_old_excluded(self):
        rows = [_row("AAPL", macd_hist_pct=0.5, macd_bars=11)]
        assert entry_signals(rows) == []

    def test_macd_negative_excluded(self):
        rows = [_row("AAPL", macd_hist_pct=-0.5, macd_bars=3)]
        assert entry_signals(rows) == []

    def test_low_fund_excluded(self):
        rows = [_row("AAPL", fund=40.0, macd_hist_pct=0.5, macd_bars=3)]
        assert entry_signals(rows) == []

    def test_fund_exactly_at_threshold_included(self):
        rows = [_row("AAPL", fund=50.0, macd_hist_pct=0.5, macd_bars=3)]
        assert len(entry_signals(rows)) == 1

    def test_sma50_entry_chip(self):
        rows = [_row("AAPL", sma50_cross=5)]
        result = entry_signals(rows)
        assert len(result) == 1
        assert result[0]["chips"] == [{"label": "SMA50↑", "bars": 5}]

    def test_multiple_chips_on_one_row(self):
        rows = [_row("AAPL", macd_hist_pct=0.5, macd_bars=2, sma200_cross=4)]
        result = entry_signals(rows)
        assert len(result) == 1
        labels = [c["label"] for c in result[0]["chips"]]
        assert "MACD↑" in labels and "SMA200↑" in labels

    def test_sort_macd_before_sma(self):
        rows = [
            _row("B", sma50_cross=1),
            _row("A", macd_hist_pct=0.5, macd_bars=2),
        ]
        result = entry_signals(rows)
        assert result[0]["ticker"] == "A"  # MACD first

    def test_custom_max_bars(self):
        rows = [_row("AAPL", macd_hist_pct=0.5, macd_bars=6)]
        assert entry_signals(rows, max_bars=5) == []
        assert len(entry_signals(rows, max_bars=6)) == 1


class TestExitWarnings:
    def test_macd_negative_cross_included(self):
        rows = [_row("AAPL", macd_hist_pct=-0.5, macd_bars=2)]
        result = exit_warnings(rows)
        assert len(result) == 1
        assert result[0]["chips"] == [{"label": "MACD↓", "bars": 2}]

    def test_sma_below_cross_included(self):
        rows = [_row("AAPL", sma50_cross=-3)]
        result = exit_warnings(rows)
        assert len(result) == 1
        assert result[0]["chips"] == [{"label": "SMA50↓", "bars": 3}]

    def test_low_fund_excluded(self):
        rows = [_row("JUNK", fund=30.0, macd_hist_pct=-0.5, macd_bars=1)]
        assert exit_warnings(rows) == []

    def test_fund_at_threshold_included(self):
        rows = [_row("OK", fund=50.0, macd_hist_pct=-0.5, macd_bars=1)]
        assert len(exit_warnings(rows)) == 1

    def test_positive_sma_cross_not_an_exit(self):
        rows = [_row("AAPL", sma50_cross=3)]  # above-cross is positive
        assert exit_warnings(rows) == []


class TestBestPositioned:
    def test_top_n_by_combined(self):
        rows = [_row(str(i), combined=float(i)) for i in range(20)]
        result = best_positioned(rows, top_n=5)
        assert [r["ticker"] for r in result] == ["19", "18", "17", "16", "15"]

    def test_none_combined_excluded(self):
        rows = [_row("A", combined=None), _row("B", combined=50.0)]
        result = best_positioned(rows, top_n=5)
        assert len(result) == 1 and result[0]["ticker"] == "B"


class TestTopMovers:
    def test_gainers_and_decliners(self):
        rows = [
            _row("UP1", day_change_pct=3.0),
            _row("UP2", day_change_pct=1.5),
            _row("FLAT", day_change_pct=0.2),
            _row("DN1", day_change_pct=-2.0),
        ]
        gainers, decliners = top_movers(rows)
        assert [r["ticker"] for r in gainers] == ["UP1", "UP2"]
        assert [r["ticker"] for r in decliners] == ["DN1"]

    def test_small_moves_filtered(self):
        rows = [_row("A", day_change_pct=0.5), _row("B", day_change_pct=-0.9)]
        gainers, decliners = top_movers(rows)
        assert gainers == [] and decliners == []

    def test_top_n_respected(self):
        rows = [_row(str(i), day_change_pct=float(i + 1)) for i in range(15)]
        gainers, _ = top_movers(rows, top_n=5)
        assert len(gainers) == 5
