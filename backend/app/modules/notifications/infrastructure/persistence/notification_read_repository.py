"""Per-user notification read state.

A notification is read for a user iff a ``notification_reads`` row
exists for the pair (BR-2). Writes are idempotent: a second mark for
the same pair is a no-op whose rowcount reports it (BR-3).
"""

import uuid

from sqlalchemy import and_, func, literal, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time.clock import now_utc
from app.modules.notifications.infrastructure.persistence.models import (
    Notification,
    NotificationRead,
)


class NotificationReadRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> int:
        """Insert one read row; returns 1 when newly created, else 0."""
        from sqlalchemy.engine import CursorResult

        stmt = (
            pg_insert(NotificationRead)
            .values(
                notification_id=notification_id,
                user_id=user_id,
                read_at=now_utc(),
            )
            .on_conflict_do_nothing(
                index_elements=["notification_id", "user_id"],
            )
        )
        result = await self._session.execute(stmt)
        assert isinstance(result, CursorResult)
        return int(result.rowcount or 0)

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        """Insert read rows for every currently visible unread notification."""
        from sqlalchemy.engine import CursorResult

        unread_ids = (
            select(Notification.id)
            .outerjoin(
                NotificationRead,
                and_(
                    NotificationRead.notification_id == Notification.id,
                    NotificationRead.user_id == user_id,
                ),
            )
            .where(
                or_(
                    Notification.user_id == user_id,
                    Notification.user_id.is_(None),
                ),
                NotificationRead.notification_id.is_(None),
            )
        )
        stmt = (
            pg_insert(NotificationRead)
            .from_select(
                ["notification_id", "user_id", "read_at"],
                unread_ids.add_columns(literal(user_id), literal(now_utc())),
            )
            .on_conflict_do_nothing(index_elements=["notification_id", "user_id"])
        )
        result = await self._session.execute(stmt)
        assert isinstance(result, CursorResult)
        return int(result.rowcount or 0)

    async def read_ids_for(
        self, user_id: uuid.UUID, notification_ids: list[uuid.UUID]
    ) -> set[uuid.UUID]:
        """The subset of ``notification_ids`` the user has already read."""
        if not notification_ids:
            return set()
        stmt = select(NotificationRead.notification_id).where(
            NotificationRead.user_id == user_id,
            NotificationRead.notification_id.in_(notification_ids),
        )
        result = await self._session.execute(stmt)
        return set(result.scalars().all())

    async def count_unread(self, user_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(Notification)
            .outerjoin(
                NotificationRead,
                and_(
                    NotificationRead.notification_id == Notification.id,
                    NotificationRead.user_id == user_id,
                ),
            )
            .where(
                or_(
                    Notification.user_id == user_id,
                    Notification.user_id.is_(None),
                ),
                NotificationRead.notification_id.is_(None),
            )
        )
        return int((await self._session.execute(stmt)).scalar_one())
