"""Bible verse persistence (P5-005).

The manager list and member feed are served by SQL-level filtering,
sorting and pagination; read-state and quiz-state maps are separate
grouped queries so lists never N+1.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.infrastructure.persistence.models import BibleVerse


@dataclass(frozen=True, slots=True)
class VerseAdminFilters:
    """Manager list filters (Part 1 §5.1 GET /bible-verses)."""

    status: VerseStatus | None = None
    q: str | None = None
    created_by: uuid.UUID | None = None
    date_from: date | None = None
    date_to: date | None = None
    has_quiz: bool | None = None
    sort: str = "created_at"
    order: str = "desc"


@dataclass(frozen=True, slots=True)
class PublishedFilters:
    """Member feed filters (Part 1 §5.3 GET /bible-verses/published)."""

    q: str | None = None
    read: str = "all"  # all | read | unread
    has_quiz: bool | None = None
    user_id: uuid.UUID | None = None  # required for read/unread filtering


_SORT_COLUMNS = {
    "published_at": BibleVerse.published_at,
    # Schedules live in another table; updated_at approximates recency.
    "scheduled_at": BibleVerse.updated_at,
    "created_at": BibleVerse.created_at,
    "title": BibleVerse.title,
}


def _apply_admin_filters(
    stmt: Select[tuple[Any]], filters: VerseAdminFilters
) -> Select[tuple[Any]]:
    if filters.status is not None:
        stmt = stmt.where(BibleVerse.status == filters.status)
    if filters.q:
        pattern = f"%{filters.q}%"
        stmt = stmt.where(
            or_(
                BibleVerse.title.ilike(pattern),
                BibleVerse.verse_reference.ilike(pattern),
            )
        )
    if filters.created_by is not None:
        stmt = stmt.where(BibleVerse.created_by == filters.created_by)
    if filters.date_from is not None:
        stmt = stmt.where(func.date(BibleVerse.created_at) >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(func.date(BibleVerse.created_at) <= filters.date_to)
    if filters.has_quiz is not None:
        from app.modules.quiz.infrastructure.persistence.models import Quiz

        quiz_join = select(Quiz.id).where(Quiz.verse_id == BibleVerse.id).exists()
        stmt = stmt.where(quiz_join if filters.has_quiz else ~quiz_join)
    return stmt


def _apply_published_filters(
    stmt: Select[tuple[Any]], filters: PublishedFilters
) -> Select[tuple[Any]]:
    from app.modules.bible.infrastructure.persistence.models import VerseRead

    stmt = stmt.where(BibleVerse.status == VerseStatus.PUBLISHED)
    if filters.q:
        pattern = f"%{filters.q}%"
        stmt = stmt.where(
            or_(BibleVerse.title.ilike(pattern), BibleVerse.verse_reference.ilike(pattern))
        )
    if filters.has_quiz is not None:
        from app.modules.quiz.domain.enums import QuizStatus
        from app.modules.quiz.infrastructure.persistence.models import Quiz

        any_quiz = select(Quiz.id).where(Quiz.verse_id == BibleVerse.id).exists()
        published_quiz = (
            select(Quiz.id)
            .where(Quiz.verse_id == BibleVerse.id, Quiz.status == QuizStatus.PUBLISHED)
            .exists()
        )
        # True filters on a *published* quiz (member-facing availability);
        # False excludes verses that have any quiz at all.
        stmt = stmt.where(published_quiz if filters.has_quiz else ~any_quiz)
    if filters.read in ("read", "unread") and filters.user_id is not None:
        read_exists = select(1).where(
            VerseRead.verse_id == BibleVerse.id, VerseRead.user_id == filters.user_id
        )
        stmt = (
            stmt.where(read_exists.exists())
            if filters.read == "read"
            else stmt.where(~read_exists.exists())
        )
    return stmt


class BibleVerseRepository:
    """Persistence for verses across the manager, member and scheduler paths."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, verse: BibleVerse) -> None:
        self._session.add(verse)
        await self._session.flush()

    async def get_by_id(self, verse_id: uuid.UUID) -> BibleVerse | None:
        result = await self._session.execute(
            select(BibleVerse)
            .where(BibleVerse.id == verse_id)
            .options(selectinload(BibleVerse.created_by_user))
        )
        return result.scalar_one_or_none()

    async def set_status(
        self,
        verse: BibleVerse,
        status: VerseStatus,
        *,
        published_at: datetime | None = None,
        week_start_date: date | None = None,
    ) -> None:
        """Apply a lifecycle transition (BR-4/BR-5); publish metadata is
        written only on the first transition into PUBLISHED."""
        verse.status = status
        if status is VerseStatus.PUBLISHED and verse.published_at is None:
            verse.published_at = published_at
            verse.week_start_date = week_start_date
        await self._session.flush()

    # -- manager listing ---------------------------------------------------

    async def list_for_manager(
        self, filters: VerseAdminFilters, limit: int, offset: int
    ) -> list[BibleVerse]:
        stmt = _apply_admin_filters(select(BibleVerse), filters)
        column = _SORT_COLUMNS.get(filters.sort, BibleVerse.created_at)
        order = column.desc() if filters.order == "desc" else column.asc()
        stmt = (
            stmt.options(selectinload(BibleVerse.created_by_user))
            .order_by(order, BibleVerse.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_for_manager(self, filters: VerseAdminFilters) -> int:
        stmt = _apply_admin_filters(select(func.count()).select_from(BibleVerse), filters)
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def status_counts(self) -> dict[VerseStatus, int]:
        """KPI counts for all four statuses in one grouped query."""
        result = await self._session.execute(
            select(BibleVerse.status, func.count()).group_by(BibleVerse.status)
        )
        counts = {status: int(count) for status, count in result.all()}
        return {
            status: counts.get(status, 0) for status in VerseStatus
        }

    # -- legacy helpers kept for compatibility -----------------------------

    async def get_published_for_week(self, week_start_date: date) -> BibleVerse | None:
        result = await self._session.execute(
            select(BibleVerse).where(
                BibleVerse.week_start_date == week_start_date,
                BibleVerse.status == VerseStatus.PUBLISHED,
            )
        )
        return result.scalar_one_or_none()

    async def get_current_published(self, today: date | None = None) -> BibleVerse | None:
        """The newest PUBLISHED verse ("This Week", D-2)."""
        stmt = (
            select(BibleVerse)
            .where(BibleVerse.status == VerseStatus.PUBLISHED)
            .order_by(BibleVerse.published_at.desc())
            .limit(1)
        )
        if today is not None:
            stmt = stmt.where(BibleVerse.week_start_date <= today)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_published(
        self,
        filters: PublishedFilters,
        limit: int,
        offset: int,
    ) -> list[BibleVerse]:
        stmt = _apply_published_filters(select(BibleVerse), filters)
        stmt = stmt.order_by(BibleVerse.published_at.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_published(self, filters: PublishedFilters) -> int:
        stmt = _apply_published_filters(
            select(func.count()).select_from(BibleVerse), filters
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())
