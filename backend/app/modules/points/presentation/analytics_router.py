"""Analytics router — monthly leaderboard and exports (P5-035, §5.7, BR-39)."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.config import settings
from app.core.database import get_unit_of_work
from app.core.pagination import Page, PageParams
from app.modules.points.application.dto.monthly_dto import (
    MonthlyAnalyticsResponse,
    MonthlyUserDetailResponse,
)
from app.modules.points.application.queries.monthly_analytics_query import (
    monthly_analytics_query,
    monthly_users_export,
    monthly_users_query,
    user_month_detail_query,
)
from app.modules.points.presentation.dependencies import AnalyticsViewer
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/quiz-analytics", tags=["Analytics"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]
_Page = Annotated[int, Query(ge=1, description="1-based page number")]
_Size = Annotated[int, Query(ge=1, le=100, description="Items per page")]


def _parse_month(value: str | None) -> date:
    """Validate and parse the requested month into a first-of-month date.

    The only shape is ``?month=2026-09`` (``YYYY-MM``).

    A legacy shape (``?year=2026&month=9``) was accepted for one
    release. The history shows it was **never published**: the endpoint
    only ever accepted ``YYYY-MM`` (the legacy shape was added in a
    local commit that was never pushed, and no release exists in the
    repository - no tag, no changelog, the version never moved), so no
    client can depend on it. It is gone (Phase 3.1).
    """
    raw = (value or "").strip()
    parts = raw.split("-") if raw else []
    if len(parts) == 2:
        try:
            return date(int(parts[0]), int(parts[1]), 1)
        except (ValueError, IndexError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="month must be in YYYY-MM format",
            ) from exc
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail="month must be in YYYY-MM format",
    )


@router.get("/monthly")
async def monthly_analytics(
    actor: AnalyticsViewer,
    uow: _UoW,
    month: Annotated[str | None, Query(description="YYYY-MM month to analyse")] = None,
) -> MonthlyAnalyticsResponse:
    """Admin monthly dashboard: KPIs, trend, completion distribution, Top-3."""
    return await monthly_analytics_query(uow, actor, _parse_month(month))


@router.get("/monthly/users")
async def monthly_users(
    actor: AnalyticsViewer,
    uow: _UoW,
    month: Annotated[str | None, Query(description="YYYY-MM month to analyse")] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    min_points: int | None = None,
    score_range: str | None = None,
    completion_rate: str | None = None,
    min_quizzes: int | None = None,
    page: _Page = 1,
    size: _Size = settings.QUIZ_ANALYTICS_PAGE_SIZE,
) -> Page[dict[str, object]]:
    """Paginated user results page with sparkline."""
    return await monthly_users_query(
        uow,
        actor,
        _parse_month(month),
        PageParams(page=page, size=size),
        q=q,
        min_points=min_points,
        score_range=score_range,
        completion_rate=completion_rate,
        min_quizzes=min_quizzes,
    )


@router.get("/users/{user_id}")
async def user_month_detail(
    user_id: UUID,
    actor: AnalyticsViewer,
    uow: _UoW,
    month: Annotated[str | None, Query(description="YYYY-MM month to analyse")] = None,
) -> MonthlyUserDetailResponse:
    """User drawer with per-quiz breakdown and full month history."""
    return await user_month_detail_query(uow, actor, user_id, _parse_month(month))


@router.get("/monthly/export")
async def monthly_export(
    actor: AnalyticsViewer,
    uow: _UoW,
    month: Annotated[str | None, Query(description="YYYY-MM month to export")] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    min_points: int | None = None,
    score_range: str | None = None,
    completion_rate: str | None = None,
    min_quizzes: int | None = None,
) -> Response:
    """CSV export of the monthly users table (P5-036, BR-40)."""
    from app.core.csv import stream_csv

    parsed_month = _parse_month(month)
    rows, header = await monthly_users_export(
        uow,
        actor,
        parsed_month,
        q=q,
        min_points=min_points,
        score_range=score_range,
        completion_rate=completion_rate,
        min_quizzes=min_quizzes,
        max_rows=settings.ANALYTICS_EXPORT_MAX_ROWS,
    )
    return stream_csv(rows, header, f"monthly_{parsed_month:%Y-%m}_results.csv")
