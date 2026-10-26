"""Quiz content query use cases (P5-026, §5.4/§5.5)."""

import uuid

from app.core.exceptions import NotFoundError
from app.core.pagination import Page, PageParams
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.quiz.application.commands.permissions import assert_manager
from app.modules.quiz.application.dto.quiz_dto import (
    QuestionOptionResponse,
    QuestionResponse,
    QuizAdminItem,
    QuizDetailResponse,
    QuizValidationResponse,
)
from app.modules.quiz.domain.enums import QuizStatus
from app.modules.quiz.infrastructure.persistence.models import (
    Quiz,
    QuizOption,
    QuizQuestion,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

_STATUS_VALUES = {s.value for s in QuizStatus}


def _serialize_option(option: QuizOption, *, include_correct: bool) -> QuestionOptionResponse:
    return QuestionOptionResponse(
        id=option.id,
        option_text=option.option_text,
        is_correct=option.is_correct,
        position=option.position,
    )


def _serialize_question(question: QuizQuestion, *, include_correct: bool) -> QuestionResponse:
    return QuestionResponse(
        id=question.id,
        question=question.question,
        points=question.points,
        position=question.position,
        options=[
            _serialize_option(opt, include_correct=include_correct)
            for opt in sorted(question.options, key=lambda o: o.position)
        ],
    )


async def _admin_item(uow: UnitOfWork, quiz: Quiz) -> QuizAdminItem:
    verse = await uow.session.get(BibleVerse, quiz.verse_id)
    question_count = await uow.quiz_questions.count_for_quiz(quiz.id)
    return QuizAdminItem(
        id=quiz.id,
        title=quiz.title,
        verse_id=quiz.verse_id,
        verse_reference=verse.verse_reference if verse else "",
        total_points=quiz.total_points,
        duration_seconds=quiz.duration_seconds,
        question_count=question_count,
        status=quiz.status,
        published_at=quiz.published_at,
        created_at=quiz.created_at,
    )


async def quiz_list_query(
    uow: UnitOfWork,
    actor: User,
    page: PageParams,
    *,
    status: str | None = None,
    q: str | None = None,
    verse_id: uuid.UUID | None = None,
) -> Page[QuizAdminItem]:
    assert_manager(actor)
    status_enum = QuizStatus(status) if status else None
    quizzes, total = await uow.quizzes.list_for_manager(
        status=status_enum,
        q=q,
        verse_id=verse_id,
        limit=page.size,
        offset=page.offset,
    )
    items = [await _admin_item(uow, quiz) for quiz in quizzes]
    return Page.build(items, total, page)


async def quiz_detail_query(uow: UnitOfWork, actor: User, quiz_id: uuid.UUID) -> QuizDetailResponse:
    """Manager detail with questions incl. correctness."""
    assert_manager(actor)
    quiz = await uow.quizzes.get_with_questions(quiz_id)
    if quiz is None:
        raise NotFoundError("Quiz not found")
    verse = await uow.session.get(BibleVerse, quiz.verse_id)
    return QuizDetailResponse(
        id=quiz.id,
        title=quiz.title,
        verse_id=quiz.verse_id,
        verse_reference=verse.verse_reference if verse else "",
        total_points=quiz.total_points,
        duration_seconds=quiz.duration_seconds,
        question_count=len(quiz.questions),
        status=quiz.status,
        published_at=quiz.published_at,
        created_at=quiz.created_at,
        description=quiz.description,
        questions=[_serialize_question(q, include_correct=True) for q in quiz.questions],
    )


async def quiz_validation_query(
    uow: UnitOfWork, actor: User, quiz_id: uuid.UUID
) -> QuizValidationResponse:
    from app.modules.quiz.application.commands.quiz_commands import (
        validate_quiz_use_case,
    )

    is_ok, rules = await validate_quiz_use_case(uow, actor, quiz_id)
    return QuizValidationResponse(is_publishable=is_ok, rules=rules)


async def quiz_by_verse_query(
    uow: UnitOfWork, actor: User, verse_id: uuid.UUID
) -> QuizDetailResponse:
    return await quiz_detail_query_by_verse(uow, actor, verse_id)


async def quiz_detail_query_by_verse(
    uow: UnitOfWork, actor: User, verse_id: uuid.UUID
) -> QuizDetailResponse:
    assert_manager(actor)
    quiz = await uow.quizzes.get_by_verse(verse_id)
    if quiz is None:
        raise NotFoundError("Quiz not found")
    loaded = await uow.quizzes.get_with_questions(quiz.id)
    if loaded is None:
        raise NotFoundError("Quiz not found")
    return await quiz_detail_query(uow, actor, quiz.id)
