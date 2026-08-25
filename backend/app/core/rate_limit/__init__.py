"""In-memory sliding-window rate limiting for anonymous submissions.

LIMITATION (R-3): state lives in this process's memory only. It resets
on restart and is not shared across replicas, so the effective limit on
a multi-instance deployment is higher than configured. Escalate to a
persistent store only if abuse is observed (D-22 keeps V1 simple).

Keys arrive pre-hashed via ``hash_key`` (BR-12): a salted SHA-256 of
the client IP or user id. The clear value is never stored or logged.
"""

import math
import time
from collections import deque

from app.config import settings
from app.core.exceptions.errors import RateLimitedError

_MAX_TRACKED_KEYS = 10_000


class SlidingWindowRateLimiter:
    """Classic sliding window: keep the timestamps of recent hits per key."""

    def __init__(self, *, limit: int, window_seconds: int) -> None:
        self._limit = limit
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def hit(self, key: str) -> None:
        """Record one hit; raise ``RateLimitedError`` once the limit is met."""
        now = time.monotonic()
        window = self._hits.setdefault(key, deque())
        while window and window[0] <= now - self._window:
            window.popleft()
        if len(window) >= self._limit:
            # The oldest surviving hit is what blocks this one.
            retry_at = window[0] + self._window
            raise RateLimitedError(retry_after=max(1, math.ceil(retry_at - now)))
        window.append(now)
        self._prune_if_needed()

    def _prune_if_needed(self) -> None:
        """Keep the store bounded so hostile clients cannot grow it freely."""
        if len(self._hits) < _MAX_TRACKED_KEYS:
            return
        now = time.monotonic()
        for key in [k for k, w in self._hits.items() if not w or w[-1] <= now - self._window]:
            del self._hits[key]
        if len(self._hits) >= _MAX_TRACKED_KEYS:
            # All windows are live: evict the least recently active key.
            oldest_key = min(self._hits, key=lambda k: self._hits[k][-1])
            del self._hits[oldest_key]


def hash_key(value: str) -> str:
    """Salted hash of the rate-limit identity (BR-12): never reversible."""
    import hashlib

    return hashlib.sha256(f"{settings.JWT_SECRET}{value}".encode()).hexdigest()
