"""Repository interface for anonymous messages."""

import uuid
from typing import Protocol

from app.core.pagination import PageParams
from app.modules.anonymous_messages.domain.enums.message_status import MessageStatus
from app.modules.anonymous_messages.infrastructure.persistence.models import AnonymousMessage


class AnonymousMessageRepository(Protocol):
    async def add(self, message: AnonymousMessage) -> None: ...

    async def get_by_id(self, message_id: uuid.UUID) -> AnonymousMessage | None: ...

    async def list_paginated(
        self, *, params: PageParams, status: MessageStatus | None = None
    ) -> tuple[list[AnonymousMessage], int]: ...

    async def mark_sent(
        self, message: AnonymousMessage, telegram_message_id: str | None
    ) -> None: ...

    async def mark_failed(self, message: AnonymousMessage, reason: str) -> None: ...

    async def claim_pending(self, limit: int = 50) -> list[AnonymousMessage]: ...
