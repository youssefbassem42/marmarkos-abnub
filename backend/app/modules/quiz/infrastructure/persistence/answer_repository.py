"""Quiz answer persistence (P5-006, BR-26, BR-28)."""

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.quiz.infrastructure.persistence.models import QuizAnswer


class QuizAnswerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(
        self, attempt_id: uuid.UUID, question_id: uuid.UUID, option_id: uuid.UUID
    ) -> datetime:
        """Store/replace the current selection; grading untouched (BR-26)."""
        stmt = (
            pg_insert(QuizAnswer)
            .values(
                attempt_id=attempt_id,
                question_id=question_id,
                selected_option_id=option_id,
                answered_at=func.now(),
            )
            .on_conflict_do_update(
                index_elements=["attempt_id", "question_id"],
                set_={"selected_option_id": option_id, "answered_at": func.now()},
            )
            .returning(QuizAnswer.answered_at)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def list_for_attempt(self, attempt_id: uuid.UUID) -> Sequence[QuizAnswer]:
        result = await self._session.execute(
            select(QuizAnswer).where(QuizAnswer.attempt_id == attempt_id)
        )
        return result.scalars().all()

    async def delete_for_attempt(self, attempt_id: uuid.UUID) -> None:
        """Wipe all answers for an abandoned attempt (ghost recovery)."""
        await self._session.execute(
            delete(QuizAnswer).where(QuizAnswer.attempt_id == attempt_id)
        )

    async def has_selected_answers(self, attempt_id: uuid.UUID) -> bool:
        """Any real (non-null) selection recorded for the attempt.

        Distinguishes a genuine take from an empty ghost: lazy auto-finish
        writes one row per question (selected_option_id NULL), so counting
        rows would misclassify empty attempts as real ones.
        """
        result = await self._session.execute(
            select(func.count()).where(
                QuizAnswer.attempt_id == attempt_id,
                QuizAnswer.selected_option_id.is_not(None),
            )
        )
        return int(result.scalar_one() or 0) > 0

    async def grade_bulk(
        self,
        *,
        rows: list[dict[str, object]],
        graded_at: datetime,
    ) -> None:
        """Persist grading fields for stored answers in bulk (BR-28).

        Each row: {answer_id, is_correct, points_awarded}.
        """
        if not rows:
            return
        await self._session.execute(
            update(QuizAnswer),
            [
                {
                    "id": row["answer_id"],
                    "is_correct": row["is_correct"],
                    "points_awarded": row["points_awarded"],
                    "graded_at": graded_at,
                }
                for row in rows
            ],
        )

    async def answers_for_questions(
        self, attempt_id: uuid.UUID, question_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, QuizAnswer]:
        if not question_ids:
            return {}
        result = await self._session.execute(
            select(QuizAnswer).where(
                QuizAnswer.attempt_id == attempt_id, QuizAnswer.question_id.in_(question_ids)
            )
        )
        return {answer.question_id: answer for answer in result.scalars().all()}
