import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.users.infrastructure.persistence.models import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self._session.execute(
            select(User).options(selectinload(User.role)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(User).options(selectinload(User.role)).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_public_id(self, public_id: str) -> User | None:
        result = await self._session.execute(
            select(User).options(selectinload(User.role)).where(User.public_id == public_id)
        )
        return result.scalar_one_or_none()

    async def exists_by_email(self, email: str) -> bool:
        result = await self._session.execute(select(User.id).where(User.email == email).limit(1))
        return result.scalar_one_or_none() is not None

    async def get_by_phone(self, phone: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.phone == phone).limit(1)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[User]:
        result = await self._session.execute(
            select(User).options(selectinload(User.role)).order_by(User.created_at)
        )
        return list(result.scalars().all())

    async def add(self, user: User) -> None:
        self._session.add(user)
        await self._session.flush()

    async def set_last_login(self, user: User, at: datetime) -> None:
        user.last_login_at = at
        await self._session.flush()
