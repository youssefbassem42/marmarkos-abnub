"""API router for anonymous messages (plan §3.6, D-9/D-20).

Submission is public: no token required, and a stale one is ignored.
Both rate limits are checked before anything is persisted (BR-15).
Admin listing and retry live here beside the data they own, guarded by
``require_role(ADMIN)`` — there is no admin module router in Phase 4.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.config import settings
from app.core.database import get_unit_of_work
from app.core.pagination import Page, PageParams
from app.core.rate_limit import SlidingWindowRateLimiter, hash_key
from app.modules.anonymous_messages.application.dto.anonymous_message_dto import (
    AnonymousMessageAdminResponse,
    AnonymousMessageCreateRequest,
    AnonymousMessageCreateResponse,
)
from app.modules.anonymous_messages.application.services.anonymous_message_service import (
    AnonymousMessageService,
)
from app.modules.anonymous_messages.domain.enums.message_status import MessageStatus
from app.modules.anonymous_messages.presentation.dependencies import AdminUser, OptionalUser
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/anonymous-messages", tags=["Anonymous Messages"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]

# D-22: module-level singletons; in-memory sliding windows (R-3).
_PER_IP_HOURLY = SlidingWindowRateLimiter(
    limit=settings.ANONYMOUS_MESSAGE_RATE_LIMIT_PER_IP,
    window_seconds=3600,
)
_PER_USER_DAILY = SlidingWindowRateLimiter(
    limit=settings.ANONYMOUS_MESSAGE_RATE_LIMIT_PER_USER,
    window_seconds=86400,
)

_StatusParam = Annotated[MessageStatus | None, Query(description="Filter by status")]
_PageParam = Annotated[int, Query(ge=1, description="1-based page number")]
_SizeParam = Annotated[int, Query(ge=1, le=100, description="Items per page")]


def _client_ip(request: Request) -> str:
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("", status_code=201)
async def submit_anonymous_message(
    payload: AnonymousMessageCreateRequest,
    request: Request,
    uow: _UoW,
    user: OptionalUser,
) -> AnonymousMessageCreateResponse:
    """BR-13/BR-15: rate-check first, persist first, then Telegram inline."""
    # BR-15: both limits are enforced before anything is persisted.
    ip_key = hash_key(_client_ip(request))
    _PER_IP_HOURLY.hit(ip_key)
    if user is not None:
        # BR-12: only the hashed identity is stored, never the id itself.
        _PER_USER_DAILY.hit(hash_key(str(user.id)))

    service = AnonymousMessageService(uow)
    return await service.submit(payload)


@router.get(
    "",
    responses={403: {"description": "Insufficient permissions"}},
)
async def list_anonymous_messages(
    uow: _UoW,
    admin: AdminUser,
    status: _StatusParam = None,
    page: _PageParam = 1,
    size: _SizeParam = 20,
) -> Page[AnonymousMessageAdminResponse]:
    """D-11: admin review listing, newest first."""
    params = PageParams(page=page, size=size)
    service = AnonymousMessageService(uow)
    return await service.list_messages(params=params, status=status)


@router.post(
    "/{message_id}/retry",
    responses={403: {"description": "Insufficient permissions"}},
)
async def retry_anonymous_message(
    message_id: UUID, uow: _UoW, admin: AdminUser
) -> AnonymousMessageAdminResponse:
    """BR-14: re-attempt delivery of a FAILED forward, audited."""
    service = AnonymousMessageService(uow)
    return await service.retry(message_id=message_id, actor=admin)
