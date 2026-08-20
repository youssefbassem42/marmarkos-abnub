"""Weekly Bible verse persistence and uniqueness tests."""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.database import async_session_factory
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


def _monday(today: date) -> date:
    return today - timedelta(days=today.weekday())


async def test_verse_creation(uow: UnitOfWork) -> None:
    admin = await make_user(uow, "verse-admin@example.com")
    await uow.commit()

    verse = BibleVerse(
        verse_reference="John 3:16",
        text="For God so loved the world...",
        translation="NIV",
        week_start_date=_monday(date.today()),
        is_published=True,
        published_at=datetime.now(UTC),
        created_by=admin.id,
    )
    await uow.bible_verses.add(verse)
    await uow.commit()

    stored = await uow.bible_verses.get_published_for_week(verse.week_start_date)
    assert stored is not None
    assert stored.verse_reference == "John 3:16"


async def test_only_one_published_verse_per_week(uow: UnitOfWork) -> None:
    week = _monday(date.today())
    await uow.bible_verses.add(
        BibleVerse(
            verse_reference="Ps 23:1",
            text="The Lord is my shepherd",
            week_start_date=week,
            is_published=True,
        )
    )
    await uow.commit()

    with pytest.raises(IntegrityError):
        async with UnitOfWork.create(async_session_factory) as second:
            await second.bible_verses.add(
                BibleVerse(
                    verse_reference="Ps 23:2",
                    text="He makes me lie down",
                    week_start_date=week,
                    is_published=True,
                )
            )
            await second.commit()


async def test_drafts_for_same_week_allowed(uow: UnitOfWork) -> None:
    week = _monday(date.today())
    await uow.bible_verses.add(
        BibleVerse(verse_reference="Draft A", text="...", week_start_date=week, is_published=False)
    )
    await uow.commit()
    await uow.bible_verses.add(
        BibleVerse(verse_reference="Draft B", text="...", week_start_date=week, is_published=False)
    )
    await uow.commit()

    current = await uow.bible_verses.get_current_published(date.today())
    assert current is None


async def test_get_current_published_returns_latest_week(uow: UnitOfWork) -> None:
    this_week = _monday(date.today())
    last_week = this_week - timedelta(days=7)
    await uow.bible_verses.add(
        BibleVerse(verse_reference="Old", text="...", week_start_date=last_week, is_published=True)
    )
    await uow.commit()
    await uow.bible_verses.add(
        BibleVerse(verse_reference="New", text="...", week_start_date=this_week, is_published=True)
    )
    await uow.commit()

    current = await uow.bible_verses.get_current_published(date.today())
    assert current is not None
    assert current.verse_reference == "New"
