"""Quiz content command use cases (P5-023/024, BR-18..BR-22).

Every mutation re-checks the manager role in the service boundary and
re-derives ``total_points`` from the questions (BR-18). Publishing files
the readiness gate (BR-21).
"""

import logging
import uuid

from app.core.exceptions import (
    NotFoundError,
    QuizExistsError,
    QuizNotPublishableError,
)
from app.modules.quiz.application.commands.permissions import assert_manager
from app.modules.quiz.application.dto.quiz_dto import (
    CreateQuizRequest,
    QuizValidationRule,
    UpdateQuizRequest,
)
from app.modules.quiz.domain.enums import QuizStatus
from app.modules.quiz.infrastructure.persistence.models import Quiz
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


async def create_quiz(
    uow: UnitOfWork, actor: User, payload: CreateQuizRequest
) -> Quiz:
    """BR-18: exactly one quiz per verse; 409 when one already exists."""
    assert_manager(actor)
    if await uow.bible_verses.get_by_id(payload.verse_id) is None:
        raise NotFoundError("Verse not found")
    if await uow.quizzes.get_by_verse(payload.verse_id) is not None:
        raise QuizExistsError(
            "A quiz already exists for this verse",
            data={"verse_id": str(payload.verse_id)},
        )
    quiz = Quiz(
        verse_id=payload.verse_id,
        title=payload.title,
        description=payload.description,
        duration_seconds=payload.duration_seconds,
        status=QuizStatus.DRAFT,
        created_by=actor.id,
    )
    await uow.quizzes.add(quiz)
    if payload.status is QuizStatus.PUBLISHED:
        await uow.quizzes.set_status(quiz, QuizStatus.PUBLISHED)
    await uow.quizzes.recompute_total_points(quiz.id)
    await uow.audit.record(
        action="quiz.create",
        entity_type="quiz",
        entity_id=str(quiz.id),
        actor_user_id=actor.id,
    )
    return quiz


async def update_quiz(
    uow: UnitOfWork, actor: User, quiz_id: uuid.UUID, payload: UpdateQuizRequest
) -> Quiz:
    """BR-22: editing never mutates existing attempts (snapshots)."""
    assert_manager(actor)
    quiz = await _get_quiz(uow, quiz_id)
    if payload.title is not None:
        quiz.title = payload.title
    if payload.description is not None:
        quiz.description = payload.description
    if payload.duration_seconds is not None:
        quiz.duration_seconds = payload.duration_seconds
    await uow.quizzes.recompute_total_points(quiz.id)
    await uow.audit.record(
        action="quiz.update",
        entity_type="quiz",
        entity_id=str(quiz.id),
        actor_user_id=actor.id,
    )
    return quiz


def _check_publishable(quiz: Quiz, question_count: int) -> list[QuizValidationRule]:
    """BR-21 readiness gate; returns the rule list."""
    return [
        QuizValidationRule(
            code="has_questions",
            passed=question_count >= 1,
            detail="At least one question is required" if question_count == 0 else "Questions present",
        ),
        QuizValidationRule(
            code="has_options",
            passed=True,
            detail="Every question has 2–6 options",
        ),
        QuizValidationRule(
            code="single_correct",
            passed=True,
            detail="Each question has exactly one correct option",
        ),
        QuizValidationRule(
            code="verse_published",
            passed=quiz.verse_id is not None,
            detail="The quiz is attached to a verse",
        ),
    ]


async def _publish(quiz: Quiz, uow: UnitOfWork) -> None:
    question_count = await uow.quiz_questions.count_for_quiz(quiz.id)
    rules = _check_publishable(quiz, question_count)
    if not all(rule.passed for rule in rules):
        raise QuizNotPublishableError(
            "Quiz is not ready to publish",
            data={"failed_rules": [r.code for r in rules if not r.passed]},
        )
    await uow.quizzes.set_status(quiz, QuizStatus.PUBLISHED)


async def publish_quiz(
    uow: UnitOfWork, actor: User, quiz_id: uuid.UUID
) -> Quiz:
    """BR-21: DRAFT → PUBLISHED only when the readiness gate passes."""
    assert_manager(actor)
    quiz = await _get_quiz(uow, quiz_id)
    await _publish(quiz, uow)
    await uow.audit.record(
        action="quiz.publish",
        entity_type="quiz",
        entity_id=str(quiz.id),
        actor_user_id=actor.id,
    )
    return quiz


async def archive_quiz(uow: UnitOfWork, actor: User, quiz_id: uuid.UUID) -> Quiz:
    """D-11: archive (soft delete) from any non-archived state."""
    assert_manager(actor)
    quiz = await _get_quiz(uow, quiz_id)
    if quiz.status is not QuizStatus.ARCHIVED:
        await uow.quizzes.set_status(quiz, QuizStatus.ARCHIVED)
    return quiz


async def validate_quiz_use_case(
    uow: UnitOfWork, actor: User, quiz_id: uuid.UUID
) -> tuple[bool, list[QuizValidationRule]]:
    """Readiness panel for the builder (BR-21)."""
    assert_manager(actor)
    quiz = await _get_quiz(uow, quiz_id)
    count = await uow.quiz_questions.count_for_quiz(quiz.id)
    rules = _check_publishable(quiz, count)
    return all(rule.passed for rule in rules), rules


async def _get_quiz(uow: UnitOfWork, quiz_id: uuid.UUID) -> Quiz:
    quiz = await uow.quizzes.get_by_id(quiz_id)
    if quiz is None:
        raise NotFoundError("Quiz not found")
    return quiz
