"""Quiz attempt command use cases (P5-028..P5-031, V2 timing).

V2: there is no wall-clock deadline and nothing auto-finishes an attempt.
An attempt only ends when the member presses submit. ``budget_remaining_seconds``
is charged only for wall time the member spends actively in the quiz (bounded
heartbeat gaps), so the clock is paused whenever they are away. Grading writes
immutable snapshots (BR-22/BR-27) and awarding is idempotent via the ledger's
unique ``quiz_attempt_id`` (BR-29/BR-31).
"""

import asyncio
import logging
import uuid
from datetime import datetime

from sqlalchemy import select

from app.core.exceptions import (
    AttemptBudgetExhaustedError,
    AttemptExistsError,
    AttemptFinishedError,
    InvalidOptionError,
    NotFoundError,
    QuizNotAvailableError,
    VerseNotReadError,
)
from app.core.time.clock import now_utc, to_local
from app.core.time.periods import iso_week_start, month_start
from app.modules.quiz.application.dto.attempt_dto import (
    AttemptHeartbeatResponse,
    AttemptResumeResponse,
    AttemptResultResponse,
    AttemptStartResponse,
    TakeQuestionItem,
    TakeOptionItem,
)
from app.modules.quiz.application.services.grading_service import grade
from app.modules.quiz.domain.enums import AttemptStatus, QuizStatus
from app.modules.quiz.infrastructure.persistence.models import (
    Quiz,
    QuizAnswer,
    QuizAttempt,
    QuizQuestion,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)

# Largest gap between heartbeats still counted as "actively taking the quiz".
# Anything larger means the tab was hidden/closed (or the client crashed) —
# the clock is paused, so that wall time is never charged.
HEARTBEAT_WINDOW_SECONDS = 30


def _charge_active_time(attempt: QuizAttempt, now: datetime | None = None) -> None:
    """Burn active-time budget for wall time spent in the quiz (V2).

    Only consecutive heartbeats inside ``HEARTBEAT_WINDOW_SECONDS`` charge
    budget. A longer gap means the member was away/crashed — the clock was
    paused — so the missed wall time is dropped and the heartbeat simply
    re-anchors the timer.
    """
    if attempt.status is not AttemptStatus.IN_PROGRESS:
        return
    now = now or now_utc()
    last = attempt.last_heartbeat_at
    if last is None:
        attempt.last_heartbeat_at = now
        return
    gap = (now - last).total_seconds()
    if 0 < gap <= HEARTBEAT_WINDOW_SECONDS:
        attempt.budget_remaining_seconds = max(0, attempt.budget_remaining_seconds - int(gap))
    attempt.last_heartbeat_at = now


async def _own_attempt(
    uow: UnitOfWork, attempt_id: uuid.UUID, user_id: uuid.UUID
) -> QuizAttempt:
    """Own attempt only; cross-user access → 404 (security gate)."""
    attempt = await uow.quiz_attempts.get_by_id(attempt_id)
    if attempt is None or attempt.user_id != user_id:
        raise NotFoundError("Attempt not found")
    return attempt


async def _member_gate(uow: UnitOfWork, quiz: Quiz, user_id: uuid.UUID) -> None:
    """BR-21/BR-14/BR-24 gating on the take path."""
    if quiz.status is not QuizStatus.PUBLISHED:
        raise QuizNotAvailableError("Quiz is not available")
    if not await uow.verse_reads.has_read(quiz.verse_id, user_id):
        raise VerseNotReadError("Verse must be marked read before starting the quiz")


async def _take_question(
    question: QuizQuestion, selected: uuid.UUID | None, answered: bool
) -> TakeQuestionItem:
    opts = sorted(question.options, key=lambda o: o.position)
    return TakeQuestionItem(
        id=question.id,
        question=question.question,
        points=question.points,
        position=question.position,
        answered=answered,
        selected_option_id=selected,
        options=[
            TakeOptionItem(id=o.id, option_text=o.option_text, position=o.position)
            for o in opts
        ],
    )


async def start_attempt(
    uow: UnitOfWork, actor: User, quiz_id: uuid.UUID
) -> AttemptStartResponse:
    """P5-028: begin the single attempt per user+quiz (D-4, V2)."""
    quiz = await uow.quizzes.get_by_id(quiz_id)
    if quiz is None:
        raise NotFoundError("Quiz not found")
    await _member_gate(uow, quiz, actor.id)

    existing = await uow.quiz_attempts.get_for_user_and_quiz(quiz_id, actor.id)
    if existing is not None:
        # One attempt per user+quiz forever (D-4). An in-progress attempt is
        # resumed (its clock is paused whenever the member is away), and a
        # submitted attempt is a one-shot result — never overwritten. Nothing
        # is auto-finished anymore (V2).
        raise AttemptExistsError(
            "An attempt already exists for this quiz",
            data={"attempt_id": str(existing.id)},
        )

    questions = await _load_questions_with_options(uow, quiz.id)
    if not questions:
        raise QuizNotAvailableError("Quiz has no questions")

    now = now_utc()
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=actor.id,
        started_at=now,
        status=AttemptStatus.IN_PROGRESS,
        budget_remaining_seconds=quiz.duration_seconds,
        last_heartbeat_at=now,
        duration_seconds=quiz.duration_seconds,
        total_points=quiz.total_points,
        question_count=len(questions),
    )
    await uow.quiz_attempts.add(attempt)

    items = await asyncio.gather(*[_take_question(q, selected=None, answered=False) for q in questions])
    return AttemptStartResponse(
        id=attempt.id,
        quiz_id=quiz.id,
        started_at=now,
        remaining_seconds=attempt.budget_remaining_seconds,
        server_time=now,
        duration_seconds=quiz.duration_seconds,
        total_points=quiz.total_points,
        question_count=len(items),
        questions=items,
    )


async def _load_questions_with_options(
    uow: UnitOfWork, quiz_id: uuid.UUID
) -> list[QuizQuestion]:
    """Questions with their options eager-loaded (single query)."""
    from sqlalchemy.orm import selectinload

    result = await uow.session.execute(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz_id)
        .options(selectinload(QuizQuestion.options))
        .order_by(QuizQuestion.position, QuizQuestion.created_at, QuizQuestion.id)
    )
    return list(result.scalars().all())


async def resume_attempt_use_case(
    uow: UnitOfWork, actor: User, attempt_id: uuid.UUID
) -> AttemptResumeResponse:
    """P5-029: reload own in-progress attempt with stored selections."""
    attempt = await _own_attempt(uow, attempt_id, actor.id)
    _charge_active_time(attempt)
    quiz = await uow.quizzes.get_by_id(attempt.quiz_id)
    if quiz is None:
        raise NotFoundError("Quiz not found")
    questions = await _load_questions_with_options(uow, quiz.id)
    stored = {
        a.question_id: a
        for a in await uow.quiz_answers.list_for_attempt(attempt.id)
    }
    now = now_utc()
    return AttemptResumeResponse(
        id=attempt.id,
        quiz_id=attempt.quiz_id,
        started_at=attempt.started_at,
        remaining_seconds=attempt.budget_remaining_seconds,
        server_time=now,
        duration_seconds=attempt.duration_seconds,
        total_points=attempt.total_points,
        question_count=attempt.question_count,
        status=attempt.status,
        questions=list(
            await asyncio.gather(
                *[
                    _take_question(
                        q,
                        selected=(stored[q.id].selected_option_id if q.id in stored else None),
                        answered=(q.id in stored),
                    )
                    for q in questions
                ]
            )
        ),
    )


async def heartbeat_attempt_use_case(
    uow: UnitOfWork, actor: User, attempt_id: uuid.UUID
) -> AttemptHeartbeatResponse:
    """V2: anchor the active-time budget while the member is in the quiz."""
    attempt = await _own_attempt(uow, attempt_id, actor.id)
    _charge_active_time(attempt)
    return AttemptHeartbeatResponse(
        attempt_id=attempt.id,
        status=attempt.status,
        remaining_seconds=attempt.budget_remaining_seconds,
        server_time=now_utc(),
    )


async def save_answer_use_case(
    uow: UnitOfWork,
    actor: User,
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
    selected_option_id: uuid.UUID,
) -> AttemptHeartbeatResponse:
    """BR-26: upsert the current selection; grading untouched until submit."""
    attempt = await _own_attempt(uow, attempt_id, actor.id)
    await _enforce_answerable(attempt)
    _charge_active_time(attempt)
    if attempt.budget_remaining_seconds <= 0:
        raise AttemptBudgetExhaustedError("The active time budget is exhausted")
    if not await uow.quiz_options.option_belongs_to_question(question_id, selected_option_id):
        raise InvalidOptionError("Option does not belong to the question")
    await uow.quiz_answers.upsert(attempt.id, question_id, selected_option_id)
    return AttemptHeartbeatResponse(
        attempt_id=attempt.id,
        status=attempt.status,
        remaining_seconds=attempt.budget_remaining_seconds,
        server_time=now_utc(),
    )


async def _enforce_answerable(attempt: QuizAttempt) -> None:
    """Reject writes to finished attempts (BR-27). Saves are otherwise always
    allowed while the budget lasts; only a manual submit ends the quiz (V2)."""
    if attempt.status is not AttemptStatus.IN_PROGRESS:
        raise AttemptFinishedError("Attempt is already finished")


async def _finalise_attempt(uow: UnitOfWork, attempt: QuizAttempt) -> None:
    """Grade stored selections and write the immutable snapshot + award.

    Only a manual submit reaches here (V2 — nothing auto-finishes an attempt).
    Idempotent at the ledger level (BR-29/BR-31), so a concurrent second
    submit cannot double-award.
    """
    questions = await _load_questions_with_options(uow, attempt.quiz_id)
    question_ids = [q.id for q in questions]
    correct_map = await uow.quiz_options.get_correct_option_ids(question_ids)
    stored = await uow.quiz_answers.answers_for_questions(attempt.id, question_ids)

    graded = grade(
        questions=[{"id": q.id, "points": q.points} for q in questions],
        correct_option_ids=correct_map,
        answers={qid: a.selected_option_id for qid, a in stored.items()},
        answer_ids={qid: a.id for qid, a in stored.items()},
        total_points_override=attempt.total_points,
    )

    finished_at = now_utc()

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
                    graded_at=finished_at,
                )
            )
        else:
            answer.is_correct = row.is_correct
            answer.points_awarded = row.points_awarded
            answer.graded_at = finished_at

    await uow.quiz_attempts.finalise(
        attempt,
        status=AttemptStatus.COMPLETED,
        finished_at=finished_at,
        submitted_at=finished_at,
        score=graded.score,
        correct_count=graded.correct_count,
        incorrect_count=graded.incorrect_count,
    )

    local_day = to_local(finished_at).date()
    await uow.point_transactions.award(
        user_id=attempt.user_id,
        quiz_attempt_id=attempt.id,
        points=graded.score,
        period_week_start=iso_week_start(local_day),
        period_month=month_start(local_day),
        awarded_at=finished_at,
    )


async def submit_attempt_use_case(
    uow: UnitOfWork, actor: User, attempt_id: uuid.UUID
) -> AttemptResultResponse:
    """P5-031: grade + award; idempotent (BR-29). Submit is the ONLY way an
    attempt ends (V2); it is always allowed while in progress, even after the
    active-time budget runs out."""
    attempt = await _own_attempt(uow, attempt_id, actor.id)
    _charge_active_time(attempt)
    if attempt.status is AttemptStatus.IN_PROGRESS:
        await _finalise_attempt(uow, attempt)
    from app.modules.quiz.application.queries.attempt_queries import _build_result

    return await _build_result(uow, attempt)
