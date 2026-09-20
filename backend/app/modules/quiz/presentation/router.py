"""API routers for quizzes (Part 1 §5.4–§5.5).

Content management lives on ``/quizzes`` + ``/quiz-questions``; member
attempt routes on ``/quiz-attempts``; analytics live on ``/quizzes/{id}/analytics``.
"""

from typing import Annotated
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.config import settings
from app.core.database import get_unit_of_work
from app.core.pagination import Page, PageParams
from app.modules.auth.presentation.dependencies import get_current_user
from app.modules.bible.presentation.dependencies import BibleManager
from app.modules.quiz.application.commands.attempt_commands import (
    resume_attempt_use_case,
    save_answer_use_case,
    start_attempt,
    submit_attempt_use_case,
)
from app.modules.quiz.application.commands.permissions import assert_manager
from app.modules.quiz.application.commands.question_commands import (
    create_question,
    delete_question,
    duplicate_question,
    reorder_questions,
    update_question,
)
from app.modules.quiz.application.commands.quiz_commands import (
    archive_quiz,
    create_quiz,
    publish_quiz,
    update_quiz,
)
from app.modules.quiz.application.dto.attempt_dto import (
    AttemptResumeResponse,
    AttemptResultResponse,
    AttemptStartResponse,
    SaveAnswerRequest,
    StartAttemptRequest,
)
from app.modules.quiz.application.dto.question_dto import (
    CreateQuestionRequest,
    ReorderQuestionsRequest,
    UpdateQuestionRequest,
)
from app.modules.quiz.application.dto.quiz_dto import (
    CreateQuizRequest,
    QuestionResponse,
    QuizAdminItem,
    QuizDetailResponse,
    QuizValidationResponse,
    UpdateQuizRequest,
)
from app.modules.quiz.application.queries.attempt_queries import result_query
from app.modules.quiz.application.queries.quiz_queries import (
    quiz_by_verse_query,
    quiz_detail_query,
    quiz_list_query,
    quiz_validation_query,
)
from app.modules.quiz.application.queries.quiz_analytics_query import (
    quiz_analytics_query,
    quiz_analytics_users_query,
    quiz_analytics_users_export,
    manager_attempt_review_query,
)
from app.modules.quiz.application.queries.quiz_overview_query import (
    quiz_analytics_overview_query,
)
from app.modules.quiz.application.dto.analytics_dto import (
    QuizAnalyticsResponse,
    QuizUserResultItem,
    ManagerAttemptReviewResponse,
)
from app.modules.quiz.presentation.dependencies import CurrentUser
from app.modules.quiz.presentation.mappers import question_to_response
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

quiz_router = APIRouter(prefix="/quizzes", tags=["Quizzes"])
question_router = APIRouter(prefix="/quiz-questions", tags=["Quizzes"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]
_Page = Annotated[int, Query(ge=1, description="1-based page number")]
_Size = Annotated[
    int, Query(ge=1, le=settings.QUIZ_ANALYTICS_MAX_PAGE_SIZE, description="Items per page")
]


@quiz_router.get("", responses={403: {"description": "Insufficient permissions"}})
async def list_quizzes(
    actor: BibleManager,
    uow: _UoW,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    verse_id: UUID | None = None,
    page: _Page = 1,
    size: _Size = settings.QUIZ_ANALYTICS_PAGE_SIZE,
) -> Page[QuizAdminItem]:
    """Manager quiz table with filters and pagination (§5.4)."""
    return await quiz_list_query(
        uow, actor, PageParams(page=page, size=size), status=status_filter, q=q, verse_id=verse_id
    )


@quiz_router.post("", status_code=status.HTTP_201_CREATED)
async def create_quiz_endpoint(
    payload: CreateQuizRequest, actor: BibleManager, uow: _UoW
) -> QuizDetailResponse:
    """BR-18: at most one quiz per verse."""
    quiz = await create_quiz(uow, actor, payload)
    await uow.commit()
    return await quiz_detail_query(uow, actor, quiz.id)


@quiz_router.get("/by-verse/{verse_id}", responses={404: {"description": "Quiz not found"}})
async def get_quiz_by_verse(verse_id: UUID, actor: BibleManager, uow: _UoW) -> QuizDetailResponse:
    return await quiz_by_verse_query(uow, actor, verse_id)


@quiz_router.get("/{quiz_id}", responses={404: {"description": "Quiz not found"}})
async def get_quiz(quiz_id: UUID, actor: BibleManager, uow: _UoW) -> QuizDetailResponse:
    return await quiz_detail_query(uow, actor, quiz_id)


@quiz_router.patch("/{quiz_id}", responses={404: {"description": "Quiz not found"}})
async def patch_quiz(
    quiz_id: UUID, payload: UpdateQuizRequest, actor: BibleManager, uow: _UoW
) -> QuizDetailResponse:
    await update_quiz(uow, actor, quiz_id, payload)
    await uow.commit()
    return await quiz_detail_query(uow, actor, quiz_id)


@quiz_router.delete("/{quiz_id}", status_code=204)
async def delete_quiz(quiz_id: UUID, actor: BibleManager, uow: _UoW):
    """D-11: archive (soft delete)."""
    await archive_quiz(uow, actor, quiz_id)
    await uow.commit()


@quiz_router.post("/{quiz_id}/publish", responses={422: {"description": "quiz_not_publishable"}})
async def publish_quiz_endpoint(
    quiz_id: UUID, actor: BibleManager, uow: _UoW
) -> QuizDetailResponse:
    await publish_quiz(uow, actor, quiz_id)
    await uow.commit()
    return await quiz_detail_query(uow, actor, quiz_id)


@quiz_router.get("/{quiz_id}/validation")
async def get_quiz_validation(
    quiz_id: UUID, actor: BibleManager, uow: _UoW
) -> QuizValidationResponse:
    return await quiz_validation_query(uow, actor, quiz_id)


# -- questions ----------------------------------------------


@quiz_router.post("/{quiz_id}/questions", status_code=201)
async def add_question_endpoint(
    quiz_id: UUID, payload: CreateQuestionRequest, actor: BibleManager, uow: _UoW
) -> QuestionResponse:
    question = await create_question(uow, actor, quiz_id, payload)
    await uow.commit()
    loaded = await uow.quiz_questions.get_with_options(question.id)
    assert loaded is not None
    return question_to_response(loaded)


@quiz_router.put("/{quiz_id}/questions/reorder")
async def reorder_quiz_questions(
    quiz_id: UUID, payload: ReorderQuestionsRequest, actor: BibleManager, uow: _UoW
):
    await reorder_questions(uow, actor, quiz_id, payload)
    await uow.commit()


@question_router.patch("/{question_id}", responses={404: {"description": "Question not found"}})
async def patch_question(
    question_id: UUID, payload: UpdateQuestionRequest, actor: BibleManager, uow: _UoW
) -> QuestionResponse:
    question = await update_question(uow, actor, question_id, payload)
    await uow.commit()
    loaded = await uow.quiz_questions.get_with_options(question.id)
    assert loaded is not None
    return question_to_response(loaded)


@question_router.delete("/{question_id}", status_code=204)
async def delete_question_endpoint(question_id: UUID, actor: BibleManager, uow: _UoW):
    await delete_question(uow, actor, question_id)
    await uow.commit()


@question_router.post("/{question_id}/duplicate", status_code=201)
async def duplicate_question_endpoint(
    question_id: UUID, actor: BibleManager, uow: _UoW
) -> QuestionResponse:
    clone = await duplicate_question(uow, actor, question_id)
    await uow.commit()
    loaded = await uow.quiz_questions.get_with_options(clone.id)
    assert loaded is not None
    return question_to_response(loaded)


attempt_router = APIRouter(prefix="/quiz-attempts", tags=["Quizzes"])


@attempt_router.post("", status_code=201)
async def start_attempt_endpoint(
    payload: StartAttemptRequest, viewer: CurrentUser, uow: _UoW
) -> AttemptStartResponse:
    """P5-028: begin the single attempt per user+quiz (D-4, BR-24)."""
    result = await start_attempt(uow, viewer, payload.quiz_id)
    await uow.commit()
    return result


@attempt_router.get("/{attempt_id}")
async def get_attempt_status(
    attempt_id: UUID, viewer: CurrentUser, uow: _UoW
) -> AttemptResumeResponse:
    """P5-029: resume own attempt; cross-user access → 404."""
    return await resume_attempt_use_case(uow, viewer, attempt_id)


@attempt_router.put("/{attempt_id}/answers/{question_id}", status_code=204)
async def save_answer_endpoint(
    attempt_id: UUID,
    question_id: UUID,
    payload: SaveAnswerRequest,
    viewer: CurrentUser,
    uow: _UoW,
):
    """BR-26: upsert the current selection."""
    await save_answer_use_case(uow, viewer, attempt_id, question_id, payload.selected_option_id)
    await uow.commit()


@attempt_router.post("/{attempt_id}/submit")
async def submit_attempt_endpoint(
    attempt_id: UUID, viewer: CurrentUser, uow: _UoW
) -> AttemptResultResponse:
    """P5-031: grade + award; idempotent (BR-29)."""
    result = await submit_attempt_use_case(uow, viewer, attempt_id)
    await uow.commit()
    return result


@attempt_router.get("/{attempt_id}/result")
async def get_attempt_result(
    attempt_id: UUID, viewer: CurrentUser, uow: _UoW
) -> AttemptResultResponse:
    """Owner-only graded result for reloads (BR-29, §10)."""
    return await result_query(uow, viewer, attempt_id)


# -- Analytics (P5-034, §5.7) -------------------------------------------


@quiz_router.get("/analytics/overview")
async def quiz_analytics_overview(
    actor: BibleManager, uow: _UoW
) -> dict[str, object]:
    """Aggregate quiz stats for the admin dashboard (P5-057)."""
    assert_manager(actor)
    return await quiz_analytics_overview_query(uow)


@quiz_router.get("/{quiz_id}/analytics")
async def quiz_analytics(quiz_id: UUID, actor: BibleManager, uow: _UoW) -> QuizAnalyticsResponse:
    """Manager KPIs, score distribution and completion status for a quiz."""
    return await quiz_analytics_query(uow, actor, quiz_id)


@quiz_router.get("/{quiz_id}/analytics/users")
async def quiz_analytics_users(
    quiz_id: UUID,
    actor: BibleManager,
    uow: _UoW,
    q: Annotated[str | None, Query(max_length=200)] = None,
    score_min: int | None = None,
    score_max: int | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: _Page = 1,
    size: _Size = settings.QUIZ_ANALYTICS_PAGE_SIZE,
) -> Page[QuizUserResultItem]:
    """Filtered/sorted user results table."""
    return await quiz_analytics_users_query(
        uow,
        actor,
        quiz_id,
        PageParams(page=page, size=size),
        q=q,
        score_min=score_min,
        score_max=score_max,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )


@attempt_router.get("/{attempt_id}/review")
async def get_attempt_review(
    attempt_id: UUID, actor: BibleManager, uow: _UoW
) -> ManagerAttemptReviewResponse:
    """Manager view of one attempt incl. user + question review."""
    return await manager_attempt_review_query(uow, actor, attempt_id)


# -- CSV Export (P5-036, BR-40) ---------------------------------------------


@quiz_router.get("/{quiz_id}/analytics/export")
async def quiz_analytics_export(
    quiz_id: UUID,
    actor: BibleManager,
    uow: _UoW,
    q: Annotated[str | None, Query(max_length=200)] = None,
    score_min: int | None = None,
    score_max: int | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    """CSV export of the quiz results table (P5-036, BR-40)."""
    from app.core.csv import stream_csv

    rows, header = await quiz_analytics_users_export(
        uow,
        actor,
        quiz_id,
        q=q,
        score_min=score_min,
        score_max=score_max,
        status=status,
        date_from=date_from,
        date_to=date_to,
        max_rows=settings.ANALYTICS_EXPORT_MAX_ROWS,
    )
    return stream_csv(rows, header, f"quiz_{quiz_id}_results.csv")
