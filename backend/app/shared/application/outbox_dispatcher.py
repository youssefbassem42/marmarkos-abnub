"""Transactional-outbox dispatcher (P5-015, Part 1 §4.7).

The scheduler tick drains pending outbox rows through this module: each
claimed event is handled by exactly one registered handler, success
marks it PROCESSED and failure backs it off for retry. Unknown event
types are retried with a clear error — never silently dropped.

Handlers receive the ``UnitOfWork`` so they can write notifications in
the same session; email delivery happens inline after that commit.
"""

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.shared.infrastructure.persistence.outbox import (
    OutboxEvent,
    OutboxRepository,
    OutboxStatus,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)

Handler = Callable[[UnitOfWork, OutboxEvent], Awaitable[None]]

EVENT_HANDLERS: dict[str, Handler] = {}
"""Registry filled by feature modules at import time (bible → US-028)."""


def register_handler(event_type: str, handler: Handler) -> None:
    EVENT_HANDLERS[event_type] = handler


async def dispatch_pending(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    limit: int = 50,
    retry_after_seconds: int = 300,
) -> dict[str, int]:
    """Claim and process up to ``limit`` due events; returns counters.

    ``retry_after_seconds`` is the backoff applied to failures; tests
    pass 0 to make retries immediately due.
    """
    processed = 0
    failed = 0

    # One session to claim; per-event sessions so a failing handler can
    # mark only its own row failed without losing siblings' progress.
    claimed_ids: list[Any] = []
    async with UnitOfWork.create(session_factory) as claimer:
        events = await OutboxRepository(claimer.session).claim_pending(limit=limit)
        claimed_ids = [event.id for event in events]

    for event_id in claimed_ids:
        result = await _dispatch_one(
            session_factory, event_id, retry_after_seconds=retry_after_seconds
        )
        if result:
            processed += 1
        else:
            failed += 1

    return {"processed": processed, "failed": failed}


async def _dispatch_one(
    session_factory: async_sessionmaker[AsyncSession],
    event_id: Any,
    *,
    retry_after_seconds: int = 300,
) -> bool:
    from app.shared.infrastructure.persistence.outbox import OutboxEvent

    async with UnitOfWork.create(session_factory) as uow:
        repo = OutboxRepository(uow.session)
        event = await uow.session.get(OutboxEvent, event_id)
        if event is None or event.status is OutboxStatus.PROCESSED:
            return True  # already delivered by someone else; not a failure

        handler = EVENT_HANDLERS.get(event.event_type)
        if handler is None:
            await repo.mark_failed(
                event,
                f"No handler registered for event type {event.event_type!r}",
                retry_after_seconds=retry_after_seconds,
            )
            await uow.commit()
            logger.error("Outbox event %s has no handler", event_id)
            return False
        try:
            await handler(uow, event)
        except Exception as exc:  # noqa: BLE001 - isolation is the point
            await repo.mark_failed(
                event,
                f"{type(exc).__name__}: {exc}",
                retry_after_seconds=retry_after_seconds,
            )
            await uow.commit()
            logger.exception("Outbox event %s handler failed", event_id)
            return False
        await repo.mark_processed(event)
        await uow.commit()
        return True
