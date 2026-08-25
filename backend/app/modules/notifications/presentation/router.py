"""API router for the in-app notification feed (plan §3.6).

Reading and marking one's own notifications requires any authenticated
role; pushing a broadcast is ADMIN-only. There is deliberately no admin
module router: admin-only routes live beside the data they own.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.config import settings
from app.core.database import get_unit_of_work
from app.core.exceptions.errors import NotFoundError
from app.core.pagination import Page, PageParams
from app.modules.auth.presentation.dependencies import get_current_user, require_role
from app.modules.notifications.application.dto.notification_dto import (
    MarkReadResponse,
    NotificationResponse,
    NotificationSummaryResponse,
    NotificationTabCounts,
    PushNotificationRequest,
    PushNotificationResponse,
)
from app.modules.notifications.application.mappers.notification_mapper import (
    map_notification_to_response,
)
from app.modules.notifications.application.services.notification_service import (
    NotificationService,
)
from app.modules.notifications.domain.enums.notification_tab import NotificationTab
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/notifications", tags=["Notifications"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]
_CurrentUser = Annotated[User, Depends(get_current_user)]
_AdminUser = Annotated[User, Depends(require_role(RoleName.ADMIN))]
_TabParam = Annotated[NotificationTab, Query(description="Feed tab filter (§3.4)")]
_PageParam = Annotated[int, Query(ge=1, description="1-based page number")]
_SizeParam = Annotated[
    int,
    Query(ge=1, le=settings.NOTIFICATIONS_MAX_PAGE_SIZE, description="Items per page"),
]
_SinceParam = Annotated[datetime | None, Query(description="ISO datetime lower bound (D-24)")]


@router.get("")
async def list_notifications(
    user: _CurrentUser,
    uow: _UoW,
    tab: _TabParam = NotificationTab.ALL,
    page: _PageParam = 1,
    size: _SizeParam = settings.NOTIFICATIONS_PAGE_SIZE,
    since: _SinceParam = None,
) -> Page[NotificationResponse]:
    """BR-1: the caller's feed — own rows plus broadcasts, newest first."""
    params = PageParams(page=page, size=size)
    items, read_ids, total = await uow.notifications.list_for_user(
        user.id, params=params, tab=tab, since=since
    )
    return Page.build(
        [map_notification_to_response(n, read_ids=read_ids) for n in items],
        total,
        params,
    )


@router.get("/summary")
async def notification_summary(user: _CurrentUser, uow: _UoW) -> NotificationSummaryResponse:
    """D-4: unread badge + per-tab counts behind the feed tabs (BR-2)."""
    counts = await uow.notifications.tab_counts(user.id)
    return NotificationSummaryResponse(
        unread_count=counts[NotificationTab.UNREAD],
        tab_counts=NotificationTabCounts(**{tab.value: count for tab, count in counts.items()}),
    )


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID, user: _CurrentUser, uow: _UoW
) -> MarkReadResponse:
    """BR-3/BR-7: idempotent per-user mark; foreign rows answer 404."""
    notification = await uow.notifications.get_visible_for_user(notification_id, user.id)
    if notification is None:
        raise NotFoundError("Notification not found")
    marked = await uow.notification_reads.mark_read(notification.id, user.id)
    await uow.commit()
    return MarkReadResponse(marked=marked)


@router.post("/read-all")
async def mark_all_notifications_read(user: _CurrentUser, uow: _UoW) -> MarkReadResponse:
    """BR-4: mark every currently visible unread notification for the caller."""
    marked = await uow.notification_reads.mark_all_read(user.id)
    await uow.commit()
    return MarkReadResponse(marked=marked)


@router.post(
    "/push",
    status_code=201,
    responses={403: {"description": "Insufficient permissions"}},
)
async def push_notification(
    request: PushNotificationRequest, admin: _AdminUser, uow: _UoW
) -> PushNotificationResponse:
    """BR-6/BR-8: admin broadcast; optional inline email fan-out after commit."""
    service = NotificationService(uow)
    return await service.push_announcement(actor=admin, request=request)
