"""Quiz attempt query use cases (P5-029/031).

Result/review assembly for finished attempts, owner-only (BR-28, §10).
Cross-user access is denied with 404.
"""

import uuid

from app.core.exceptions import NotFoundError
from app.core.time.clock import now_utc, today_local, to_local
from app.core.time.periods import iso_week_start, month_start
from app.modules.quiz.application.dto.attempt_dto import (
    AttemptResumeResponse,
    AttemptResultResponse,
    GradedOptionItem,
    PointsSnapshot,
    ReviewQuestionItem,
    TakeQuestionItem,
    TakeOptionItem,
)
from app.modules.quiz.domain.enums import AttemptStatus
from app.modules.quiz.infrastructure.persistence.models import (
    Quiz,
    QuizAnswer,
    QuizAttempt,
    QuizOption,
    QuizQuestion,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def _own_attempt(
    uow: UnitOfWork, attempt_id: uuid.UUID, user_id: uuid.UUID
) -> QuizAttempt:
    attempt = await uow.quiz_attempts.get_by_id(attempt_id)
    if attempt is None or attempt.user_id != user_id:
        raise NotFoundError("Attempt not found")
    return attempt


async def _load_questions(uow: UnitOfWork, quiz_id: uuid.UUID) -> list[QuizQuestion]:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.modules.quiz.infrastructure.persistence.models import QuizQuestion

    result = await uow.session.execute(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz_id)
        .options(selectinload(QuizQuestion.options))
        .order_by(QuizQuestion.position, QuizQuestion.created_at, QuizQuestion.id)
    )
    return list(result.scalars().all())


async def result_query(
    uow: UnitOfWork, actor: User, attempt_id: uuid.UUID
) -> AttemptResultResponse:
    """GET /quiz-attempts/{id}/result — graded result for a finished
    attempt owned by the caller. Idempotent on reload (BR-29)."""
    attempt = await _own_attempt(uow, attempt_id, actor.id)
    if attempt.status is AttemptStatus.IN_PROGRESS:
        raise NotFoundError("Attempt is not finished")
    return await _build_result(uow, attempt)


async def _build_result(
    uow: UnitOfWork, attempt: QuizAttempt
) -> AttemptResultResponse:
    quiz = await uow.quizzes.get_by_id(attempt.quiz_id)
    if quiz is None:
        raise NotFoundError("Quiz not found")
    questions = await _load_questions(uow, attempt.quiz_id)
    correct_map = await uow.quiz_options.get_correct_option_ids([q.id for q in questions])
    answers = await uow.quiz_answers.answers_for_questions(
        attempt.id, [q.id for q in questions]
    )

    review = [
        ReviewQuestionItem(
            question_id=q.id,
            position=q.position,
            question=q.question,
            points=q.points,
            selected_option_id=a.selected_option_id if q.id in answers else None,
            correct_option_id=correct_map.get(q.id),
            is_correct=(answers[q.id].is_correct if q.id in answers else False),
            points_awarded=(answers[q.id].points_awarded if q.id in answers else 0),
            options=[
                GradedOptionItem(
                    id=o.id,
                    option_text=o.option_text,
                    position=o.position,
                    is_correct=o.is_correct,
                )
                for o in sorted(q.options, key=lambda x: x.position)
            ],
        )
        for q in questions
    ]

    today = today_local()
    totals = await uow.point_transactions.totals_for_user(attempt.user_id, today=today)
    # This attempt's award is already reflected in `totals` (same tx).
    # Compute "before" by subtracting this attempt's ledger points when
    # the award landed in the current week/month buckets.
    attempt_pts = attempt.score
    local_finish = to_local(attempt.finished_at).date()
    in_week = iso_week_start(local_finish) == iso_week_start(today)
    in_month = month_start(local_finish) == month_start(today)

    points = PointsSnapshot(
        week_before=totals["this_week"] - (attempt_pts if in_week else 0),
        week_after=totals["this_week"],
        month_before=totals["this_month"] - (attempt_pts if in_month else 0),
        month_after=totals["this_month"],
        lifetime_before=totals["lifetime"] - attempt_pts,
        lifetime_after=totals["lifetime"],
    )

    score_out_of_10 = (
        round(attempt.score / attempt.total_points * 10, 1) if attempt.total_points else 0.0
    )
    percentage = (
        round(attempt.score / attempt.total_points * 100, 1) if attempt.total_points else 0.0
    )
    time_taken = max(0, int((attempt.finished_at - attempt.started_at).total_seconds()))

    return AttemptResultResponse(
        attempt_id=attempt.id,
        quiz_id=attempt.quiz_id,
        verse_id=quiz.verse_id,
        status=attempt.status,
        score=attempt.score,
        total_points=attempt.total_points,
        score_out_of_10=score_out_of_10,
        percentage=percentage,
        correct_count=attempt.correct_count,
        incorrect_count=attempt.incorrect_count,
        question_count=attempt.question_count,
        points_awarded=attempt_pts,
        finished_at=attempt.finished_at,
        time_taken_seconds=time_taken,
        points=points,
        review=review,
    )
