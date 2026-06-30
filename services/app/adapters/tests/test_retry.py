"""Unit tests for the generic with_retry helper."""
from __future__ import annotations

from adapters.retry import with_retry


def test_returns_first_success_no_retry():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        return "ok"

    assert with_retry(fn, backoff=0) == "ok"
    assert calls["n"] == 1  # succeeded first try, no retry


def test_retries_on_exception_then_succeeds():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("transient")
        return "ok"

    assert with_retry(fn, retries=2, backoff=0) == "ok"
    assert calls["n"] == 3  # failed twice, succeeded on third


def test_returns_on_exhausted_when_always_raising():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        raise RuntimeError("boom")

    assert with_retry(fn, retries=2, backoff=0, on_exhausted="fallback") == "fallback"
    assert calls["n"] == 3  # 1 initial + 2 retries


def test_retries_on_invalid_result():
    """An exception-free but 'invalid' result (e.g. empty payload) also retries."""
    results = iter([{}, {}, {"AAPL": 1}])

    def fn():
        return next(results)

    out = with_retry(fn, retries=2, backoff=0, is_valid=bool, on_exhausted={})
    assert out == {"AAPL": 1}


def test_invalid_result_exhausted_returns_fallback():
    def fn():
        return {}  # always empty → never valid

    out = with_retry(fn, retries=2, backoff=0, is_valid=bool, on_exhausted={})
    assert out == {}
