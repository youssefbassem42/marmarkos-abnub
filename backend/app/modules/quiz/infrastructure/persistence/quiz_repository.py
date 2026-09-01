"""Quiz persistence (P5-006, P5-035)."""

import uuid
from datetime import date

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.quiz.domain.enums import QuizStatus
from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizQuestion


class QuizRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, quiz: Quiz) -> None:
        self._session.add(quiz)
        await self._session.flush()

    async def get_by_id(self, quiz_id: uuid.UUID) -> Quiz | None:
        result = await self._session.execute(select(Quiz).where(Quiz.id == quiz_id))
        return result.scalar_one_or_none()

    async def get_by_verse(self, verse_id: uuid.UUID) -> Quiz | None:
        result = await self._session.execute(select(Quiz).where(Quiz.verse_id == verse_id))
        return result.scalar_one_or_none()

    async def get_with_questions(self, quiz_id: uuid.UUID) -> Quiz | None:
        result = await self._session.execute(
            select(Quiz)
            .where(Quiz.id == quiz_id)
            .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        )
        return result.scalar_one_or_none()

    async def set_status(self, quiz: Quiz, status: QuizStatus) -> None:
        """Lifecycle write; published_at is set once on first publish."""
        quiz.status = status
        if status is QuizStatus.PUBLISHED and quiz.published_at is None:
            from app.core.time.clock import now_utc

            quiz.published_at = now_utc()
        await self._session.flush()

    async def recompute_total_points(self, quiz_id: uuid.UUID) -> int:
        """Re-derive ``total_points`` from question points in one UPDATE (BR-18)."""
        from app.modules.quiz.infrastructure.persistence.models import QuizQuestion

        total = int(
            (
                await self._session.execute(
                    select(func.coalesce(func.sum(QuizQuestion.points), 0)).where(
                        QuizQuestion.quiz_id == quiz_id
                    )
                )
            ).scalar_one()
        )
        await self._session.execute(
            update(Quiz).where(Quiz.id == quiz_id).values(total_points=total)
        )
        return total

    async def list_for_manager(
        self,
        *,
        status: QuizStatus | None,
        q: str | None,
        verse_id: uuid.UUID | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Quiz], int]:
        conditions = []
        if status is not None:
            conditions.append(Quiz.status == status)
        if q:
            pattern = f"%{q}%"
            conditions.append(or_(Quiz.title.ilike(pattern), Quiz.description.ilike(pattern)))
        if verse_id is not None:
            conditions.append(Quiz.verse_id == verse_id)
        total = int(
            (
                await self._session.execute(
                    select(func.count()).select_from(Quiz).where(*conditions)
                )
            ).scalar_one()
        )
        stmt = (
            select(Quiz)
            .where(*conditions)
            .options(selectinload(Quiz.questions))
            .order_by(Quiz.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return list(rows), total

    async def count_published_in_month(self, month: date) -> int:
        """Count quizzes whose ``published_at`` falls within the given month (P5-035)."""
        end_year = month.year + (month.month // 12)
        end_month = (month.month % 12) + 1
        next_month = date(end_year, end_month, 1)
        return int(
            (
                await self._session.execute(
                    select(func.count()).where(
                        Quiz.status == QuizStatus.PUBLISHED,
                        Quiz.published_at >= month,
                        Quiz.published_at < next_month,
                    )
                )
            ).scalar_one()
        )
