"""Batch auto-finish of expired attempts (BR-30, P5-031 groundwork).

The scheduler tick claims expired ``IN_PROGRESS`` attempts and grades
whatever answers were stored before expiry — analytics never wait for
the member to come back. Submit-after-expiry (member path) reuses the
same grading with status AUTO_FINISHED.
"""

import logging
from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.time.clock import now_utc
from app.modules.quiz.application.services.grading_service import grade
from app.modules.quiz.domain.enums import AttemptStatus
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


async def auto_finish_expired(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    limit: int = 50,
    now: Callable[[], datetime] | None = None,
) -> dict[str, int]:
    """Finalise expired attempts; returns {auto_finished, failed}."""
    clock = now or now_utc
    reference = clock()

    claimed: list[UUID] = []
    async with UnitOfWork.create(session_factory) as claimer:
        attempts = await claimer.quiz_attempts.claim_expired(limit=limit, now=reference)
        claimed = [attempt.id for attempt in attempts]

    finished = failed = 0
    for attempt_id in claimed:
        if await _finish_one(session_factory, attempt_id, clock):
            finished += 1
        else:
            failed += 1
    return {"auto_finished": finished, "failed": failed}


async def _finish_one(
    session_factory: async_sessionmaker[AsyncSession],
    attempt_id: UUID,
    clock: Callable[[], datetime],
) -> bool:
    from sqlalchemy import select

    from app.core.time.clock import to_local
    from app.core.time.periods import iso_week_start, month_start
    from app.modules.quiz.infrastructure.persistence.models import (
        QuizAnswer,
        QuizQuestion,
    )

    async with UnitOfWork.create(session_factory) as uow:
        attempt = await uow.quiz_attempts.get_by_id(attempt_id)
        if attempt is None or attempt.status is not AttemptStatus.IN_PROGRESS:
            return True  # someone else finished it; not a failure

        questions = (
            await uow.session.execute(
                select(QuizQuestion).where(QuizQuestion.quiz_id == attempt.quiz_id)
            )
        ).scalars().all()
        question_ids = [question.id for question in questions]
        correct_map = await uow.quiz_options.get_correct_option_ids(question_ids)
        stored = await uow.quiz_answers.answers_for_questions(attempt_id, question_ids)

        graded = grade(
            questions=[{"id": q.id, "points": q.points} for q in questions],
            correct_option_ids=correct_map,
            answers={qid: answer.selected_option_id for qid, answer in stored.items()},
            answer_ids={qid: answer.id for qid, answer in stored.items()},
            total_points_override=attempt.total_points,
        )

        # Persist per-answer grading fields.
        for row in graded.rows:
            answer = stored.get(row.question_id)
            if answer is None:
                uow.session.add(
                    QuizAnswer(
                        attempt_id=attempt.id,
                        question_id=row.question_id,
                        selected_option_id=row.selected_option_id,
                        is_correct=row.is_correct,
                        points_awarded=row.points_awarded,
                    )
                )
            else:
                answer.is_correct = row.is_correct
                answer.points_awarded = row.points_awarded
                answer.graded_at = clock()

        finished_at = clock()
        await uow.quiz_attempts.finalise(
            attempt,
            status=AttemptStatus.AUTO_FINISHED,
            finished_at=finished_at,
            score=graded.score,
            correct_count=graded.correct_count,
            incorrect_count=graded.incorrect_count,
        )

        # BR-31/BR-35: even zero-score attempts create one ledger row so
        # completion counts come from the same source.
        local_day = to_local(finished_at).date()
        await uow.point_transactions.award(
            user_id=attempt.user_id,
            quiz_attempt_id=attempt.id,
            points=graded.score,
            period_week_start=iso_week_start(local_day),
            period_month=month_start(local_day),
            awarded_at=finished_at,
        )
        await uow.commit()
        return True
