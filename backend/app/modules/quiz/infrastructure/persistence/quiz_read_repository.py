"""The read model of the quizzes for the other modules (ARCH-001).

The queries live here, in the module that owns the tables. The other
modules ask for them through the contract
(:class:`app.shared.contracts.quiz_read.QuizReadModel`), so they no
longer import the ORM models of this module.
"""

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ColumnElement, exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizAttempt
from app.shared.contracts.quiz import QuizStatus
from app.shared.contracts.quiz_read import AttemptState, QuizState


def any_quiz_for_verse(verse_column: Any) -> ColumnElement[bool]:
    """The condition "this verse has a quiz" (any status).

    The filter of the verse list needs it. The condition is built here,
    in the module that owns the table: the other module only asks for
    the condition and never mentions the quiz tables itself.

    The column is typed as ``Any`` on purpose: every module has its own
    ORM attribute type, and the condition only needs "something that can
    be compared with a column".
    """
    return exists(select(Quiz.id).where(Quiz.verse_id == verse_column))


def published_quiz_for_verse(verse_column: Any) -> ColumnElement[bool]:
    """The condition "this verse has a published quiz"."""
    return exists(
        select(Quiz.id).where(Quiz.verse_id == verse_column, Quiz.status == QuizStatus.PUBLISHED)
    )


class QuizReadRepository:
    """The read-only view of the quizzes for the other modules."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def quiz_states_by_verse(
        self, verse_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, QuizState]:
        """One grouped lookup of the quiz of every requested verse."""
        if not verse_ids:
            return {}
        rows = await self._session.execute(
            select(Quiz.verse_id, Quiz.id, Quiz.status).where(Quiz.verse_id.in_(verse_ids))
        )
        return {row[0]: QuizState(quiz_id=row[1], status=row[2]) for row in rows.all()}

    async def viewer_attempts_by_quiz(
        self, viewer_id: uuid.UUID, verse_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, AttemptState]:
        """The attempt of the member for the quizzes of the requested verses.

        One joined query; the result is keyed by the quiz id.
        """
        if not verse_ids:
            return {}
        quiz_alias = aliased(Quiz)
        stmt = (
            select(QuizAttempt.quiz_id, QuizAttempt.status)
            .join(quiz_alias, QuizAttempt.quiz_id == quiz_alias.id)
            .where(quiz_alias.verse_id.in_(verse_ids), QuizAttempt.user_id == viewer_id)
        )
        rows = await self._session.execute(stmt)
        return {row[0]: AttemptState(quiz_id=row[0], status=row[1]) for row in rows.all()}
