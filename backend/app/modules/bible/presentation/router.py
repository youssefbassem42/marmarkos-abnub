"""API router for bible verses (Part 1 §5.1–§5.3).

Content management (P5-011), scheduling (P5-013) and the member feed.
Engagement endpoints arrive with wave 5B; analytics with 5C.
"""

from datetime import date
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status

from app.config import settings
from app.core.database import get_unit_of_work
from app.core.pagination import Page, PageParams
from app.modules.bible.application.commands.schedule_commands import (
    cancel_schedule as cancel_schedule_command,
)
from app.modules.bible.application.commands.schedule_commands import (
    schedule_verse,
)
from app.modules.bible.application.commands.verse_commands import (
    archive_verse,
    create_verse,
    publish_verse_now,
    restore_verse,
    update_verse,
)
from app.modules.bible.application.dto.query_dto import PublishedFeedParams, VerseListParams
from app.modules.bible.application.dto.schedule_dto import (
    VerseScheduleRequest,
    VerseScheduleResponse,
)
from app.modules.bible.application.dto.analytics_dto import (
    VerseAnalyticsOverview,
    VerseAnalyticsResponse,
    VerseUserEngagementItem,
)
from app.modules.bible.application.queries.verse_analytics_query import (
    verse_analytics_overview_query,
    verse_analytics_query,
    verse_analytics_users_export,
    verse_analytics_users_query,
)
from app.modules.bible.application.dto.verse_dto import (
    VerseAdminItem,
    VerseCard,
    VerseCreateRequest,
    VerseDetailResponse,
    VerseStatsResponse,
    VerseUpdateRequest,
)
from app.modules.bible.application.queries.verse_queries import (
    current_verse_query,
    published_feed_query,
    verse_detail_query,
    verse_list_query,
    verse_stats_query,
)
from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.presentation.dependencies import BibleManager, CurrentUser
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/bible-verses", tags=["Bible Verses"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]
_Page = Annotated[int, Query(ge=1, description="1-based page number")]
_Size = Annotated[
    int, Query(ge=1, le=settings.BIBLE_VERSES_MAX_PAGE_SIZE, description="Items per page")
]

_MANAGER_FAILURES: dict[int | str, dict[str, Any]] = {
    403: {"description": "Insufficient permissions"},
    404: {"description": "Verse not found"},
    409: {"description": "Invalid status transition"},
    422: {"description": "Validation error"},
}


@router.post("", status_code=status.HTTP_201_CREATED, responses=_MANAGER_FAILURES)
async def create_bible_verse(
    payload: VerseCreateRequest, actor: BibleManager, uow: _UoW
) -> VerseDetailResponse:
    """BR-1/BR-2: create a verse (DRAFT by default, or PUBLISHED)."""
    verse = await create_verse(uow, actor, payload)
    await uow.commit()
    _, response = await verse_detail_query(uow, verse.id, actor)
    return response


@router.get("", responses={403: {"description": "Insufficient permissions"}})
async def list_verses(
    actor: BibleManager,
    uow: _UoW,
    status_filter: Annotated[VerseStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    created_by: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    has_quiz: bool | None = None,
    sort: str = "created_at",
    order: str = "desc",
    page: _Page = 1,
    size: _Size = settings.BIBLE_VERSES_PAGE_SIZE,
) -> Page[VerseAdminItem]:
    """Manager table listing with filters, sort and pagination (§5.1)."""
    params = VerseListParams(
        status=status_filter,
        q=q,
        created_by=created_by,
        date_from=date_from,
        date_to=date_to,
        has_quiz=has_quiz,
        sort=sort,
        order=order,
    )
    return await verse_list_query(uow, params, PageParams(page=page, size=size))


@router.get("/stats", responses={403: {"description": "Insufficient permissions"}})
async def verse_stats(actor: BibleManager, uow: _UoW) -> VerseStatsResponse:
    """KPI counts for the management dashboard cards."""
    return await verse_stats_query(uow)


CoverFile = Annotated[UploadFile, File(...)]


@router.post("/cover", status_code=status.HTTP_201_CREATED)
async def upload_verse_cover(
    actor: BibleManager,
    file: CoverFile,
) -> dict[str, str]:
    """Upload a cover image for a bible verse (stored on Cloudinary)."""
    from app.shared.infrastructure.services.image_upload import upload_image

    content_type = file.content_type or ""
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        from app.core.exceptions import ValidationError
        raise ValidationError("Image must be 2 MB or smaller")
    url = await upload_image(data, content_type, folder="bible-covers")
    return {"url": url}


@router.get(
    "/current",
    responses={204: {"description": "No published verse yet"}},
)
async def current_verse(viewer: CurrentUser, uow: _UoW) -> Response:
    """The newest PUBLISHED verse ("This Week"); 204 when none exists."""
    card = await current_verse_query(uow, viewer)
    if card is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return Response(content=card.model_dump_json(), media_type="application/json")


@router.get("/published")
async def published_verses(
    viewer: CurrentUser,
    uow: _UoW,
    q: Annotated[str | None, Query(max_length=200)] = None,
    read: str = "all",
    has_quiz: bool | None = None,
    page: _Page = 1,
    size: _Size = settings.BIBLE_VERSES_PAGE_SIZE,
) -> Page[VerseCard]:
    """Member feed of PUBLISHED verses with read/quiz flags (§5.3)."""
    params = PublishedFeedParams(q=q, read=read, has_quiz=has_quiz)
    return await published_feed_query(uow, viewer, params, PageParams(page=page, size=size))


@router.get("/{verse_id}", responses={404: {"description": "Verse not found"}})
async def get_verse(verse_id: UUID, viewer: CurrentUser, uow: _UoW) -> VerseDetailResponse:
    """Manager → full detail; MEMBER → public projection, 404 unless PUBLISHED (BR-3)."""
    _, response = await verse_detail_query(uow, verse_id, viewer)
    return response


@router.patch("/{verse_id}", responses=_MANAGER_FAILURES)
async def patch_verse(
    verse_id: UUID, payload: VerseUpdateRequest, actor: BibleManager, uow: _UoW
) -> VerseDetailResponse:
    """BR-7 partial update; ``status`` drives allowed transitions (BR-5)."""
    await update_verse(uow, actor, verse_id, payload)
    await uow.commit()
    _, response = await verse_detail_query(uow, verse_id, actor)
    return response


@router.delete("/{verse_id}", status_code=204, responses=_MANAGER_FAILURES)
async def delete_verse(verse_id: UUID, actor: BibleManager, uow: _UoW) -> Response:
    """D-11: DELETE archives; restore via PATCH {status: "DRAFT"}."""
    await archive_verse(uow, actor, verse_id)
    await uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{verse_id}/restore", responses=_MANAGER_FAILURES)
async def post_restore_verse(verse_id: UUID, actor: BibleManager, uow: _UoW) -> VerseDetailResponse:
    """ARCHIVED → DRAFT (D-11)."""
    await restore_verse(uow, actor, verse_id)
    await uow.commit()
    _, response = await verse_detail_query(uow, verse_id, actor)
    return response


@router.post("/{verse_id}/publish", responses=_MANAGER_FAILURES)
async def publish_verse(verse_id: UUID, actor: BibleManager, uow: _UoW) -> VerseDetailResponse:
    """Publish now; completes any active schedule (BR-10)."""
    await publish_verse_now(uow, actor, verse_id)
    await uow.commit()
    _, response = await verse_detail_query(uow, verse_id, actor)
    return response


# -- Scheduling (P5-013, §5.2) -----------------------------------------------


@router.post(
    "/{verse_id}/schedule",
    status_code=201,
    responses=_MANAGER_FAILURES
    | {
        422: {"description": "invalid_schedule (BR-8)"},
    },
)
async def schedule_publication(
    verse_id: UUID, payload: VerseScheduleRequest, actor: BibleManager, uow: _UoW
) -> VerseScheduleResponse:
    """Queue one future publication; the verse becomes SCHEDULED."""
    schedule = await schedule_verse(uow, actor, verse_id, payload.scheduled_at)
    await uow.commit()
    return VerseScheduleResponse(
        id=schedule.id,
        verse_id=schedule.verse_id,
        status=schedule.status.value,
        scheduled_at=schedule.scheduled_at,
        created_by_user_id=schedule.created_by,
    )


@router.patch("/{verse_id}/schedule", responses=_MANAGER_FAILURES)
async def reschedule_publication(
    verse_id: UUID, payload: VerseScheduleRequest, actor: BibleManager, uow: _UoW
) -> VerseScheduleResponse:
    """Reschedule the active publication row (BR-9)."""
    schedule = await schedule_verse(uow, actor, verse_id, payload.scheduled_at)
    await uow.commit()
    return VerseScheduleResponse(
        id=schedule.id,
        verse_id=schedule.verse_id,
        status=schedule.status.value,
        scheduled_at=schedule.scheduled_at,
        created_by_user_id=schedule.created_by,
    )


@router.delete("/{verse_id}/schedule", status_code=204, responses=_MANAGER_FAILURES)
async def cancel_publication(verse_id: UUID, actor: BibleManager, uow: _UoW) -> Response:
    """Cancel the active schedule; the verse returns to DRAFT."""
    await cancel_schedule_command(uow, actor, verse_id)
    await uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -- Analytics (P5-033, §5.7) -------------------------------------------


@router.get(
    "/analytics/overview",
    responses={403: {"description": "Insufficient permissions"}},
)
async def verse_analytics_overview(actor: BibleManager, uow: _UoW) -> VerseAnalyticsOverview:
    """Dashboard Bible Engagement totals (BR-13/BR-16)."""
    return await verse_analytics_overview_query(uow)


@router.get(
    "/{verse_id}/analytics",
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Verse not found"},
    },
)
async def verse_analytics(
    verse_id: UUID,
    actor: BibleManager,
    uow: _UoW,
    granularity: Annotated[str, Query(pattern="^(daily|weekly)$")] = "daily",
    date_from: date | None = None,
    date_to: date | None = None,
) -> VerseAnalyticsResponse:
    """Per-verse KPIs, engagement series and related quiz performance."""
    return await verse_analytics_query(
        uow, verse_id, granularity=granularity, date_from=date_from, date_to=date_to
    )


@router.get(
    "/{verse_id}/analytics/users",
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Verse not found"},
    },
)
async def verse_analytics_users(
    verse_id: UUID,
    actor: BibleManager,
    uow: _UoW,
    q: Annotated[str | None, Query(max_length=200)] = None,
    read: Annotated[str | None, Query(pattern="^(all|read|unread)$")] = None,
    page: _Page = 1,
    size: _Size = settings.BIBLE_VERSES_PAGE_SIZE,
) -> Page[VerseUserEngagementItem]:
    """Per-user engagement table (BR-13: members only)."""
    return await verse_analytics_users_query(
        uow, verse_id, PageParams(page=page, size=size), q=q, read=read
    )


@router.get(
    "/{verse_id}/analytics/export",
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Verse not found"},
    },
)
async def verse_analytics_export(
    verse_id: UUID,
    actor: BibleManager,
    uow: _UoW,
    q: Annotated[str | None, Query(max_length=200)] = None,
    read: Annotated[str | None, Query(pattern="^(all|read|unread)$")] = None,
):
    """CSV export of the verse user-engagement table (P5-036, BR-40)."""
    from app.config import settings
    from app.core.csv import stream_csv

    rows, header = await verse_analytics_users_export(
        uow, verse_id, q=q, read=read, max_rows=settings.ANALYTICS_EXPORT_MAX_ROWS
    )
    return stream_csv(rows, header, f"verse_{verse_id}_engagement.csv")
