"""Anonymous message use cases: submit, retry, admin listing.

BR-13: the row is persisted *before* any delivery attempt. A Telegram
outage can therefore never lose a pastoral-care message — the submitter
always sees success (``delivered=false`` still means safely stored), and
an admin retries later (D-3).
"""

import logging
from uuid import UUID

from app.core.exceptions.errors import ConflictError, NotFoundError
from app.core.pagination import Page, PageParams
from app.modules.anonymous_messages.application.dto.anonymous_message_dto import (
    AnonymousMessageAdminResponse,
    AnonymousMessageCreateRequest,
    AnonymousMessageCreateResponse,
)
from app.modules.anonymous_messages.domain.enums.message_status import (
    MessageStatus,
    TelegramStatus,
)
from app.modules.anonymous_messages.infrastructure.persistence.models import AnonymousMessage
from app.modules.anonymous_messages.infrastructure.telegram import (
    TelegramClient,
    TelegramClientError,
    format_anonymous_message,
    get_telegram_client,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


def _to_admin_response(message: AnonymousMessage) -> AnonymousMessageAdminResponse:
    return AnonymousMessageAdminResponse(
        id=message.id,
        message=message.message,
        sender_name=message.sender_name,
        sender_phone=message.sender_phone,
        status=message.status.value,
        telegram_status=message.telegram_status.value,
        telegram_message_id=message.telegram_message_id,
        attempts=message.attempts,
        failure_reason=message.failure_reason,
        created_at=message.created_at,
        sent_at=message.sent_at,
        last_attempt_at=message.last_attempt_at,
    )


class AnonymousMessageService:
    def __init__(self, uow: UnitOfWork, telegram: TelegramClient | None = None) -> None:
        self._uow = uow
        self._telegram = telegram or get_telegram_client()

    async def submit(
        self, request: AnonymousMessageCreateRequest
    ) -> AnonymousMessageCreateResponse:
        """BR-13: store first, then forward to the one Telegram chat."""
        message = AnonymousMessage(
            message=request.message,
            sender_name=request.sender_name,
            sender_phone=request.sender_phone,
        )
        await self._uow.anonymous_messages.add(message)
        await self._uow.commit()

        delivered = await self._attempt_delivery(message)
        return AnonymousMessageCreateResponse(
            id=message.id,
            status=message.status.value,
            delivered=delivered,
        )

    async def retry(self, *, message_id: UUID, actor: User) -> AnonymousMessageAdminResponse:
        """BR-14: ADMIN-only re-delivery of a FAILED Telegram forward.

        Defence in depth: the router already guards with require_role.
        """
        if actor.role.name is not RoleName.ADMIN:
            raise ConflictError("Insufficient permissions")

        message = await self._uow.anonymous_messages.get_by_id(message_id)
        if message is None:
            raise NotFoundError("Message not found")
        if message.telegram_status is not TelegramStatus.FAILED:
            raise ConflictError("Only failed messages can be retried")

        await self._attempt_delivery(message)

        await self._uow.audit.record(
            action="anonymous_message.retry",
            entity_type="anonymous_message",
            entity_id=str(message.id),
            actor_user_id=actor.id,
        )
        await self._uow.commit()
        return _to_admin_response(message)

    async def list_messages(
        self, *, params: PageParams, status: MessageStatus | None = None
    ) -> Page[AnonymousMessageAdminResponse]:
        messages, total = await self._uow.anonymous_messages.list_paginated(
            params=params, status=status
        )
        return Page.build([_to_admin_response(m) for m in messages], total, params)

    async def _attempt_delivery(self, message: AnonymousMessage) -> bool:
        """Send once, then bookkeeping-commit. Never raises (BR-13)."""
        try:
            text = format_anonymous_message(message)
            telegram_message_id = await self._telegram.send_message(text)
        except TelegramClientError as exc:
            logger.error("Telegram delivery failed for anonymous message %s", message.id)
            await self._uow.anonymous_messages.mark_failed(message, str(exc))
            await self._uow.commit()
            return False
        except Exception:  # noqa: BLE001 — the stored message must survive anything
            logger.exception("Unexpected delivery error for %s", message.id)
            await self._uow.anonymous_messages.mark_failed(message, "unexpected error")
            await self._uow.commit()
            return False
        await self._uow.anonymous_messages.mark_sent(message, telegram_message_id)
        await self._uow.commit()
        return True
