"""Idempotent scheduled-publication runner (P5-014, BR-10/BR-11).

Each due schedule is published in its own transaction: verse →
PUBLISHED + schedule row completed + ``BibleVersePublished`` event
recorded atomically. A second tick finds nothing to claim
(``FOR UPDATE SKIP LOCKED``), so publication can never happen twice.
Per-item failures are isolated: the row is marked FAILED with an error,
the tick continues, and later ticks retry while attempts < 5.
"""

import logging
from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.time.clock import now_utc
from app.modules.bible.domain.enums import ScheduleStatus, VerseStatus
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


async def publish_due(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    limit: int = 50,
    now: Callable[[], datetime] | None = None,
) -> dict[str, int]:
    """Claim and publish all due schedules; returns {published, failed, skipped}."""
    clock = now or now_utc
    reference = clock()

    claimed_ids: list[UUID] = []
    async with UnitOfWork.create(session_factory) as claimer:
        schedules = await claimer.verse_schedules.claim_due(limit=limit, now=reference)
        claimed_ids = [schedule.id for schedule in schedules]

    published = failed = skipped = 0
    for schedule_id in claimed_ids:
        result = await _publish_one(session_factory, schedule_id, clock)
        if result == "published":
            published += 1
        elif result == "skipped":
            skipped += 1
        else:
            failed += 1
    return {"published": published, "failed": failed, "skipped": skipped}


async def _publish_one(
    session_factory: async_sessionmaker[AsyncSession],
    schedule_id: UUID,
    clock: Callable[[], datetime],
) -> str:
    from app.modules.bible.application.commands.verse_commands import _transition
    from app.modules.bible.domain.events.bible_verse_published import BibleVersePublished

    async with UnitOfWork.create(session_factory) as uow:
        schedule = await uow.verse_schedules.get_by_id(schedule_id)
        if schedule is None:
            return "skipped"
        if schedule.status not in (ScheduleStatus.SCHEDULED, ScheduleStatus.FAILED):
            # Cancelled or already published between claim and completion.
            return "skipped"
        if schedule.status is ScheduleStatus.FAILED and schedule.attempts >= 5:
            return "skipped"  # BR-11: retry budget exhausted; surfaced to admins
        verse = await uow.bible_verses.get_by_id(schedule.verse_id)
        if (
            verse is None
            or verse.status not in (VerseStatus.DRAFT, VerseStatus.SCHEDULED)
        ):
            # BR-11: never publish archived/withdrawn content.
            schedule.last_error = "verse no longer publishable"
            await uow.session.flush()
            return "skipped"
        try:
            moment = clock()
            _transition(verse, VerseStatus.PUBLISHED)
            await uow.verse_schedules.mark_published(schedule, moment)
            uow.record(
                BibleVersePublished(
                    aggregate_id=verse.id,
                    verse_id=verse.id,
                    schedule_id=schedule.id,
                    creator_id=verse.created_by,
                    verse_reference=verse.verse_reference,
                    title=verse.title,
                    published_at=moment,
                    trigger="scheduled",
                )
            )
            await uow.commit()
        except Exception as exc:  # noqa: BLE001 - per-item isolation (BR-11)
            logger.exception("Scheduled publication failed for schedule %s", schedule_id)
            await uow.rollback()
            async with UnitOfWork.create(session_factory) as failure_uow:
                retry_schedule = await failure_uow.verse_schedules.get_by_id(schedule_id)
                if retry_schedule is not None:
                    await failure_uow.verse_schedules.mark_failed(
                        retry_schedule, f"{type(exc).__name__}: {exc}"
                    )
                await failure_uow.commit()
            return "failed"
        return "published"
