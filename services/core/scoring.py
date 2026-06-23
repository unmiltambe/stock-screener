"""The scoring model — Fundamental, Technical, Combined scores and Signal.

Pure functions, stdlib only. The canonical specification is docs/SCORING.md;
this module is its executable form and must stay faithful to it. Do not change
the math here without a corresponding, deliberate update to SCORING.md.
"""
from __future__ import annotations

import math
from typing import List, Optional, Sequence, Tuple

from .metrics import compute_tech_metrics
from .models import (
    Fundamentals,
    MarketSnapshot,
    Scores,
    ScoredTicker,
    Signal,
    TechMetrics,
)

# ── Fundamental sub-scores (sigmoid, no hard caps) ────────────────────────────


def _sigmoid(x: float, k: float, midpoint: float) -> float:
    """100 / (1 + e^(-k(x - midpoint))). Negative k inverts (lower-is-better)."""
    return 100.0 / (1.0 + math.exp(-k * (x - midpoint)))


def roe_subscore(roe_pct: float) -> float:
    return _sigmoid(roe_pct, k=0.08, midpoint=20.0)


def fcf_subscore(fcf_yield_pct: float) -> float:
    return _sigmoid(fcf_yield_pct, k=0.50, midpoint=3.5)


def peg_subscore(peg: float) -> float:
    # Lower PEG is better → invert the curve with a negative effective k.
    return _sigmoid(peg, k=-1.50, midpoint=1.5)


# ── Technical sub-scores (lookup tables) ──────────────────────────────────────


def rsi_subscore(rsi: float) -> float:
    if rsi < 25:
        return 95.0
    if rsi < 40:
        return 80.0
    if rsi < 55:
        return 65.0
    if rsi < 65:
        return 40.0
    if rsi < 75:
        return 20.0
    return 8.0


def sma_subscore(pct: float) -> float:
    """Asymmetric bell over distance-from-SMA (used for both SMA-200 and SMA-50)."""
    if pct < -20:
        return 5.0
    if pct < -10:
        return 20.0
    if pct < -5:
        return 35.0
    if pct < 0:
        return 48.0
    if pct < 5:
        return 80.0
    if pct < 15:
        return 90.0
    if pct < 30:
        return 65.0
    if pct < 50:
        return 35.0
    return 15.0


def range_subscore(range_pos: float) -> float:
    if range_pos < 10:
        return 50.0
    if range_pos < 25:
        return 80.0
    if range_pos < 45:
        return 90.0
    if range_pos < 65:
        return 60.0
    if range_pos < 80:
        return 35.0
    return 15.0


# ── Weighted combine with graceful degradation ────────────────────────────────


def _weighted(pairs: Sequence[Tuple[Optional[float], float]]) -> Optional[float]:
    """Weighted average over available (non-None) sub-scores, re-normalising the
    weights. Returns None if fewer than 2 inputs are available."""
    available = [(v, w) for v, w in pairs if v is not None]
    if len(available) < 2:
        return None
    total_weight = sum(w for _, w in available)
    return round(sum(v * w for v, w in available) / total_weight, 1)


def fund_score(
    roe_pct: Optional[float],
    fcf_yield_pct: Optional[float],
    peg: Optional[float],
) -> Optional[float]:
    return _weighted([
        (roe_subscore(roe_pct) if roe_pct is not None else None, 0.35),
        (fcf_subscore(fcf_yield_pct) if fcf_yield_pct is not None else None, 0.35),
        (peg_subscore(peg) if peg is not None else None, 0.30),
    ])


def tech_score(
    rsi: Optional[float],
    sma200_pct: Optional[float],
    sma50_pct: Optional[float],
    range_pos: Optional[float],
) -> Optional[float]:
    return _weighted([
        (rsi_subscore(rsi) if rsi is not None else None, 0.30),
        (sma_subscore(sma200_pct) if sma200_pct is not None else None, 0.30),
        (range_subscore(range_pos) if range_pos is not None else None, 0.30),
        (sma_subscore(sma50_pct) if sma50_pct is not None else None, 0.10),
    ])


def combined_score(fund: Optional[float], tech: Optional[float]) -> Optional[float]:
    if fund is None or tech is None:
        return None
    return round(fund * 0.70 + tech * 0.30, 1)


def signal(fund: Optional[float], tech: Optional[float]) -> Optional[Signal]:
    """Action signal from the Fund/Tech decision table (docs/SCORING.md §3)."""
    if fund is None:
        return None
    if fund > 60:  # Undervalued
        return Signal.BUY if (tech is not None and tech >= 40) else Signal.NEUTRAL
    if fund >= 35:  # Fair
        return Signal.NEUTRAL
    return Signal.TRIM  # Overvalued


# ── High-level orchestration (still pure) ─────────────────────────────────────


def score_metrics(f: Fundamentals, metrics: TechMetrics) -> ScoredTicker:
    """Combine raw fundamentals + already-computed technical metrics into scores.
    Pure; the `ticker` is filled in by the caller via `_replace`-style copy."""
    fs = fund_score(f.roe, f.fcf_yield, f.peg)
    ts = tech_score(metrics.rsi, metrics.sma200_pct, metrics.sma50_pct, metrics.range_pos)
    return ScoredTicker(
        ticker="",
        fundamentals=f,
        metrics=metrics,
        scores=Scores(fund=fs, tech=ts, combined=combined_score(fs, ts)),
        signal=signal(fs, ts),
    )


def score_snapshot(ticker: str, snapshot: MarketSnapshot) -> ScoredTicker:
    """Score one ticker end-to-end from an adapter snapshot. Pure."""
    f = snapshot.fundamentals
    metrics = compute_tech_metrics(snapshot.closes, f.price, f.high_52w, f.low_52w)
    result = score_metrics(f, metrics)
    return ScoredTicker(
        ticker=ticker,
        fundamentals=result.fundamentals,
        metrics=result.metrics,
        scores=result.scores,
        signal=result.signal,
    )
