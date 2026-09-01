"""Quiz analytics query use cases (P5-034, §5.7, BR-37/BR-38, P5-036)."""

import uuid
from datetime import datetime

from sqlalchemy import select

from app.core.exceptions import NotFoundError, ExportTooLargeError
from app.core.pagination import Page, PageParams
from app.modules.quiz.application.commands.permissions import assert_manager
from app.modules.quiz.application.dto.analytics_dto import (
    AttemptUserBlock,
    CompletionStatusBucket,
    ManagerAttemptReviewResponse,
    QuizAnalyticsResponse,
    QuizUserResultItem,
    ReviewItem,
    ReviewOption,
    ScoreDistributionBucket,
)
from app.modules.quiz.domain.enums import AttemptStatus
from app.modules.quiz.infrastructure.persistence.models import (
    QuizAnswer,
    QuizOption,
    QuizQuestion,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def quiz_analytics_query(
    uow: UnitOfWork, actor: User, quiz_id: uuid.UUID
) -> QuizAnalyticsResponse:
    assert_manager(actor)
    if await uow.quizzes.get_by_id(quiz_id) is None:
        raise NotFoundError("Quiz not found")
    kpis = await uow.quiz_attempts.quiz_kpis(quiz_id)
    participants = int(kpis["participants"])
    max_possible = int(kpis["max_possible_points"])
    avg_out_10 = (
        round(float(kpis["total_points_awarded"]) / participants / max_possible * 10, 1)
        if participants and max_possible
        else 0.0
    )

    dist = await uow.quiz_attempts.score_distribution(quiz_id)
    dist_map = dict(dist)
    max_score = max(dist_map) if dist_map else 0
    densified = [
        ScoreDistributionBucket(score=s, users=dist_map.get(s, 0)) for s in range(max_score, -1, -1)
    ]

    counts = await uow.quiz_attempts.completion_status_counts(quiz_id)
    total_finished = max(sum(counts.values()), 1)
    completion = [
        CompletionStatusBucket(
            status=st,
            users=counts.get(st, 0),
            percentage=round(counts.get(st, 0) / total_finished * 100, 1),
        )
        for st in (AttemptStatus.COMPLETED, AttemptStatus.AUTO_FINISHED)
    ]

    return QuizAnalyticsResponse(
        participants=participants,
        completed=int(kpis["completed"]),
        auto_finished=int(kpis["auto_finished"]),
        average_score_out_of_10=avg_out_10,
        highest_score=int(kpis["highest_score"]),
        lowest_score=int(kpis["lowest_score"]),
        total_points_awarded=int(kpis["total_points_awarded"]),
        max_possible_points=max_possible,
        score_distribution=densified,
        completion_status=completion,
    )


async def quiz_analytics_users_query(
    uow: UnitOfWork,
    actor: User,
    quiz_id: uuid.UUID,
    page: PageParams,
    *,
    q: str | None = None,
    score_min: int | None = None,
    score_max: int | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> Page[QuizUserResultItem]:
    assert_manager(actor)
    if await uow.quizzes.get_by_id(quiz_id) is None:
        raise NotFoundError("Quiz not found")
    status_enum = AttemptStatus(status) if status else None
    rows, total = await uow.quiz_attempts.results_page(
        quiz_id,
        q=q,
        score_min=score_min,
        score_max=score_max,
        status=status_enum,
        date_from=date_from,
        date_to=date_to,
        limit=page.size,
        offset=page.offset,
    )
    items = [_result_item(row) for row in rows]
    return Page.build(items, total, page)


def _result_item(row: dict[str, object]) -> QuizUserResultItem:
    total_points = int(row["total_points"] or 0)
    score = int(row["score"] or 0)
    percentage = round(score / total_points * 100, 1) if total_points else 0.0
    return QuizUserResultItem(
        user_id=row["user_id"],
        full_name=_name(row.get("first_name"), row.get("last_name")),
        email=row.get("email") or "",
        avatar=row.get("avatar"),
        score=score,
        total_points=total_points,
        percentage=percentage,
        points_awarded=int(row["points_awarded"] or 0),
        status=row["status"],
        finished_at=row["finished_at"],
        time_taken_seconds=max(0, int((row["finished_at"] - row["started_at"]).total_seconds())),
    )


def _name(first: object, last: object) -> str:
    return " ".join(n for n in (first, last) if n).strip() or "Unknown"


async def manager_attempt_review_query(
    uow: UnitOfWork, actor: User, attempt_id: uuid.UUID
) -> ManagerAttemptReviewResponse:
    """Manager view of one finished attempt incl. the user block (P5-034)."""
    assert_manager(actor)
    mapping, user_block = await uow.quiz_attempts.manager_attempt(attempt_id)
    if mapping is None:
        raise NotFoundError("Attempt not found")
    quiz = await uow.quizzes.get_by_id(mapping["quiz_id"])
    if quiz is None:
        raise NotFoundError("Quiz not found")

    questions = (
        (
            await uow.session.execute(
                select(QuizQuestion)
                .where(QuizQuestion.quiz_id == quiz.id)
                .order_by(QuizQuestion.position)
            )
        )
        .scalars()
        .all()
    )
    question_ids = [q.id for q in questions]
    correct_map = await uow.quiz_options.get_correct_option_ids(question_ids)
    answers = await uow.quiz_answers.answers_for_questions(attempt_id, question_ids)
    options = (
        (
            await uow.session.execute(
                select(QuizOption).where(QuizOption.question_id.in_(question_ids))
            )
        )
        .scalars()
        .all()
    )
    options_by_q: dict[uuid.UUID, list[ReviewOption]] = {}
    for opt in options:
        options_by_q.setdefault(opt.question_id, []).append(
            ReviewOption(
                id=opt.id,
                option_text=opt.option_text,
                position=opt.position,
                is_correct=opt.is_correct,
            )
        )

    review = [
        ReviewItem(
            question_id=q.id,
            position=q.position,
            question=q.question,
            points=q.points,
            selected_option_id=a.selected_option_id if a is not None else None,
            correct_option_id=correct_map.get(q.id),
            is_correct=bool(a and a.is_correct),
            points_awarded=int(a.points_awarded) if a else 0,
            options=sorted(options_by_q.get(q.id, []), key=lambda o: o.position),
        )
        for q in questions
        for a in [answers.get(q.id)]
    ]

    total_points = int(mapping["total_points"] or 0)
    score = int(mapping["score"] or 0)
    return ManagerAttemptReviewResponse(
        attempt_id=attempt_id,
        quiz_id=quiz.id,
        verse_id=quiz.verse_id,
        status=mapping["status"],
        score=score,
        total_points=total_points,
        score_out_of_10=round(score / total_points * 10, 1) if total_points else 0.0,
        percentage=round(score / total_points * 100, 1) if total_points else 0.0,
        correct_count=int(mapping["correct_count"] or 0),
        incorrect_count=int(mapping["incorrect_count"] or 0),
        question_count=int(mapping["question_count"] or 0),
        points_awarded=score,
        finished_at=mapping["finished_at"],
        time_taken_seconds=max(
            0, int((mapping["finished_at"] - mapping["started_at"]).total_seconds())
        ),
        user=AttemptUserBlock(**user_block),
        review=review,
    )


async def quiz_analytics_users_export(
    uow: UnitOfWork,
    actor: User,
    quiz_id: uuid.UUID,
    *,
    q: str | None = None,
    score_min: int | None = None,
    score_max: int | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    max_rows: int,
) -> tuple[list[tuple[object, ...]], list[str]]:
    """All user results for CSV export (P5-036, BR-40)."""
    assert_manager(actor)
    if await uow.quizzes.get_by_id(quiz_id) is None:
        raise NotFoundError("Quiz not found")
    status_enum = AttemptStatus(status) if status else None
    rows, _total = await uow.quiz_attempts.results_page(
        quiz_id,
        q=q,
        score_min=score_min,
        score_max=score_max,
        status=status_enum,
        date_from=date_from,
        date_to=date_to,
        limit=max_rows + 1,
        offset=0,
    )
    if len(rows) > max_rows:
        raise ExportTooLargeError(max_rows)
    header = [
        "user_id",
        "full_name",
        "score",
        "total_points",
        "percentage",
        "status",
        "finished_at",
        "time_taken_seconds",
    ]
    out = [
        (
            row["user_id"],
            _name(row.get("first_name"), row.get("last_name")),
            int(row["score"] or 0),
            int(row["total_points"] or 0),
            round(int(row["score"] or 0) / int(row["total_points"] or 1) * 100, 1),
            row["status"],
            row["finished_at"],
            max(0, int((row["finished_at"] - row["started_at"]).total_seconds())),
        )
        for row in rows
    ]
    return out, header
