"""Feed queries over the notifications table.

``user_id IS NULL`` rows are broadcasts delivered to every user; read
state lives in ``notification_reads`` (see NotificationReadRepository)
and is joined per acting user. Ordering is always
``created_at DESC, id DESC`` so pagination stays stable on ties.
"""

import uuid
from datetime import datetime

from sqlalchemy import ColumnElement, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.modules.notifications.domain.enums.notification_tab import NotificationTab
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import (
    Notification,
    NotificationRead,
)

_ANNOUNCEMENT_TYPES = (
    NotificationType.ANNOUNCEMENT,
    NotificationType.BLOG_POST,
    NotificationType.BIBLE_VERSE,
)


class NotificationRepository:
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
        title_en: str,
        message_en: str,
        data: dict[str, object] | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            title_en=title_en,
            message_en=message_en,
            data=data,
        )
        self._session.add(notification)
        await self._session.flush()
        return notification

    async def get_visible_for_user(
        self, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> Notification | None:
        """The feed-visible notification: own rows plus broadcasts (BR-7).

        A per-user row belonging to someone else is indistinguishable
        from a missing one here, so callers answer 404, never 403.
        """
        stmt = select(Notification).where(
            Notification.id == notification_id,
            self._feed_filter(user_id, None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        params: PageParams,
        tab: NotificationTab,
        since: datetime | None = None,
    ) -> tuple[list[Notification], set[uuid.UUID], int]:
        """One page of the feed, the read ids on it, and the filtered total.

        The LEFT JOIN to ``notification_reads`` cannot duplicate rows (the
        pair is the primary key), so it doubles as both the unread filter
        and the per-row read flag without N+1 queries.
        """
        conditions: list[ColumnElement[bool]] = [self._feed_filter(user_id, since)]
        if tab is NotificationTab.UNREAD:
            conditions.append(NotificationRead.notification_id.is_(None))
        elif tab is NotificationTab.ANNOUNCEMENTS:
            conditions.append(Notification.type.in_(_ANNOUNCEMENT_TYPES))
        elif tab is NotificationTab.REMINDERS:
            conditions.append(Notification.type == NotificationType.ATTENDANCE)
        elif tab is NotificationTab.SYSTEM:
            conditions.append(Notification.type == NotificationType.SYSTEM)

        base = select(Notification, NotificationRead.notification_id).outerjoin(
            NotificationRead,
            and_(
                NotificationRead.notification_id == Notification.id,
                NotificationRead.user_id == user_id,
            ),
        )
        rows = (
            await self._session.execute(
                base.where(*conditions)
                .order_by(Notification.created_at.desc(), Notification.id.desc())
                .limit(params.size)
                .offset(params.offset)
            )
        ).all()
        items = [row[0] for row in rows]
        read_ids = {row[1] for row in rows if row[1] is not None}

        total = await self._count(user_id, conditions, joined=True)
        return items, read_ids, total

    async def count_unread(self, user_id: uuid.UUID) -> int:
        """Feed size minus the rows this user has read."""
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
            .where(self._feed_filter(user_id, None), NotificationRead.notification_id.is_(None))
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def tab_counts(self, user_id: uuid.UUID) -> dict[NotificationTab, int]:
        """Counts behind the feed tabs: one grouped pass plus the unread scalar."""
        grouped = (
            await self._session.execute(
                select(Notification.type, func.count())
                .where(self._feed_filter(user_id, None))
                .group_by(Notification.type)
            )
        ).all()
        per_type = {type_: int(count) for type_, count in grouped}
        unread = await self.count_unread(user_id)
        return {
            NotificationTab.ALL: sum(per_type.values()),
            NotificationTab.UNREAD: unread,
            NotificationTab.ANNOUNCEMENTS: (
                per_type.get(NotificationType.ANNOUNCEMENT, 0)
                + per_type.get(NotificationType.BLOG_POST, 0)
            ),
            NotificationTab.REMINDERS: per_type.get(NotificationType.ATTENDANCE, 0),
            NotificationTab.SYSTEM: per_type.get(NotificationType.SYSTEM, 0),
        }

    async def _count(
        self,
        user_id: uuid.UUID,
        conditions: list[ColumnElement[bool]],
        *,
        joined: bool,
    ) -> int:
        stmt = select(func.count()).select_from(Notification)
        if joined:
            stmt = stmt.outerjoin(
                NotificationRead,
                and_(
                    NotificationRead.notification_id == Notification.id,
                    NotificationRead.user_id == user_id,
                ),
            )
        result = await self._session.execute(stmt.where(*conditions))
        return int(result.scalar_one())

    @staticmethod
    def _feed_filter(user_id: uuid.UUID, since: datetime | None) -> ColumnElement[bool]:
        conditions = or_(Notification.user_id == user_id, Notification.user_id.is_(None))
        if since is not None:
            return and_(conditions, Notification.created_at >= since)
        return conditions
