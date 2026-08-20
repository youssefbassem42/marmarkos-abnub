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
    poolclass = NullPool if settings.APP_ENV == "test" else None
    return create_async_engine(sanitize_database_url(url), poolclass=poolclass, pool_pre_ping=True)


engine: AsyncEngine = _create_engine(settings.DATABASE_URL)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session


async def get_unit_of_work() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as uow:
        yield uow
