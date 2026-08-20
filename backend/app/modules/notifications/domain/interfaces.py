"""Repository interface for the notifications module."""

import uuid
from typing import Any, Protocol

from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification


class NotificationRepository(Protocol):
    async def add(self, notification: Notification) -> None: ...

    async def list_for_user(
        self, user_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> list[Notification]: ...

    async def count_unread(self, user_id: uuid.UUID) -> int: ...

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> None: ...

    async def create(
        self,
        *,
        user_id: uuid.UUID | None,
        type: NotificationType,
        title: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> Notification: ...
