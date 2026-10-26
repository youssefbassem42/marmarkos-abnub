from collections.abc import AsyncIterator
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.shared.infrastructure.persistence.base import Base  # noqa: F401  canonical Base
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

_ASYNC_UNAWARE_PARAMS = {"sslmode", "channel_binding"}


def sanitize_database_url(url: str) -> str:
    """Normalize a PostgreSQL URL for the asyncpg driver.

    Removes libpq-only query parameters that asyncpg does not accept and
    ensures the async driver scheme is used (Neon ``sslmode`` URLs work
    unchanged; SSL is negotiated by asyncpg by default).
    """
    parsed = urlparse(url)
    scheme = "postgresql+asyncpg" if parsed.scheme in {"postgresql", "postgres"} else parsed.scheme
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key not in _ASYNC_UNAWARE_PARAMS
    ]
    return urlunparse(parsed._replace(scheme=scheme, query=urlencode(query)))


def _create_engine(url: str) -> AsyncEngine:
    """The engine with an explicit pool (PERF-003).

    The test suite uses ``NullPool`` (every session gets a fresh
    connection, so a test never inherits a connection of another test).
    Everywhere else the pool is sized explicitly: the defaults of
    SQLAlchemy are implicit and wrong for a serverless deployment, where
    every replica opens its own pool.
    """
    if settings.APP_ENV == "test":
        return create_async_engine(
            sanitize_database_url(url), poolclass=NullPool, pool_pre_ping=True
        )
    return create_async_engine(
        sanitize_database_url(url),
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT_SECONDS,
        pool_recycle=settings.DB_POOL_RECYCLE_SECONDS,
        pool_pre_ping=True,
    )


engine: AsyncEngine = _create_engine(settings.DATABASE_URL)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session


async def get_unit_of_work() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as uow:
        yield uow
