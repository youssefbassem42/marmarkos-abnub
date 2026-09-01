"""Points query use cases (P5-032, BR-34/BR-36)."""

import uuid

from app.core.pagination import Page, PageParams
from app.core.time.clock import today_local
from app.core.time.periods import last_n_months
from app.modules.points.application.dto.points_dto import (
    MonthlyPointsItem,
    MonthlyPointsResponse,
    PointActivityItem,
    PointsResponse,
)
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
