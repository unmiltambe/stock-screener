"""Pure scoring core — no IO, no framework. See docs/SCORING.md."""
from .metrics import compute_tech_metrics, rsi, sma
from .models import (
    Fundamentals,
    MarketSnapshot,
    Scores,
    ScoredTicker,
    Signal,
    TechMetrics,
    Watchlist,
)
from .scoring import (
    combined_score,
    fund_score,
    score_metrics,
    score_snapshot,
    signal,
    tech_score,
)

__all__ = [
    "Fundamentals",
    "MarketSnapshot",
    "Scores",
    "ScoredTicker",
    "Signal",
    "TechMetrics",
    "Watchlist",
    "compute_tech_metrics",
    "rsi",
    "sma",
    "combined_score",
    "fund_score",
    "score_metrics",
    "score_snapshot",
    "signal",
    "tech_score",
]
