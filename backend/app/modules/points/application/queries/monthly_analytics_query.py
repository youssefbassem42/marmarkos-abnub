"""Monthly analytics queries (P5-035, §5.7, BR-39, P5-036)."""

import uuid
from datetime import date

from app.core.exceptions import ExportTooLargeError, NotFoundError
from app.core.pagination import Page, PageParams
from app.core.time.periods import last_n_months
from app.modules.points.application.dto.monthly_dto import (
    CompletionBucket,
    MonthHistoryPoint,
    MonthlyAnalyticsResponse,
    MonthlyUserDetailResponse,
    QuizBreakdownItem,
    TopUser,
    TrendPoint,
)
from app.modules.quiz.application.commands.permissions import assert_manager
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def monthly_analytics_query(
    uow: UnitOfWork, actor: User, month: date
) -> MonthlyAnalyticsResponse:
    """Admin dashboard KPIs + trend + Top-3 for a given month (BR-39)."""
    assert_manager(actor)
    kpis = await uow.point_transactions.monthly_kpis(month)
    trend = await _trend(uow, month)
    completion = await _completion_distribution(uow, month)
    top = await uow.point_transactions.monthly_leaderboard(month, limit=3)
    top_items = [TopUser(**t) for t in top]
    quizzes_published = await uow.quizzes.count_published_in_month(month)
    return MonthlyAnalyticsResponse(
        month=month,
        participants=kpis["participants"],
        quizzes_completed=kpis["quizzes_completed"],
        total_points=kpis["total_points"],
        average_score_out_of_10=kpis["average_score_out_of_10"],
        quizzes_published=quizzes_published,
        trend=trend,
        completion_distribution=completion,
        top=top_items,
    )


async def _trend(uow: UnitOfWork, month: date) -> list[TrendPoint]:
    """Last 3 months trend including the given month."""
    months = last_n_months(month, 3)
    points_map: dict[date, dict[str, int]] = {}
    for m in months:
        kpis = await uow.point_transactions.monthly_kpis(m)
        points_map[m] = kpis
    return [
        TrendPoint(
            period_month=m,
            total_points=points_map[m]["total_points"],
            participants=points_map[m]["participants"],
            average_score_out_of_10=points_map[m]["average_score_out_of_10"],
        )
        for m in months
    ]


async def _completion_distribution(uow: UnitOfWork, month: date) -> list[CompletionBucket]:
    raw = await uow.point_transactions.monthly_completion_distribution(month)
    total = sum(v for _, v in raw) or 1
    return [
        CompletionBucket(bucket=bucket, users=count, percentage=round(count / total * 100, 1))
        for bucket, count in raw
    ]


class MonthlyUserItem:
    def __init__(
        self,
        *,
        rank: int,
        user_id: uuid.UUID,
        full_name: str,
        avatar: str | None,
        total_points: int,
        quizzes_completed: int,
        average_score_out_of_10: float,
        sparkline: list[int],
        completion_rate: float,
    ):
        self.rank = rank
        self.user_id = user_id
        self.full_name = full_name
        self.avatar = avatar
        self.total_points = total_points
        self.quizzes_completed = quizzes_completed
        self.average_score_out_of_10 = average_score_out_of_10
        self.sparkline = sparkline
        self.completion_rate = completion_rate


async def monthly_users_query(
    uow: UnitOfWork,
    actor: User,
    month: date,
    page: PageParams,
    *,
    q: str | None = None,
    min_points: int | None = None,
    score_range: str | None = None,
    completion_rate: str | None = None,
    min_quizzes: int | None = None,
):
    """Paginated user results page for a month with sparkline."""
    assert_manager(actor)
    months = last_n_months(month, 6)
    rows, total = await uow.point_transactions.monthly_user_page(
        month,
        q=q,
        min_points=min_points,
        score_range=score_range,
        completion_rate=completion_rate,
        min_quizzes=min_quizzes,
        limit=page.size,
        offset=page.offset,
        sparkline_months=months,
    )
    published = max(await uow.quizzes.count_published_in_month(month), 1)
    items = []
    rank = 0
    prev_points: int | None = None
    for i, row in enumerate(rows):
        pts = row["total_points"]
        if prev_points is None or pts != prev_points:
            rank = i + 1 + page.offset
        prev_points = pts
        items.append(
            {
                "rank": rank,
                "user_id": row["user_id"],
                "full_name": row["full_name"],
                "avatar": row["avatar"],
                "total_points": pts,
                "quizzes_completed": row["quizzes_completed"],
                "average_score_out_of_10": row["average_score_out_of_10"],
                "completion_rate": round(row["quizzes_completed"] / published * 100, 1),
                "sparkline": row["sparkline"],
            }
        )
    return Page.build(items, total, page)


async def user_month_detail_query(
    uow: UnitOfWork, actor: User, user_id: uuid.UUID, month: date
) -> MonthlyUserDetailResponse:
    """User drawer with per-quiz breakdown and full month history."""
    assert_manager(actor)
    user = await uow.users.get_by_id(user_id)
    if user is None:
        raise NotFoundError("User not found")
    kpis = await uow.point_transactions.monthly_kpis(month)
    breakdown = await uow.point_transactions.user_month_breakdown(user_id, month)
    history_raw = await uow.point_transactions.user_month_history(user_id)
    history = [MonthHistoryPoint(period_month=pm, points=pts) for pm, pts in history_raw]
    published = max(await uow.quizzes.count_published_in_month(month), 1)
    name = " ".join(n for n in (user.first_name, user.last_name) if n).strip() or "Unknown"
    return MonthlyUserDetailResponse(
        user_id=user.id,
        full_name=name,
        avatar=user.avatar,
        month=month,
        total_points=kpis["total_points"],
        quizzes_completed=kpis["quizzes_completed"],
        average_score_out_of_10=kpis["average_score_out_of_10"],
        completion_rate=round(kpis["quizzes_completed"] / published * 100, 1),
        breakdown=[QuizBreakdownItem(**b) for b in breakdown],
        history=history,
    )


async def monthly_users_export(
    uow: UnitOfWork,
    actor: User,
    month: date,
    *,
    q: str | None = None,
    min_points: int | None = None,
    score_range: str | None = None,
    completion_rate: str | None = None,
    min_quizzes: int | None = None,
    max_rows: int,
) -> tuple[list[tuple[object, ...]], list[str]]:
    """All user results for CSV export (P5-036, BR-40)."""
    assert_manager(actor)
    months = last_n_months(month, 6)
    rows, _total = await uow.point_transactions.monthly_user_page(
        month,
        q=q,
        min_points=min_points,
        score_range=score_range,
        completion_rate=completion_rate,
        min_quizzes=min_quizzes,
        limit=max_rows + 1,
        offset=0,
        sparkline_months=months,
    )
    if len(rows) > max_rows:
        raise ExportTooLargeError(max_rows)
    published = max(await uow.quizzes.count_published_in_month(month), 1)
    header = [
        "user_id",
        "full_name",
        "total_points",
        "quizzes_completed",
        "average_score_out_of_10",
        "completion_rate",
    ]
    out = [
        (
            row["user_id"],
            row["full_name"],
            row["total_points"],
            row["quizzes_completed"],
            row["average_score_out_of_10"],
            round(row["quizzes_completed"] / published * 100, 1),
        )
        for row in rows
    ]
    return out, header
