"""API router for member points (Part 1 §5.6, P5-032)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.config import settings
from app.core.database import get_unit_of_work
from app.core.pagination import Page, PageParams
from app.modules.points.application.dto.points_dto import (
    MonthlyPointsResponse,
    PointActivityItem,
    PointsResponse,
)
from app.modules.points.application.queries.points_queries import (
    my_monthly_points_query,
    my_points_history_query,
    my_points_query,
)
from app.modules.quiz.presentation.dependencies import CurrentUser
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/users/me/points", tags=["Points"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]
_Page = Annotated[int, Query(ge=1, description="1-based page number")]
_Size = Annotated[int, Query(ge=1, le=100, description="Items per page")]


@router.get("")
async def my_points(viewer: CurrentUser, uow: _UoW) -> PointsResponse:
    """BR-34/BR-36: member's own totals and completed stats."""
    return await my_points_query(uow, viewer)


@router.get("/monthly")
async def my_monthly_points(
    viewer: CurrentUser,
    uow: _UoW,
    months: Annotated[int, Query(ge=1, le=settings.POINTS_HISTORY_MAX_MONTHS)] = 6,
) -> MonthlyPointsResponse:
    """Chronological monthly series for the caller (BR-33)."""
    return await my_monthly_points_query(uow, viewer, months)


@router.get("/history")
async def my_points_history(
    viewer: CurrentUser,
    uow: _UoW,
    page: _Page = 1,
    size: _Size = 20,
) -> Page[PointActivityItem]:
    return await my_points_history_query(uow, viewer, PageParams(page=page, size=size))
