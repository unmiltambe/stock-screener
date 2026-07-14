"""Scoring tests anchored to the worked examples in docs/SCORING.md.

Tolerances are loose enough to absorb the doc's intermediate rounding but tight
enough to catch a wrong formula, weight, or threshold.
"""
from __future__ import annotations

import math

import pytest

from core import scoring
from core.models import Signal


# ── sub-score formula checks ──────────────────────────────────────────────────
# The per-metric anchor numbers in SCORING.md are *illustrative* (hand-rounded),
# so we validate against the exact sigmoid formula rather than those tables. The
# authoritative real-world anchors are the composite worked examples below.

def _sig(x, k, mid):
    return 100.0 / (1.0 + math.exp(-k * (x - mid)))


@pytest.mark.parametrize("roe", [0, 10, 20, 35, 60])
def test_roe_subscore_matches_formula(roe):
    assert scoring.roe_subscore(roe) == pytest.approx(_sig(roe, 0.08, 20.0), abs=1e-6)


def test_roe_subscore_caps_at_60():
    # Values above 60 % are capped to avoid accounting artifacts inflating the score.
    assert scoring.roe_subscore(114) == pytest.approx(scoring.roe_subscore(60), abs=1e-6)
    assert scoring.roe_subscore(600) == pytest.approx(scoring.roe_subscore(60), abs=1e-6)


@pytest.mark.parametrize("fcf", [-2, 0, 3.5, 5, 7.6, 10])
def test_fcf_subscore_matches_formula(fcf):
    assert scoring.fcf_subscore(fcf) == pytest.approx(_sig(fcf, 0.50, 3.5), abs=1e-6)


@pytest.mark.parametrize("peg", [0.3, 0.9, 1.0, 1.42, 1.5, 2.0])
def test_peg_subscore_matches_inverted_formula(peg):
    assert scoring.peg_subscore(peg) == pytest.approx(_sig(peg, -1.50, 1.5), abs=1e-6)


def test_subscores_hit_50_at_midpoint():
    assert scoring.roe_subscore(20) == pytest.approx(50.0)
    assert scoring.fcf_subscore(3.5) == pytest.approx(50.0)
    assert scoring.peg_subscore(1.5) == pytest.approx(50.0)


def test_peg_is_inverted_lower_is_better():
    assert scoring.peg_subscore(0.5) > scoring.peg_subscore(2.5)


# ── fundamental score worked examples ─────────────────────────────────────────

@pytest.mark.parametrize("roe, fcf, peg, expected", [
    (48.5, 7.6, 1.58, 76.9),   # NFLX
    (114.3, 0.9, 0.63, 64.7),  # NVDA (ROE capped at 60 — was 66.1 before cap)
    (38.9, 0.6, 1.42, 51.2),   # GOOGL
])
def test_fund_score_examples(roe, fcf, peg, expected):
    assert scoring.fund_score(roe, fcf, peg) == pytest.approx(expected, abs=0.6)


def test_fund_score_renormalises_when_one_input_missing():
    # Only ROE + PEG present → weights re-normalise; still a valid score.
    s = scoring.fund_score(35.0, None, 1.5)
    assert s is not None


def test_fund_score_none_when_fewer_than_two_inputs():
    assert scoring.fund_score(35.0, None, None) is None
    assert scoring.fund_score(None, None, None) is None


# ── technical sub-scores & score ──────────────────────────────────────────────

@pytest.mark.parametrize("rsi, expected", [
    (10, 95), (30, 80), (50, 65), (60, 40), (70, 20), (90, 8)])
def test_rsi_subscore(rsi, expected):
    assert scoring.rsi_subscore(rsi) == expected


@pytest.mark.parametrize("pct, expected", [
    (-25, 5), (-12, 20), (-7, 35), (-2, 48), (3, 80), (10, 90), (20, 65), (40, 35), (60, 15)])
def test_sma_subscore(pct, expected):
    assert scoring.sma_subscore(pct) == expected


def test_tech_score_none_when_fewer_than_two_inputs():
    assert scoring.tech_score(50, None, None) is None


# ── combined & signal ─────────────────────────────────────────────────────────

def test_combined_weights_fundamentals_more():
    # No setup: falls back to fund × 0.70 + tech × 0.30
    assert scoring.combined_score(80, 40) == pytest.approx(80 * 0.7 + 40 * 0.3, abs=0.05)
    # With setup: tech effective = tech × 0.70 + setup × 0.30
    assert scoring.combined_score(80, 40, 60) == pytest.approx(80 * 0.7 + (40 * 0.7 + 60 * 0.3) * 0.3, abs=0.05)


def test_combined_none_if_either_missing():
    assert scoring.combined_score(None, 50) is None
    assert scoring.combined_score(50, None) is None


@pytest.mark.parametrize("fund, tech, expected", [
    (70, 50, Signal.BUY),       # undervalued + constructive
    (70, 30, Signal.NEUTRAL),   # undervalued but bearish setup
    (50, 90, Signal.NEUTRAL),   # fair → neutral regardless
    (35, 10, Signal.NEUTRAL),   # boundary: 35 is still "fair"
    (20, 90, Signal.TRIM),      # overvalued
])
def test_signal_decision_table(fund, tech, expected):
    assert scoring.signal(fund, tech) == expected


def test_signal_none_without_fundamental():
    assert scoring.signal(None, 80) is None
