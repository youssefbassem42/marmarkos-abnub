"""Bible module persistence tests (P5-005).

Covers the verse lifecycle columns, the partial unique index on active
schedules, verse-read uniqueness, FK cascade behaviour, and the
engagement dedupe/upsert primitives.
"""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.core.database import async_session_factory
from app.modules.bible.domain.enums import ScheduleStatus, VerseStatus
from app.modules.bible.infrastructure.persistence.models import (
    BibleVerse,
    VersePublicationSchedule,
    VerseView,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


def _monday(today: date) -> date:
    return today - timedelta(days=today.weekday())


async def _verse(uow: UnitOfWork, **overrides: object) -> BibleVerse:
    defaults: dict = dict(
        title="Psalm 23",
        verse_reference="Psalm 23:1",
        book="Psalms",
        chapter=23,
        verse_start=1,
        text="The Lord is my shepherd",
    )
    defaults.update(overrides)
    verse = BibleVerse(**defaults)
    await uow.bible_verses.add(verse)
    return verse


async def test_verse_status_defaults_to_draft(uow: UnitOfWork) -> None:
    verse = await _verse(uow)
    await uow.commit()
    assert verse.status is VerseStatus.DRAFT
    assert verse.published_at is None
    assert verse.week_start_date is None


async def test_verse_chapter_check_rejects_out_of_range(uow: UnitOfWork) -> None:
    with pytest.raises(IntegrityError):
        await _verse(uow, chapter=0)
        await uow.commit()
    await uow.rollback()


async def test_verse_range_check_requires_end_after_start(uow: UnitOfWork) -> None:
    with pytest.raises(IntegrityError):
        await _verse(uow, verse_start=5, verse_end=2)
        await uow.commit()
    await uow.rollback()


async def test_multiple_published_verses_allowed_per_week(uow: UnitOfWork) -> None:
    """D-2: the weekly unique index was dropped."""
    week = _monday(date.today())
    await _verse(
        uow,
        status=VerseStatus.PUBLISHED,
        published_at=datetime.now(UTC),
        week_start_date=week,
    )
    await uow.commit()
    await _verse(
        uow,
        title="Second",
        verse_reference="John 3:16",
        book="John",
        chapter=3,
        status=VerseStatus.PUBLISHED,
        published_at=datetime.now(UTC),
        week_start_date=week,
    )
    await uow.commit()

    current = await uow.bible_verses.get_current_published()
    assert current is not None


async def test_only_one_active_schedule_per_verse(uow: UnitOfWork) -> None:
    """BR-9: the partial unique index rejects a second SCHEDULED row."""
    verse = await _verse(uow)
    await uow.commit()
    await uow.verse_schedules.add(
        VersePublicationSchedule(verse_id=verse.id, scheduled_at=datetime.now(UTC))
    )
    await uow.commit()

    with pytest.raises(IntegrityError):
        async with UnitOfWork.create(async_session_factory) as second:
            await second.verse_schedules.add(
                VersePublicationSchedule(
                    verse_id=verse.id, scheduled_at=datetime.now(UTC) + timedelta(days=1)
                )
            )
            await second.commit()


async def test_cancelled_schedule_frees_slot_for_new_one(uow: UnitOfWork) -> None:
    verse = await _verse(uow)
    await uow.commit()
    first = VersePublicationSchedule(verse_id=verse.id, scheduled_at=datetime.now(UTC))
    await uow.verse_schedules.add(first)
    await uow.commit()

    await uow.verse_schedules.mark_cancelled(first)
    await uow.commit()

    second = VersePublicationSchedule(
        verse_id=verse.id, scheduled_at=datetime.now(UTC) + timedelta(days=2)
    )
    await uow.verse_schedules.add(second)
    await uow.commit()
    assert second.status is ScheduleStatus.SCHEDULED


async def test_verse_reads_unique_pair(uow: UnitOfWork) -> None:
    """BR-14: one read per user/verse; repeats are idempotent."""
    user = await make_user(uow, "reader@example.com")
    verse = await _verse(uow)
    await uow.commit()

    inserted_at, already = await uow.verse_reads.mark_read(verse.id, user.id)
    await uow.commit()
    assert already is False
    assert inserted_at is not None

    _, already_again = await uow.verse_reads.mark_read(verse.id, user.id)
    await uow.commit()
    assert already_again is True


async def test_verse_view_dedupe_window(uow: UnitOfWork) -> None:
    """D-16: a second open inside the dedupe window inserts no row."""
    user = await make_user(uow, "opener@example.com")
    verse = await _verse(uow)
    await uow.commit()

    first = await uow.verse_views.record_open(
        verse.id, user.id, dedupe_seconds=settings.VERSE_OPEN_DEDUPE_SECONDS
    )
    await uow.commit()
    assert first is True

    second = await uow.verse_views.record_open(
        verse.id, user.id, dedupe_seconds=settings.VERSE_OPEN_DEDUPE_SECONDS
    )
    await uow.commit()
    assert second is False


async def test_cascade_delete_removes_engagement_and_schedules(uow: UnitOfWork) -> None:
    user = await make_user(uow, "cascade@example.com")
    verse = await _verse(uow)
    await uow.commit()
    await uow.verse_schedules.add(
        VersePublicationSchedule(verse_id=verse.id, scheduled_at=datetime.now(UTC))
    )
    await uow.verse_reads.mark_read(verse.id, user.id)
    await uow.verse_views.record_open(verse.id, user.id, dedupe_seconds=300)
    await uow.commit()

    await uow.session.execute(delete(BibleVerse).where(BibleVerse.id == verse.id))
    await uow.commit()

    schedules = await uow.session.execute(
        select(VersePublicationSchedule).where(
            VersePublicationSchedule.verse_id == verse.id
        )
    )
    views = await uow.session.execute(select(VerseView).where(VerseView.verse_id == verse.id))
    assert schedules.first() is None
    assert views.first() is None
