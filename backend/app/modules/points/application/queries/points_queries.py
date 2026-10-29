"""Points query use cases (P5-032, BR-34/BR-36)."""

import math

from sqlalchemy import func, select

from app.core.pagination import Page, PageParams
from app.core.time.clock import today_local
from app.core.time.periods import last_n_months
from app.modules.points.application.dto.points_dto import (
    MonthlyPointsItem,
    MonthlyPointsResponse,
    PointActivityItem,
    PointsByQuizItem,
    PointsByQuizPage,
    PointsResponse,
)
from app.modules.points.infrastructure.persistence.models import PointTransaction
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def my_points_query(uow: UnitOfWork, actor: User) -> PointsResponse:
    """Current member's point totals + completed stats (BR-34)."""
    totals = await uow.point_transactions.totals_for_user(actor.id, today=today_local())
    stats = await uow.quiz_attempts.member_stats(actor.id)
    return PointsResponse(
        lifetime=totals["lifetime"],
        this_week=totals["this_week"],
        this_month=totals["this_month"],
        quizzes_completed=int(stats["quizzes_completed"]),
        average_score_out_of_10=float(stats["average_score_out_of_10"]),
    )


async def my_monthly_points_query(
    uow: UnitOfWork, actor: User, months: int
) -> MonthlyPointsResponse:
    """Chronological (points, quizzes_completed) per month (BR-33)."""
    anchor = today_local()
    period_months = last_n_months(anchor, months)
    series = await uow.point_transactions.monthly_series_for_user(actor.id, period_months)
    items = [
        MonthlyPointsItem(
            period_month=pm,
            points=series.get(pm, (0, 0))[0],
            quizzes_completed=series.get(pm, (0, 0))[1],
        )
        for pm in period_months
    ]
    return MonthlyPointsResponse(items=items)


async def my_points_history_query(
    uow: UnitOfWork, actor: User, page: PageParams
) -> Page[PointActivityItem]:
    """Paginated ledger history with quiz/verse titles (BR-36)."""
    rows, total = await uow.point_transactions.history_page_with_titles(
        actor.id, limit=page.size, offset=page.offset
    )
    items = [
        PointActivityItem(
            id=row["id"],
            points=row["points"],
            awarded_at=row["awarded_at"],
            quiz_id=row["quiz_id"],
            quiz_title=row["quiz_title"],
            verse_id=row["verse_id"],
            verse_reference=row["verse_reference"],
            source=row["source"],
        )
        for row in rows
    ]
    return Page.build(items, total, page)


async def my_points_by_quiz_query(
    uow: UnitOfWork, actor: User, page: PageParams
) -> PointsByQuizPage:
    """The points of the member per quiz (BR-56..BR-60).

    One line per quiz: the sum of his ledger on that quiz, the number of
    his attempts, the average of his scores out of ten and the date of his
    last attempt, ordered by the points then the last attempt, paginated.
    The lifetime total travels with the page so the frontend never adds
    the lines itself.
    """
    rows, total = await uow.point_transactions.points_by_quiz_page(
        actor.id, limit=page.size, offset=page.offset
    )
    items = [
        PointsByQuizItem(
            quiz_id=row["quiz_id"],
            quiz_title=row["quiz_title"],
            points=int(row["points"]),
            attempts=int(row["attempts"]),
            average_score_out_of_10=float(row["average_score_out_of_10"] or 0.0),
            last_attempt_at=row["last_attempt_at"],
        )
        for row in rows
    ]
    total_points = int(
        (
            await uow.session.execute(
                select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
                    PointTransaction.user_id == actor.id
                )
            )
        ).scalar_one()
    )
    pages = math.ceil(total / page.size) if total else 0
    return PointsByQuizPage(
        items=items,
        total=total,
        page=page.page,
        size=page.size,
        pages=pages,
        has_next=page.page < pages,
        total_points=total_points,
    )
