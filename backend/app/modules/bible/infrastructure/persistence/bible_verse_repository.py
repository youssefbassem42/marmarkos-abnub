import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.bible.infrastructure.persistence.models import BibleVerse


class BibleVerseRepository:
    """Weekly Bible verse persistence.

    At most one published verse per week is enforced by a partial unique
    index (drafts for the same week remain possible).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, verse: BibleVerse) -> None:
        self._session.add(verse)
        await self._session.flush()

    async def get_by_id(self, verse_id: uuid.UUID) -> BibleVerse | None:
        result = await self._session.execute(select(BibleVerse).where(BibleVerse.id == verse_id))
        return result.scalar_one_or_none()

    async def get_published_for_week(self, week_start_date: date) -> BibleVerse | None:
        result = await self._session.execute(
            select(BibleVerse).where(
                BibleVerse.week_start_date == week_start_date,
                BibleVerse.is_published.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_current_published(self, today: date) -> BibleVerse | None:
        result = await self._session.execute(
            select(BibleVerse)
            .where(
                BibleVerse.is_published.is_(True),
                BibleVerse.week_start_date <= today,
            )
            .order_by(BibleVerse.week_start_date.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_published(self, limit: int = 20, offset: int = 0) -> list[BibleVerse]:
        result = await self._session.execute(
            select(BibleVerse)
            .where(BibleVerse.is_published.is_(True))
            .order_by(BibleVerse.week_start_date.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
