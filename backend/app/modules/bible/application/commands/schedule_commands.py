"""Scheduling use cases (P5-013, BR-8/BR-9/BR-12)."""

import uuid
from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ConflictError, InvalidScheduleError
from app.core.time.clock import now_utc, platform_timezone
from app.modules.bible.application.commands.verse_commands import assert_manager
from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.infrastructure.persistence.models import (
    BibleVerse,
    VersePublicationSchedule,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

MAX_SCHEDULE_HORIZON = timedelta(days=730)  # BR-8: ≤ 2 years out


def to_utc(value: datetime) -> datetime:
    """Naive values are interpreted in the platform timezone (BR-12)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=platform_timezone())
    return value


def validate_scheduled_at(scheduled_at: datetime, *, now: datetime | None = None) -> datetime:
    """BR-8: strictly future at request time and ≤ 2 years out."""
    reference = now if now is not None else now_utc()
    moment = to_utc(scheduled_at)
    if moment <= reference:
        raise InvalidScheduleError()
    if moment - reference > MAX_SCHEDULE_HORIZON:
        raise InvalidScheduleError("You cannot schedule a post more than two years ahead")
    return moment


async def schedule_verse(
    uow: UnitOfWork,
    actor: User,
    verse_id: uuid.UUID,
    scheduled_at: datetime,
) -> VersePublicationSchedule:
    """Queue one future publication; the verse becomes SCHEDULED."""
    assert_manager(actor)
    verse = await uow.bible_verses.get_by_id(verse_id)
    if verse is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Verse not found")
    if verse.status not in (VerseStatus.DRAFT, VerseStatus.SCHEDULED):
        from app.core.exceptions import InvalidStatusTransitionError

        raise InvalidStatusTransitionError(
            "Only draft or already-scheduled verses can be scheduled",
            data={"status": verse.status.value},
        )

    moment = validate_scheduled_at(scheduled_at)

    existing = await uow.verse_schedules.get_active_for_verse(verse.id)
    if existing is not None:
        # BR-9: re-scheduling updates the active row.
        existing.scheduled_at = moment
        verse.status = VerseStatus.SCHEDULED
        await uow.audit.record(
            action="bible_verse.reschedule",
            entity_type="bible_verse",
            entity_id=str(verse.id),
            actor_user_id=actor.id,
            metadata={"scheduled_at": moment.isoformat()},
        )
        await uow.session.flush()
        return existing

    schedule = VersePublicationSchedule(
        verse_id=verse.id,
        scheduled_at=moment,
        created_by=actor.id,
    )
    try:
        await uow.verse_schedules.add(schedule)
    except IntegrityError as exc:
        # Lost a race against a concurrent schedule for the same verse.
        raise ConflictError("This verse already has an active schedule") from exc
    verse.status = VerseStatus.SCHEDULED
    await uow.audit.record(
        action="bible_verse.schedule",
        entity_type="bible_verse",
        entity_id=str(verse.id),
        actor_user_id=actor.id,
        metadata={"scheduled_at": moment.isoformat()},
    )
    return schedule


async def cancel_schedule(uow: UnitOfWork, actor: User, verse_id: uuid.UUID) -> BibleVerse:
    """Delegate to the shared verse command (cancel → DRAFT)."""
    from app.modules.bible.application.commands.verse_commands import cancel_schedule

    return await cancel_schedule(uow, actor, verse_id)
