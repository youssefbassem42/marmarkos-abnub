"""API router for the landing-page slider (plan §7.2).

The slides belong to the media module. The public list answers the active
slides only and needs no token; the administration is guarded by the admin
role alone (the servant reads the public list, the admin writes).
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status

from app.core.database import get_unit_of_work
from app.core.exceptions import NotFoundError
from app.core.pagination import Page, PageParams
from app.modules.media.application.commands.landing_slide_commands import (
    create_landing_slide,
    delete_landing_slide,
    reorder_landing_slides,
    update_landing_slide,
)
from app.modules.media.application.dto.landing_slide_dto import (
    LandingSlideAdminItem,
    LandingSlideCreateRequest,
    LandingSlidePublicItem,
    LandingSlideReorderRequest,
    LandingSlideUpdateRequest,
)
from app.modules.media.application.queries.landing_slide_queries import (
    get_landing_slide_admin_item,
    list_admin_landing_slides,
    list_public_landing_slides,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.presentation.dependencies import require_role
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from app.shared.infrastructure.services.image_upload import upload_image

router = APIRouter(tags=["Landing Slides"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]
AdminUser = Annotated[User, Depends(require_role(RoleName.ADMIN))]

_ADMIN_FAILURES: dict[int | str, dict[str, Any]] = {
    403: {"description": "Insufficient permissions"}
}


@router.get(
    "/landing/slides",
    response_model=Page[LandingSlidePublicItem],
)
async def public_landing_slides(
    uow: _UoW,
    page: Annotated[int, Query(ge=1, description="1-based page number")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
) -> Page[LandingSlidePublicItem]:
    """The active slides, in order. Public: no token required."""
    return await list_public_landing_slides(uow, PageParams(page=page, size=size))


@router.get(
    "/admin/landing/slides",
    response_model=Page[LandingSlideAdminItem],
    responses=_ADMIN_FAILURES,
)
async def admin_list_landing_slides(
    actor: AdminUser,
    uow: _UoW,
    page: Annotated[int, Query(ge=1, description="1-based page number")] = 1,
    size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
) -> Page[LandingSlideAdminItem]:
    """Every slide (the inactive ones too) for the administration."""
    return await list_admin_landing_slides(uow, PageParams(page=page, size=size))


@router.post(
    "/admin/landing/slides",
    status_code=status.HTTP_201_CREATED,
    response_model=LandingSlideAdminItem,
    responses=_ADMIN_FAILURES,
)
async def create_landing_slide_endpoint(
    actor: AdminUser,
    uow: _UoW,
    file: Annotated[UploadFile, File(...)],
    title: Annotated[str | None, Form()] = None,
    subtitle: Annotated[str | None, Form()] = None,
) -> LandingSlideAdminItem:
    """Upload the image and create a slide (admin only)."""
    data = await file.read()
    url = await upload_image(data, file.content_type or "", folder="landing-slides")
    slide = await create_landing_slide(
        uow,
        LandingSlideCreateRequest(image=url, title=title, subtitle=subtitle),
    )
    item = await get_landing_slide_admin_item(uow, slide.id)
    if item is None:
        raise NotFoundError("Slide not found")
    return item


@router.patch(
    "/admin/landing/slides/{slide_id}",
    response_model=LandingSlideAdminItem,
    responses=_ADMIN_FAILURES,
)
async def update_landing_slide_endpoint(
    slide_id: UUID,
    actor: AdminUser,
    uow: _UoW,
    file: Annotated[UploadFile | None, File()] = None,
    title: Annotated[str | None, Form()] = None,
    subtitle: Annotated[str | None, Form()] = None,
    active: Annotated[bool | None, Form()] = None,
) -> LandingSlideAdminItem:
    """Update a slide (admin only). A missing field is left unchanged."""
    if file is not None:
        data = await file.read()
        image_url = await upload_image(data, file.content_type or "", folder="landing-slides")
    else:
        image_url = None
    await update_landing_slide(
        uow,
        slide_id,
        LandingSlideUpdateRequest(
            image=image_url,
            title=title,
            subtitle=subtitle,
            active=active,
        ),
    )
    item = await get_landing_slide_admin_item(uow, slide_id)
    if item is None:
        raise NotFoundError("Slide not found")
    return item


@router.delete(
    "/admin/landing/slides/{slide_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ADMIN_FAILURES,
)
async def delete_landing_slide_endpoint(slide_id: UUID, actor: AdminUser, uow: _UoW) -> Response:
    """Delete a slide (admin only)."""
    await delete_landing_slide(uow, slide_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/admin/landing/slides/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ADMIN_FAILURES,
)
async def reorder_landing_slides_endpoint(
    actor: AdminUser, uow: _UoW, payload: LandingSlideReorderRequest
) -> Response:
    """Persist the ids as the new display order (admin only)."""
    await reorder_landing_slides(uow, payload.ids)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
