"""Shared fixtures for the attendance HTTP-boundary test package."""

import uuid

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from app.modules.users.domain.enums.role_name import RoleName
from tests.utils import (
    DEFAULT_PASSWORD,
    create_qr_for_user,
    create_user_direct,
    login,
)


@pytest.fixture
def db_engine_fixture(db_engine: AsyncEngine) -> AsyncEngine:
    return db_engine


@pytest_asyncio.fixture()
async def admin_headers(client: AsyncClient, db_engine: AsyncEngine):
    return await _headers_for(client, db_engine, "admin.api@test.com", RoleName.ADMIN)


@pytest_asyncio.fixture()
async def servant_headers(client: AsyncClient, db_engine: AsyncEngine):
    return await _headers_for(client, db_engine, "servant.api@test.com", RoleName.SERVANT)


@pytest_asyncio.fixture()
async def member_headers(client: AsyncClient, db_engine: AsyncEngine):
    return await _headers_for(client, db_engine, "member.api@test.com", RoleName.MEMBER)


async def _headers_for(
    client: AsyncClient,
    engine: AsyncEngine,
    email: str,
    role: RoleName,
) -> dict[str, str]:
    await create_user_direct(engine, email=email, role_name=role)
    auth = await login(client, email=email)
    from tests.utils import bearer

    return bearer(auth["access_token"])


@pytest_asyncio.fixture()
async def member_with_qr(db_engine: AsyncEngine) -> tuple[uuid.UUID, str]:
    """A MEMBER plus an active QR token (raw token returned for scans)."""
    member_id = await create_user_direct(
        db_engine,
        email="scanned.member@test.com",
        role_name=RoleName.MEMBER,
    )
    token = f"tok-{uuid.uuid4().hex[:12]}"
    await create_qr_for_user(db_engine, member_id, token)
    return member_id, token
