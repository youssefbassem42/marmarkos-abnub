"""Question and option persistence (P5-006, D-13, BR-19/BR-20)."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.quiz.infrastructure.persistence.models import QuizOption, QuizQuestion


@dataclass(frozen=True, slots=True)
class OptionDiff:
    """One desired option state inside a full-options-array save (D-13).

    ``id`` is None for new options; present options are matched by id,
    missing ones deleted, positions renumbered from 1 afterwards.
    """

    id: uuid.UUID | None
    option_text: str
    is_correct: bool


class QuizQuestionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, question: QuizQuestion) -> None:
        self._session.add(question)
        await self._session.flush()

    async def get_by_id(self, question_id: uuid.UUID) -> QuizQuestion | None:
        result = await self._session.execute(
            select(QuizQuestion).where(QuizQuestion.id == question_id)
        )
        return result.scalar_one_or_none()

    async def get_with_options(self, question_id: uuid.UUID) -> QuizQuestion | None:
        result = await self._session.execute(
            select(QuizQuestion)
            .where(QuizQuestion.id == question_id)
            .options(selectinload(QuizQuestion.options))
        )
        return result.scalar_one_or_none()

    async def list_for_quiz(
        self, quiz_id: uuid.UUID, *, with_options: bool = False
    ) -> Sequence[QuizQuestion]:
        stmt = (
            select(QuizQuestion)
            .where(QuizQuestion.quiz_id == quiz_id)
            .order_by(QuizQuestion.position, QuizQuestion.created_at, QuizQuestion.id)
        )
        if with_options:
            stmt = stmt.options(selectinload(QuizQuestion.options))
        return (await self._session.execute(stmt)).scalars().all()

    async def count_for_quiz(self, quiz_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count()).where(QuizQuestion.quiz_id == quiz_id)
        )
        return int(result.scalar_one())

    async def next_position(self, quiz_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.coalesce(func.max(QuizQuestion.position), 0)).where(
                QuizQuestion.quiz_id == quiz_id
            )
        )
        return int(result.scalar_one()) + 1

    async def reorder(self, quiz_id: uuid.UUID, ordered_ids: Sequence[uuid.UUID]) -> None:
        """Rewrite all positions in a single UPDATE … CASE statement."""
        mapping: dict[uuid.UUID, int] = {qid: pos for pos, qid in enumerate(ordered_ids, start=1)}
        if not mapping:
            return
        await self._session.execute(
            update(QuizQuestion)
            .where(QuizQuestion.quiz_id == quiz_id, QuizQuestion.id.in_(mapping))
            .values(position=case(mapping, value=QuizQuestion.id))
        )
        await self._session.flush()

    async def delete(self, question: QuizQuestion) -> None:
        await self._session.delete(question)
        await self._session.flush()


class QuizOptionRepository:
    """Options are managed inside the question payload (D-13)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def replace_for_question(
        self, question_id: uuid.UUID, desired: Sequence[OptionDiff]
    ) -> list[QuizOption]:
        """Diff the submitted option array in one transaction.

        Untouched options keep their database ids so member answers and
        analytics stay stable across edits.
        """
        existing = (
            (await self._session.execute(
                select(QuizOption)
                .where(QuizOption.question_id == question_id)
                .order_by(QuizOption.position)
            ))
            .scalars()
            .all()
        )
        existing_by_id = {option.id: option for option in existing}

        kept_ids: set[uuid.UUID] = set()
        for position, item in enumerate(desired, start=1):
            if item.id is not None and item.id in existing_by_id:
                row = existing_by_id[item.id]
                row.option_text = item.option_text
                row.is_correct = item.is_correct
                row.position = position
                kept_ids.add(item.id)
            else:
                self._session.add(
                    QuizOption(
                        question_id=question_id,
                        option_text=item.option_text,
                        is_correct=item.is_correct,
                        position=position,
                    )
                )
        for row in existing:
            if row.id not in kept_ids:
                await self._session.delete(row)
        await self._session.flush()

        refreshed = (
            (await self._session.execute(
                select(QuizOption)
                .where(QuizOption.question_id == question_id)
                .order_by(QuizOption.position)
            ))
            .scalars()
            .all()
        )
        return list(refreshed)

    async def get_correct_option_ids(
        self, question_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, uuid.UUID]:
        """Correct option per question in one query (grading path, BR-28)."""
        if not question_ids:
            return {}
        rows = await self._session.execute(
            select(QuizOption.question_id, QuizOption.id).where(
                QuizOption.question_id.in_(question_ids), QuizOption.is_correct.is_(True)
            )
        )
        return {question_id: option_id for question_id, option_id in rows.all()}

    async def options_exist_for_questions(
        self, question_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, int]:
        if not question_ids:
            return {}
        rows = await self._session.execute(
            select(QuizOption.question_id, func.count())
            .where(QuizOption.question_id.in_(question_ids))
            .group_by(QuizOption.question_id)
        )
        return {qid: int(count) for qid, count in rows.all()}

    async def option_belongs_to_question(
        self, question_id: uuid.UUID, option_id: uuid.UUID
    ) -> bool:
        """BR-26: the submitted option must belong to the question."""
        result = await self._session.execute(
            select(QuizOption.id).where(
                QuizOption.id == option_id, QuizOption.question_id == question_id
            )
        )
        return result.first() is not None
