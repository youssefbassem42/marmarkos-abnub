"""Repository interfaces for the notifications module."""

import uuid
from datetime import datetime
from typing import Protocol

from app.core.pagination import PageParams
from app.modules.notifications.domain.enums.notification_tab import NotificationTab
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification


class NotificationRepository(Protocol):
    async def add(self, notification: Notification) -> None: ...

    async def get_visible_for_user(
        self, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> Notification | None: ...

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
    ) -> Notification: ...

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        params: PageParams,
        tab: NotificationTab,
        since: datetime | None = None,
    ) -> tuple[list[Notification], set[uuid.UUID], int]: ...

    async def count_unread(self, user_id: uuid.UUID) -> int: ...

    async def tab_counts(self, user_id: uuid.UUID) -> dict[NotificationTab, int]: ...


class NotificationReadRepository(Protocol):
    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> int: ...

    async def mark_all_read(self, user_id: uuid.UUID) -> int: ...

    async def read_ids_for(
        self, user_id: uuid.UUID, notification_ids: list[uuid.UUID]
    ) -> set[uuid.UUID]: ...
