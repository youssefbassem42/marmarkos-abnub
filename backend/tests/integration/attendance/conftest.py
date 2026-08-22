"""Shared fixtures for the attendance integration tests.

The root conftest truncates every table between tests and reseeds the
roles, so each test starts from a clean database.
"""

import uuid
from collections.abc import AsyncIterator
from datetime import datetime

import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import async_session_factory
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import Role, User


@pytest_asyncio.fixture()
async def db_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    role_name: RoleName,
    first_name: str,
    last_name: str = "Test",
    status: UserStatus = UserStatus.ACTIVE,
    created_at: datetime | None = None,
) -> User:
    """Create a user with the given role (roles are seeded by conftest)."""
    result = await session.execute(select(Role).where(Role.name == role_name))
    role = result.scalar_one()

    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash="dummy_hash",
        public_id=uuid.uuid4().hex[:10],
        status=status,
        role_id=role.id,
        first_name=first_name,
        last_name=last_name,
    )
    if created_at is not None:
        # BR-4: expected population depends on when the account existed.
        user.created_at = created_at
    session.add(user)
    await session.commit()

    # Eager-load the role: the check-in use case inspects user.role.name
    # and async lazy loading is not allowed.
    result = await session.execute(
        select(User).options(selectinload(User.role)).where(User.id == user.id)
    )
    return result.scalar_one()
