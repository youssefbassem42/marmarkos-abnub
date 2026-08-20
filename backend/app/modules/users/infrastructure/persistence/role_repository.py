from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import Role


class RoleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_name(self, name: RoleName) -> Role | None:
        result = await self._session.execute(select(Role).where(Role.name == name))
        return result.scalar_one_or_none()

    async def add(self, role: Role) -> None:
        self._session.add(role)
        await self._session.flush()
