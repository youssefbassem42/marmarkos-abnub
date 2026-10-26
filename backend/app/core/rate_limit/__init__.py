"""In-memory sliding-window rate limiting.

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
from collections.abc import Callable, Iterable

from fastapi import Request

from app.config import settings
from app.core.exceptions.errors import RateLimitedError
from app.core.observability import increment

_MAX_TRACKED_KEYS = 10_000

# Every limiter created through ``register_limiter`` is tracked here so the
# test suite can reset the windows between tests (see ``reset_all_limiters``).
_REGISTERED_LIMITERS: list["SlidingWindowRateLimiter"] = []


class SlidingWindowRateLimiter:
    """Classic sliding window: keep the timestamps of recent hits per key."""

    def __init__(
        self,
        *,
        limit: int | Callable[[], int],
        window_seconds: int,
        name: str = "unknown",
    ) -> None:
        # The limit may be a callable so it can follow a settings value
        # that is read at request time instead of at import time.
        self._limit_source = limit if callable(limit) else lambda: int(limit)
        self._window = window_seconds
        # The name is the label of the counter: "auth_login", "anonymous_message"...
        self._name = name
        self._hits: dict[str, deque[float]] = {}

    @property
    def limit(self) -> int:
        """The effective limit of this window."""
        return self._limit_source()

    def hit(self, key: str) -> None:
        """Record one hit; raise ``RateLimitedError`` once the limit is met."""
        now = time.monotonic()
        window = self._hits.setdefault(key, deque())
        while window and window[0] <= now - self._window:
            window.popleft()
        if len(window) >= self.limit:
            # The oldest surviving hit is what blocks this one.
            retry_at = window[0] + self._window
            increment("marmarkos_rate_limited_total", {"limiter": self._name})
            raise RateLimitedError(retry_after=max(1, math.ceil(retry_at - now)))
        window.append(now)
        self._prune_if_needed()

    def record(self, key: str) -> int:
        """Record one hit **without** raising; return the hits in the window.

        Used by the "count only the failures" limits (a successful sign-in
        must not consume the budget of the address it came from).
        """
        now = time.monotonic()
        window = self._hits.setdefault(key, deque())
        while window and window[0] <= now - self._window:
            window.popleft()
        window.append(now)
        self._prune_if_needed()
        return len(window)

    def reset_key(self, key: str) -> None:
        """Forget the hits of one key (e.g. after a successful sign-in)."""
        self._hits.pop(key, None)

    def retry_after(self, key: str) -> int:
        """Seconds until the oldest hit of this key leaves the window."""
        window = self._hits.get(key)
        if not window:
            return 0
        return max(1, math.ceil(window[0] + self._window - time.monotonic()))

    def reset(self) -> None:
        """Drop every recorded hit (used by the test suite)."""
        self._hits.clear()

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


def register_limiter(limiter: SlidingWindowRateLimiter) -> SlidingWindowRateLimiter:
    """Track a limiter so the test suite can reset it between tests."""
    _REGISTERED_LIMITERS.append(limiter)
    return limiter


def reset_all_limiters() -> None:
    """Clear every registered window (test-suite helper)."""
    for limiter in _REGISTERED_LIMITERS:
        limiter.reset()


def hash_key(value: str) -> str:
    """Salted hash of the rate-limit identity (BR-12): never reversible."""
    import hashlib

    return hashlib.sha256(f"{settings.JWT_SECRET}{value}".encode()).hexdigest()


def client_ip(request: Request) -> str:
    """The client address used as the rate-limit identity.

    ``X-Forwarded-For`` is only honoured when ``TRUST_PROXY_HEADERS`` is
    enabled - otherwise a client could spoof the header and escape its own
    limit.
    """
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def ip_keys(request: Request, *parts: str) -> Iterable[str]:
    """Hashed rate-limit keys for this request (IP + optional extra parts)."""
    yield hash_key(client_ip(request))
    for part in parts:
        if part:
            yield hash_key(f"{client_ip(request)}:{part.lower()}")
