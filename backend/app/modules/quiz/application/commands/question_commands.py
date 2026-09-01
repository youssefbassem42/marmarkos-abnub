"""Question + option command use cases (P5-025, D-13, BR-19/BR-20)."""

import uuid

from app.core.exceptions import InvalidReorderError, NotFoundError
from app.modules.quiz.application.commands.permissions import assert_manager
from app.modules.quiz.application.dto.question_dto import (
    CreateQuestionRequest,
    ReorderQuestionsRequest,
    UpdateQuestionRequest,
)
from app.modules.quiz.infrastructure.persistence.models import (
    QuizOption,
    QuizQuestion,
)
from app.modules.quiz.infrastructure.persistence.question_repository import OptionDiff
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def _get_quiz_question(uow: UnitOfWork, question_id: uuid.UUID) -> QuizQuestion:
    question = await uow.quiz_questions.get_by_id(question_id)
    if question is None:
        raise NotFoundError("Question not found")
    return question


async def create_question(
    uow: UnitOfWork, actor: User, quiz_id: uuid.UUID, payload: CreateQuestionRequest
) -> QuizQuestion:
    """Append one question at the end with its options (P5-025)."""
    assert_manager(actor)
    if await uow.quizzes.get_by_id(quiz_id) is None:
        raise NotFoundError("Quiz not found")
    question = QuizQuestion(
        quiz_id=quiz_id,
        question=payload.question,
        points=payload.points,
        position=await uow.quiz_questions.next_position(quiz_id),
    )
    await uow.quiz_questions.add(question)
    for opt in payload.options:
        uow.session.add(
            QuizOption(
                question_id=question.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                position=opt.position or 1,
            )
        )
    await uow.session.flush()
    await uow.quizzes.recompute_total_points(quiz_id)
    return question


async def update_question(
    uow: UnitOfWork, actor: User, question_id: uuid.UUID, payload: UpdateQuestionRequest
) -> QuizQuestion:
    """PATCH /quiz-questions/{id} — full options array is diffed (D-13)."""
    assert_manager(actor)
    question = await _get_quiz_question(uow, question_id)
    if payload.question is not None:
        question.question = payload.question
    if payload.points is not None:
        question.points = payload.points
    if payload.options is not None:
        desired = [
            OptionDiff(
                id=opt.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
            )
            for opt in payload.options
        ]
        await _apply_options(uow, question.id, desired)
    await uow.quizzes.recompute_total_points(question.quiz_id)
    return question


async def _apply_options(
    uow: UnitOfWork, question_id: uuid.UUID, desired: list[OptionDiff]
) -> None:
    """Delegate the D-13 diff to the option repository."""
    await uow.quiz_options.replace_for_question(question_id, desired)


async def delete_question(
    uow: UnitOfWork, actor: User, question_id: uuid.UUID
) -> None:
    """Hard delete; questions are not user-visible history."""
    assert_manager(actor)
    question = await _get_quiz_question(uow, question_id)
    quiz_id = question.quiz_id
    await uow.quiz_questions.delete(question)
    await uow.quizzes.recompute_total_points(quiz_id)


async def duplicate_question(
    uow: UnitOfWork, actor: User, question_id: uuid.UUID
) -> QuizQuestion:
    """Append a copy of the question (and options) at the end."""
    assert_manager(actor)
    question = await _get_quiz_question(uow, question_id)
    source = await uow.quiz_questions.get_with_options(question_id)
    assert source is not None
    position = await uow.quiz_questions.next_position(question.quiz_id)
    clone = QuizQuestion(
        quiz_id=question.quiz_id,
        question=source.question,
        points=source.points,
        position=position,
    )
    await uow.quiz_questions.add(clone)
    for opt in source.options:
        uow.session.add(
            QuizOption(
                question_id=clone.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                position=opt.position,
            )
        )
    await uow.session.flush()
    await uow.quizzes.recompute_total_points(question.quiz_id)
    return clone


async def reorder_questions(
    uow: UnitOfWork, actor: User, quiz_id: uuid.UUID, payload: ReorderQuestionsRequest
) -> None:
    """Rewrite positions from a permutation of the quiz's question ids."""
    assert_manager(actor)
    if await uow.quizzes.get_by_id(quiz_id) is None:
        raise NotFoundError("Quiz not found")
    existing = await uow.quiz_questions.list_for_quiz(quiz_id)
    existing_ids = {q.id for q in existing}
    if set(payload.question_ids) != existing_ids or len(payload.question_ids) != len(
        existing_ids
    ):
        raise InvalidReorderError("question_ids must be a permutation of the quiz's questions")
    await uow.quiz_questions.reorder(quiz_id, payload.question_ids)
