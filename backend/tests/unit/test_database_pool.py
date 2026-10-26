"""The connection pool is sized explicitly (PERF-003)."""

from sqlalchemy.pool import AsyncAdaptedQueuePool
from sqlalchemy.pool import NullPool as SyncNullPool

from app.config import settings
from app.core.database import _create_engine


def test_the_test_environment_uses_no_pool(monkeypatch) -> None:
    """Every test session gets its own connection."""
    monkeypatch.setattr(settings, "APP_ENV", "test")

    engine = _create_engine(settings.DATABASE_URL)

    assert isinstance(engine.pool, SyncNullPool)


def test_the_pool_is_sized_explicitly(monkeypatch) -> None:
    """The pool size, the overflow and the timeouts are not left implicit."""
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(settings, "DB_POOL_SIZE", 3)
    monkeypatch.setattr(settings, "DB_MAX_OVERFLOW", 2)

    engine = _create_engine(settings.DATABASE_URL)

    assert isinstance(engine.pool, AsyncAdaptedQueuePool)
    assert engine.pool.size() == 3
    assert engine.pool._max_overflow == 2


def test_the_pool_settings_have_sane_defaults() -> None:
    assert settings.DB_POOL_SIZE >= 1
    assert settings.DB_MAX_OVERFLOW >= 0
    assert settings.DB_POOL_TIMEOUT_SECONDS > 0
    # Recycling keeps a connection from being killed by the database or
    # a proxy while it is idle.
    assert settings.DB_POOL_RECYCLE_SECONDS > 0
