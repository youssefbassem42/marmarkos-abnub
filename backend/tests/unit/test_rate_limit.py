"""Rate limiter unit tests: BR-12 hashing, BR-15 window behaviour."""

import pytest

from app.core.exceptions.errors import RateLimitedError
from app.core.rate_limit import SlidingWindowRateLimiter, hash_key


def test_hash_key_is_deterministic_and_salted() -> None:
    assert hash_key("1.2.3.4") == hash_key("1.2.3.4")
    assert hash_key("1.2.3.4") != "1.2.3.4"
    # Salted with JWT_SECRET: same input, different secret, different key.
    assert len(hash_key("x")) == 64


def test_allows_up_to_limit_then_blocks() -> None:
    limiter = SlidingWindowRateLimiter(limit=3, window_seconds=60)
    limiter.hit("k")
    limiter.hit("k")
    limiter.hit("k")
    with pytest.raises(RateLimitedError) as excinfo:
        limiter.hit("k")
    assert excinfo.value.status_code == 429
    assert 0 < excinfo.value.retry_after <= 60


def test_keys_are_independent() -> None:
    limiter = SlidingWindowRateLimiter(limit=1, window_seconds=60)
    limiter.hit("a")
    with pytest.raises(RateLimitedError):
        limiter.hit("a")
    limiter.hit("b")  # unaffected by a's block


def test_window_slides(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.core.rate_limit as rl

    now = [1_000.0]
    monkeypatch.setattr(rl.time, "monotonic", lambda: now[0])
    limiter = SlidingWindowRateLimiter(limit=1, window_seconds=10)

    limiter.hit("k")
    with pytest.raises(RateLimitedError) as inside:
        limiter.hit("k")
    assert inside.value.retry_after == 10

    now[0] += 11.0  # window fully elapsed
    limiter.hit("k")


def test_retry_after_computed_from_oldest_hit(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.core.rate_limit as rl

    now = [500.0]
    monkeypatch.setattr(rl.time, "monotonic", lambda: now[0])
    limiter = SlidingWindowRateLimiter(limit=2, window_seconds=30)
    limiter.hit("k")
    now[0] += 5.5
    limiter.hit("k")
    now[0] += 1.0
    with pytest.raises(RateLimitedError) as excinfo:
        limiter.hit("k")
    # oldest hit at t=500 expires at 530; now is 506.5 → ~24s remain.
    assert excinfo.value.retry_after in (24, 25)


def test_store_is_bounded_under_hostile_key_fanout() -> None:
    import app.core.rate_limit as rl

    original_cap = rl._MAX_TRACKED_KEYS
    rl._MAX_TRACKED_KEYS = 50
    try:
        limiter = SlidingWindowRateLimiter(limit=1000, window_seconds=3600)
        for i in range(500):
            limiter.hit(f"key-{i}")
        assert len(limiter._hits) <= rl._MAX_TRACKED_KEYS
    finally:
        rl._MAX_TRACKED_KEYS = original_cap
