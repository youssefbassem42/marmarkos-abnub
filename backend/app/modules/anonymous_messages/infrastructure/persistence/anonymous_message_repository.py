import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.anonymous_messages.domain.enums.message_status import (
    MessageStatus,
    TelegramStatus,
)
from app.modules.anonymous_messages.infrastructure.persistence.models import AnonymousMessage


class AnonymousMessageRepository:
    """Lifecycle persistence for anonymous messages.

    Deliberately no user-identity columns: anonymity is structural.
    Pending rows are claimed atomically (FOR UPDATE SKIP LOCKED) by the
    Telegram delivery worker.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, message: AnonymousMessage) -> None:
        self._session.add(message)
        await self._session.flush()

    async def get_by_id(self, message_id: uuid.UUID) -> AnonymousMessage | None:
        result = await self._session.execute(
            select(AnonymousMessage).where(AnonymousMessage.id == message_id)
        )
        return result.scalar_one_or_none()

    async def claim_pending(self, limit: int = 50) -> list[AnonymousMessage]:
        result = await self._session.execute(
            select(AnonymousMessage)
            .where(AnonymousMessage.status == MessageStatus.PENDING)
            .order_by(AnonymousMessage.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return list(result.scalars().all())

    async def mark_sent(self, message: AnonymousMessage, telegram_message_id: str | None) -> None:
        message.status = MessageStatus.SENT
        message.telegram_status = TelegramStatus.SENT
        message.telegram_message_id = telegram_message_id
        message.sent_at = datetime.now()
        await self._session.flush()

    async def mark_failed(self, message: AnonymousMessage, reason: str) -> None:
        message.status = MessageStatus.FAILED
        message.telegram_status = TelegramStatus.FAILED
        message.failure_reason = reason[:2000]
        await self._session.flush()
