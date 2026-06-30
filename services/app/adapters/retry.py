"""Generic retry / backoff for adapter IO — source-agnostic.

Every external data source (market data today; news, sentiment, a bulk
fundamentals API later) shares the same failure mode: transient errors and
rate-limiting under concurrent load. This helper wraps any callable with bounded
exponential backoff so individual adapters don't re-implement it.

Lives in the adapter layer (not core) because retries are an IO concern — the
pure scoring core never touches the network.
"""
from __future__ import annotations

import logging
import time
from typing import Callable, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

DEFAULT_RETRIES = 2      # extra attempts after the first try
DEFAULT_BACKOFF = 1.0    # seconds before the first retry; doubles each attempt


def with_retry(
    fn: Callable[[], T],
    *,
    retries: int = DEFAULT_RETRIES,
    backoff: float = DEFAULT_BACKOFF,
    is_valid: Optional[Callable[[T], bool]] = None,
    on_exhausted: T = None,  # type: ignore[assignment]
    label: str = "operation",
) -> T:
    """Call `fn` with bounded exponential backoff and return its result.

    Retries when `fn` raises, OR when `is_valid(result)` is provided and returns
    False — the latter handles "successful call, empty payload" cases (e.g. a
    throttled batch download that returns no rows rather than raising).

    Returns the first valid result; if every attempt is exhausted, logs a warning
    and returns `on_exhausted` (default None).
    """
    last_exc: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            result = fn()
            if is_valid is None or is_valid(result):
                return result
        except Exception as exc:  # noqa: BLE001 — adapters surface failures as None/empty (FR-3.5)
            last_exc = exc
        if attempt < retries:
            time.sleep(backoff * (2 ** attempt))
    logger.warning("%s failed after %d attempts: %s", label, retries + 1, last_exc)
    return on_exhausted
