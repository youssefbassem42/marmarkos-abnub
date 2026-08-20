import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification


class NotificationRepository:
    """In-app notification bell.

    ``user_id IS NULL`` rows are broadcasts delivered to every user.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, notification: Notification) -> None:
        self._session.add(notification)
        await self._session.flush()

    async def create(
        self,
        *,
        user_id: uuid.UUID | None,
        type: NotificationType,
        title: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id, type=type, title=title, message=message, data=data
        )
        self._session.add(notification)
        await self._session.flush()
        return notification

    async def list_for_user(
        self, user_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> list[Notification]:
        result = await self._session.execute(
            select(Notification)
            .where(or_(Notification.user_id == user_id, Notification.user_id.is_(None)))
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def count_unread(self, user_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(Notification.id)).where(
                or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
                Notification.read_at.is_(None),
            )
        )
        return int(result.scalar_one())

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> None:
        from sqlalchemy import update

        await self._session.execute(
            update(Notification)
            .where(
                Notification.id == notification_id,
                or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
                Notification.read_at.is_(None),
            )
            .values(read_at=datetime.now())
        )
