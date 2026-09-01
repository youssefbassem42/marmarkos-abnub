"""Scheduled-publication integration tests (P5-014 acceptance).

Covers idempotency (two sequential ticks, two concurrent ticks), skip
rules for archived verses, and the failure/retry budget (BR-11).
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from app.core.database import async_session_factory
from app.modules.bible.application.services.publication_service import publish_due
from app.modules.bible.domain.enums import ScheduleStatus, VerseStatus
from app.modules.bible.infrastructure.persistence.models import (
    BibleVerse,
    VersePublicationSchedule,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def _scheduled_verse(**overrides: object) -> tuple[BibleVerse, VersePublicationSchedule]:
    defaults: dict = dict(
        title="Psalm 23",
        verse_reference="Psalm 23:1",
        book="Psalms",
        chapter=23,
        verse_start=1,
        text="The Lord is my shepherd",
    )
    defaults.update(overrides)
    async with UnitOfWork.create(async_session_factory) as uow:
        verse = BibleVerse(**defaults)  # type: ignore[arg-type]
        await uow.bible_verses.add(verse)
        schedule = VersePublicationSchedule(
            verse_id=verse.id,
            scheduled_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        await uow.verse_schedules.add(schedule)
        verse.status = VerseStatus.SCHEDULED
        await uow.commit()
        return verse, schedule


async def test_due_verse_publishes_exactly_once_across_two_ticks() -> None:
    verse, schedule = await _scheduled_verse()

    first = await publish_due(async_session_factory)
    assert first == {"published": 1, "failed": 0, "skipped": 0}

    second = await publish_due(async_session_factory)
    assert second["published"] == 0

    async with UnitOfWork.create(async_session_factory) as uow:
        stored = await uow.bible_verses.get_by_id(verse.id)
        row = await uow.verse_schedules.get_by_id(schedule.id)
        assert stored is not None and stored.status is VerseStatus.PUBLISHED
        assert stored.published_at is not None
        # BR-4: week_start_date derived at publish time.
        assert stored.week_start_date is not None
        assert stored.week_start_date.weekday() == 0
        assert row is not None and row.status is ScheduleStatus.PUBLISHED


async def test_concurrent_ticks_publish_once_total() -> None:
    import asyncio

    await _scheduled_verse()

    results = await asyncio.gather(
        publish_due(async_session_factory),
        publish_due(async_session_factory),
    )

    total_published = sum(result["published"] for result in results)
    assert total_published == 1


async def test_archived_verse_is_skipped_not_published() -> None:
    verse, schedule = await _scheduled_verse()
    async with UnitOfWork.create(async_session_factory) as uow:
        stored = await uow.bible_verses.get_by_id(verse.id)
        assert stored is not None
        stored.status = VerseStatus.ARCHIVED
        await uow.commit()

    result = await publish_due(async_session_factory)

    assert result["skipped"] >= 1
    async with UnitOfWork.create(async_session_factory) as uow:
        row = await uow.verse_schedules.get_by_id(schedule.id)
        stored = await uow.bible_verses.get_by_id(verse.id)
        assert stored is not None and stored.status is VerseStatus.ARCHIVED
        assert row is not None and row.status is not ScheduleStatus.PUBLISHED


def _flaky_transition(fail_first_n: int):
    """Stand-in for the BR-5 transition helper: fail first N calls, then behave."""
    state = {"calls": 0}

    def _fake(verse, target):  # noqa: ANN001
        state["calls"] += 1
        if state["calls"] <= fail_first_n:
            raise RuntimeError("boom")
        verse.status = target

    return _fake


async def test_forced_failure_marks_failed_and_retries_next_tick() -> None:
    """BR-11: a failed publication retries on the next tick."""
    await _scheduled_verse()

    with patch(
        "app.modules.bible.application.commands.verse_commands._transition",
        new=_flaky_transition(fail_first_n=1),
    ):
        first = await publish_due(async_session_factory)
        assert first["failed"] == 1

        second = await publish_due(async_session_factory)
        assert second["published"] == 1

    async with UnitOfWork.create(async_session_factory) as uow:
        from sqlalchemy import select

        rows = (
            (
                await uow.session.execute(select(VersePublicationSchedule))
            )
            .scalars()
            .all()
        )
        assert rows[0].attempts == 1
        assert rows[0].status is ScheduleStatus.PUBLISHED


@pytest.mark.parametrize("failure_count", [5])
async def test_five_failures_stop_retrying(failure_count: int) -> None:
    """BR-11: after five attempts the schedule stays FAILED and stops claiming."""
    await _scheduled_verse()

    with patch(
        "app.modules.bible.application.commands.verse_commands._transition",
        new=_flaky_transition(fail_first_n=failure_count + 3),
    ):
        for expected_attempts in range(1, failure_count + 1):
            await publish_due(async_session_factory)
            async with UnitOfWork.create(async_session_factory) as uow:
                from sqlalchemy import select

                row = (await uow.session.execute(select(VersePublicationSchedule))).scalar_one()
                assert row.attempts == expected_attempts
                assert row.status is ScheduleStatus.FAILED

    # The sixth tick claims nothing new: the retry budget is exhausted.
    result = await publish_due(async_session_factory)
    assert result["published"] == 0
    assert result["failed"] == 0
