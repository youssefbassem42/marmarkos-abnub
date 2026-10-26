import asyncio
import socket
from collections.abc import AsyncIterator, Iterator

from tests import env_bootstrap  # isort: skip  # noqa: F401  (must run before app.config)

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, insert
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

import app.modules.users.infrastructure.persistence.models  # noqa: F401
from app.config import settings
from app.core.database import sanitize_database_url
from app.modules.notifications.infrastructure.email.service import EmailService
from app.modules.notifications.infrastructure.email.templates import BrandEmailContent
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


@pytest.fixture(autouse=True)
def console_mail_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """No test may open a socket to a real mail provider."""
    monkeypatch.setattr(settings, "MAIL_PROVIDER", "console")


@pytest.fixture(autouse=True)
def reset_rate_limiters() -> None:
    """Every test starts with empty rate-limit windows.

    The limiters are module-level singletons (D-22), so without this a
    test that trips a limit would leak that state into the next one.
    """
    from app.core.rate_limit import reset_all_limiters

    reset_all_limiters()


_ALLOWED_OUTBOUND_HOSTS = frozenset({"127.0.0.1", "::1", "localhost", "0.0.0.0", ""})


@pytest.fixture(autouse=True)
def no_external_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail loudly when a test tries to reach a third-party service.

    Only loopback connections are allowed (the local PostgreSQL container).
    Any other outbound connection raises, so an accidental call to a real
    API becomes an immediate, visible test failure instead of a silent
    production request.
    """
    real_connect = socket.socket.connect
    real_connect_ex = socket.socket.connect_ex

    def _host_of(address: object) -> str:
        if isinstance(address, tuple) and address:
            return str(address[0])
        return str(address)

    def _guard_connect(
        self: socket.socket, address: object, *args: object, **kwargs: object
    ) -> object:
        if _host_of(address) in _ALLOWED_OUTBOUND_HOSTS:
            return real_connect(self, address, *args, **kwargs)
        raise RuntimeError(f"Outbound network access is blocked in tests (attempted {address!r})")

    def _guard_connect_ex(
        self: socket.socket, address: object, *args: object, **kwargs: object
    ) -> object:
        if _host_of(address) in _ALLOWED_OUTBOUND_HOSTS:
            return real_connect_ex(self, address, *args, **kwargs)
        raise RuntimeError(f"Outbound network access is blocked in tests (attempted {address!r})")

    monkeypatch.setattr(socket.socket, "connect", _guard_connect)
    monkeypatch.setattr(socket.socket, "connect_ex", _guard_connect_ex)


@pytest_asyncio.fixture()
async def captured_emails(
    monkeypatch: pytest.MonkeyPatch,
) -> list[tuple[str, BrandEmailContent]]:
    sent: list[tuple[str, BrandEmailContent]] = []

    async def _capture(self: EmailService, *, to_email: str, content: BrandEmailContent) -> bool:
        sent.append((to_email, content))
        return True

    monkeypatch.setattr(EmailService, "send", _capture)
    return sent


@pytest_asyncio.fixture()
async def client() -> AsyncIterator[AsyncClient]:
    from app.main import create_app

    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
