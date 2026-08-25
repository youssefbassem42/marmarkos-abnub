"""Lifecycle persistence for anonymous messages.

PRIVACY: anonymity here means *no account linkage* — the table has no
user_id/author_id/session/IP columns and never gains them (D-1, BR-11).
``sender_name``/``sender_phone`` are self-declared free text only.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.core.time.clock import now_utc
from app.modules.anonymous_messages.domain.enums.message_status import (
    MessageStatus,
    TelegramStatus,
)
from app.modules.anonymous_messages.infrastructure.persistence.models import AnonymousMessage


class AnonymousMessageRepository:
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

    # Reserved for a future delivery worker; unused in Phase 4, which
    # sends inline in the request and offers an admin retry instead (D-3).
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
        """BR-14: every attempt bookkeeping happens exactly once, here."""
        message.status = MessageStatus.SENT
        message.telegram_status = TelegramStatus.SENT
        message.telegram_message_id = telegram_message_id
        message.attempts += 1
        message.last_attempt_at = now_utc()
        message.sent_at = now_utc()
        await self._session.flush()

    async def mark_failed(self, message: AnonymousMessage, reason: str) -> None:
        """BR-14: a failed attempt still increments and timestamps."""
        message.status = MessageStatus.FAILED
        message.telegram_status = TelegramStatus.FAILED
        message.failure_reason = reason[:2000]
        message.attempts += 1
        message.last_attempt_at = now_utc()
        await self._session.flush()

    async def list_paginated(
        self, *, params: PageParams, status: MessageStatus | None = None
    ) -> tuple[list[AnonymousMessage], int]:
        stmt = select(AnonymousMessage).order_by(
            AnonymousMessage.created_at.desc(), AnonymousMessage.id.desc()
        )
        if status is not None:
            stmt = stmt.where(AnonymousMessage.status == status)
        rows = await self._session.execute(stmt.limit(params.size).offset(params.offset))
        total_stmt = select(func.count()).select_from(AnonymousMessage)
        if status is not None:
            total_stmt = total_stmt.where(AnonymousMessage.status == status)
        total = int((await self._session.execute(total_stmt)).scalar_one())
        return list(rows.scalars().all()), total
