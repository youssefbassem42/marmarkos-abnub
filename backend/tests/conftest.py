import asyncio
import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://marmarkos:marmarkos@localhost:55432/marmarkos_test"
)
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-jwt-refresh-secret")

from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, insert
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

import app.modules.users.infrastructure.persistence.models  # noqa: F401
from app.config import settings
from app.core.database import sanitize_database_url
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import Role
from app.shared.infrastructure.persistence.registry import Base

_ROLE_SEED = [
    {"name": RoleName.MEMBER, "description": "Regular church member"},
    {"name": RoleName.SERVANT, "description": "Church servant / minister"},
    {"name": RoleName.ADMIN, "description": "Platform administrator"},
]


async def _reset_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with engine.begin() as conn:
        await conn.execute(insert(Role).values(_ROLE_SEED))


async def _truncate_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())
        await conn.execute(insert(Role).values(_ROLE_SEED))


@pytest.fixture(scope="session")
def db_engine() -> Iterator[AsyncEngine]:
    engine = create_async_engine(sanitize_database_url(settings.DATABASE_URL), poolclass=NullPool)
    asyncio.run(_reset_schema(engine))
    yield engine
    asyncio.run(engine.dispose())


@pytest_asyncio.fixture(autouse=True)
async def clean_db(db_engine: AsyncEngine) -> None:
    await _truncate_schema(db_engine)


@pytest_asyncio.fixture()
async def client() -> AsyncIterator[AsyncClient]:
    from app.main import create_app

    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
