import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.attendance.infrastructure.persistence.models import ServiceSession


class ServiceSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, session_id: uuid.UUID) -> ServiceSession | None:
        result = await self._session.execute(
            select(ServiceSession).where(ServiceSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def list_active(self) -> list[ServiceSession]:
        result = await self._session.execute(
            select(ServiceSession)
            .where(ServiceSession.is_active.is_(True))
            .order_by(ServiceSession.date.desc())
        )
        return list(result.scalars().all())

    async def add(self, session_: ServiceSession) -> None:
        self._session.add(session_)
        await self._session.flush()
