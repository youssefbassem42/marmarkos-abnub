"""Verse command use cases: create, update, publish, archive (P5-010).

Every mutation writes an audit row in the same transaction and re-checks
the manager role inside the service layer (defence in depth).
"""

import logging
import uuid

from app.core.exceptions import (
    InvalidStatusTransitionError,
    NotFoundError,
    ValidationError,
)
from app.core.time.clock import now_local, now_utc
from app.core.time.periods import iso_week_start
from app.modules.bible.application.dto.verse_dto import VerseCreateRequest, VerseUpdateRequest
from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.domain.events.bible_verse_published import BibleVersePublished
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)

_ALLOWED_TRANSITIONS: dict[VerseStatus, set[VerseStatus]] = {
    VerseStatus.DRAFT: {VerseStatus.PUBLISHED, VerseStatus.SCHEDULED, VerseStatus.ARCHIVED},
    VerseStatus.SCHEDULED: {VerseStatus.PUBLISHED, VerseStatus.DRAFT, VerseStatus.ARCHIVED},
    VerseStatus.PUBLISHED: {VerseStatus.ARCHIVED},
    VerseStatus.ARCHIVED: {VerseStatus.DRAFT},
}  # BR-5 + D-11: DELETE archives from any non-archived state


def assert_manager(actor: User) -> None:
    """Defence-in-depth role re-check inside the service boundary."""
    if actor.role.name not in (RoleName.ADMIN, RoleName.SERVANT):
        raise NotFoundError("Resource not found")


async def _audit(uow: UnitOfWork, actor: User | None, action: str, verse: BibleVerse) -> None:
    await uow.audit.record(
        action=action,
        entity_type="bible_verse",
        entity_id=str(verse.id),
        actor_user_id=actor.id if actor else None,
    )


def _apply_fields(verse: BibleVerse, payload: VerseCreateRequest | VerseUpdateRequest) -> None:
    for field in (
        "title",
        "subtitle",
        "verse_reference",
        "book",
        "chapter",
        "verse_start",
        "verse_end",
        "text",
        "reflection",
        "image",
        "translation",
    ):
        value = getattr(payload, field)
        if value is not None or isinstance(payload, VerseCreateRequest):
            setattr(verse, field, value)


async def create_verse(
    uow: UnitOfWork, actor: User, payload: VerseCreateRequest
) -> BibleVerse:
    """BR-1/BR-2: validated creation; optional immediate publication."""
    assert_manager(actor)
    verse = BibleVerse(
        title=payload.title,
        subtitle=payload.subtitle,
        verse_reference=payload.verse_reference,
        book=payload.book,
        chapter=payload.chapter,
        verse_start=payload.verse_start,
        verse_end=payload.verse_end,
        text=payload.text,
        reflection=payload.reflection,
        image=payload.image,
        translation=payload.translation or "NIV",
        created_by=actor.id,
    )
    await uow.bible_verses.add(verse)

    if payload.status is VerseStatus.PUBLISHED:
        _transition(verse, VerseStatus.PUBLISHED)
    await _audit(uow, actor, "bible_verse.create", verse)
    return verse


def _transition(verse: BibleVerse, target: VerseStatus) -> None:
    """Apply a status transition with the BR-4/BR-5 invariants."""
    current = verse.status
    if target not in _ALLOWED_TRANSITIONS.get(current, set()):
        raise InvalidStatusTransitionError(
            f"Cannot move a verse from {current.value} to {target.value}",
            data={"from": current.value, "to": target.value},
        )
    verse.status = target
    if target is VerseStatus.PUBLISHED and verse.published_at is None:
        published_at = now_utc()
        verse.published_at = published_at
        verse.week_start_date = iso_week_start(now_local().date())
    if target is VerseStatus.DRAFT and current is VerseStatus.ARCHIVED:
        pass  # restore keeps content untouched


async def update_verse(
    uow: UnitOfWork, actor: User, verse_id: uuid.UUID, payload: VerseUpdateRequest
) -> BibleVerse:
    """BR-7: editing a PUBLISHED verse never touches publish metadata."""
    assert_manager(actor)
    verse = await uow.bible_verses.get_by_id(verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")

    _apply_fields(verse, payload)
    if payload.status is not None and payload.status is not verse.status:
        # ARCHIVED → DRAFT is a restore; DRAFT/SCHEDULED → PUBLISHED is a
        # manual publish handled here as well.
        _transition(verse, payload.status)
    await _audit(uow, actor, "bible_verse.update", verse)
    return verse


async def archive_verse(
    uow: UnitOfWork, actor: User, verse_id: uuid.UUID
) -> BibleVerse:
    """D-11: DELETE is an archive; BR-6 cascades the quiz to ARCHIVED."""
    assert_manager(actor)
    verse = await uow.bible_verses.get_by_id(verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")
    _transition(verse, VerseStatus.ARCHIVED)

    quiz = await uow.quizzes.get_by_verse(verse.id)
    if quiz is not None:
        from app.modules.quiz.domain.enums import QuizStatus

        quiz.status = QuizStatus.ARCHIVED
    await _audit(uow, actor, "bible_verse.archive", verse)
    return verse


async def restore_verse(
    uow: UnitOfWork, actor: User, verse_id: uuid.UUID
) -> BibleVerse:
    """ARCHIVED → DRAFT (D-11 restore path)."""
    assert_manager(actor)
    verse = await uow.bible_verses.get_by_id(verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")
    _transition(verse, VerseStatus.DRAFT)
    await _audit(uow, actor, "bible_verse.restore", verse)
    return verse


async def publish_verse_now(
    uow: UnitOfWork, actor: User, verse_id: uuid.UUID, *, trigger: str = "manual"
) -> BibleVerse:
    """Publish immediately; cancels any active schedule (§5.1).

    A scheduled verse published manually still notifies the creator —
    the schedule row is completed so the tick cannot double-publish.
    """
    assert_manager(actor)
    verse = await uow.bible_verses.get_by_id(verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")
    was_scheduled = verse.status is VerseStatus.SCHEDULED
    _transition(verse, VerseStatus.PUBLISHED)

    schedule = await uow.verse_schedules.get_active_for_verse(verse.id)
    if schedule is not None:
        await uow.verse_schedules.mark_published(schedule, now_utc())

    if was_scheduled or trigger == "scheduled":
        uow.record(
            BibleVersePublished(
                aggregate_id=verse.id,
                verse_id=verse.id,
                schedule_id=schedule.id if schedule else None,
                creator_id=verse.created_by,
                verse_reference=verse.verse_reference,
                title=verse.title,
                published_at=verse.published_at or now_utc(),
                trigger="scheduled" if was_scheduled else trigger,
            )
        )
    await _audit(uow, actor, "bible_verse.publish", verse)
    return verse


async def cancel_schedule(
    uow: UnitOfWork, actor: User, verse_id: uuid.UUID
) -> BibleVerse:
    """Cancel the active schedule; the verse returns to DRAFT (BR-9)."""
    assert_manager(actor)
    verse = await uow.bible_verses.get_by_id(verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")
    schedule = await uow.verse_schedules.get_active_for_verse(verse.id)
    if schedule is None:
        raise ValidationError("This verse has no active schedule")
    await uow.verse_schedules.mark_cancelled(schedule)
    if verse.status is VerseStatus.SCHEDULED:
        verse.status = VerseStatus.DRAFT
    await _audit(uow, actor, "bible_verse.cancel_schedule", verse)
    return verse
