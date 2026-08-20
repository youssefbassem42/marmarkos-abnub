"""Shared fixtures for database-focused integration tests.

Tests exercise the repositories and Unit of Work against the isolated
test database (never production/Neon). The root conftest truncates all
tables between tests and reseeds the roles.
"""

from collections.abc import AsyncIterator

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


@pytest_asyncio.fixture()
async def db_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session


@pytest_asyncio.fixture()
async def uow() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as unit_of_work:
        yield unit_of_work


async def make_user(uow: UnitOfWork, email: str) -> User:
    """Create an ACTIVE MEMBER user with a QR code (caller commits)."""
    from app.modules.users.domain.enums.role_name import RoleName
    from app.modules.users.infrastructure.services import generate_public_id

    role = await uow.roles.get_by_name(RoleName.MEMBER)
    assert role is not None
    user = User(
        email=email,
        password_hash="hashed-placeholder",
        public_id=generate_public_id(),
        role=role,
    )
    await uow.users.add(user)
    return user
