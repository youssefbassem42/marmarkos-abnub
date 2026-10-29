"""HTTP API for the blog posts (Phase 7.2).

Members read published posts.  Administrators and servants manage the
posts, including drafts, scheduled posts, and the soft-delete archive.
Every answer declares its response model so the OpenAPI contract is
honest.
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status

from app.core.database import get_unit_of_work
from app.core.exceptions import NotFoundError
from app.core.pagination import Page, PageParams
from app.modules.blog.application.commands.post_commands import (
    create_post,
    delete_post,
    publish_post,
    schedule_post,
    update_post,
)
from app.modules.blog.application.dto.post_dto import (
    BlogImageUploadResponse,
    BlogPostAdminResponse,
    BlogPostCreateRequest,
    BlogPostDetailResponse,
    BlogPostScheduleRequest,
    BlogPostSummaryResponse,
    BlogPostUpdateRequest,
)
from app.modules.blog.application.queries.post_queries import (
    get_admin_post,
    get_public_post_detail,
    list_admin_posts,
    list_public_posts,
)
from app.modules.blog.presentation.dependencies import BlogManager, CurrentUser
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from app.shared.infrastructure.services.image_upload import upload_image

router = APIRouter(tags=["Blog"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]
_Page = Annotated[int, Query(ge=1, description="1-based page number")]
_Size = Annotated[int, Query(ge=1, le=100, description="Items per page")]

_MANAGER_FAILURES: dict[int | str, dict[str, Any]] = {
    403: {"description": "Insufficient permissions"},
    404: {"description": "Post not found"},
    422: {"description": "Validation error"},
}


async def _admin_response(uow: UnitOfWork, post_id: UUID) -> BlogPostAdminResponse:
    item = await get_admin_post(uow, post_id)
    if item is None:
        raise NotFoundError("Post not found")
    return item


@router.get("/blog/posts", response_model=Page[BlogPostSummaryResponse])
async def list_blog_posts(
    viewer: CurrentUser,
    uow: _UoW,
    tag: Annotated[str | None, Query(max_length=80)] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: _Page = 1,
    size: _Size = 20,
) -> Page[BlogPostSummaryResponse]:
    """List the published posts for the members."""
    _ = viewer
    return await list_public_posts(
        uow,
        PageParams(page=page, size=size),
        tag=tag,
        search=q,
    )


@router.get(
    "/blog/posts/{post_id}",
    response_model=BlogPostDetailResponse,
    responses={404: {"description": "Post not found"}},
)
async def get_blog_post(
    post_id: UUID,
    viewer: CurrentUser,
    uow: _UoW,
) -> BlogPostDetailResponse:
    """Return one published post; a hidden post is a 404."""
    _ = viewer
    item = await get_public_post_detail(uow, post_id)
    if item is None:
        raise NotFoundError("Post not found")
    return item


@router.get(
    "/admin/blog/posts",
    response_model=Page[BlogPostAdminResponse],
    responses={403: {"description": "Insufficient permissions"}},
)
async def list_admin_blog_posts(
    actor: BlogManager,
    uow: _UoW,
    page: _Page = 1,
    size: _Size = 20,
) -> Page[BlogPostAdminResponse]:
    """List every post for the administration."""
    _ = actor
    return await list_admin_posts(uow, PageParams(page=page, size=size))


@router.post(
    "/admin/blog/posts",
    status_code=status.HTTP_201_CREATED,
    response_model=BlogPostAdminResponse,
    responses=_MANAGER_FAILURES,
)
async def create_blog_post(
    payload: BlogPostCreateRequest,
    actor: BlogManager,
    uow: _UoW,
) -> BlogPostAdminResponse:
    """Create a post; a past date publishes it and a future date schedules it."""
    post = await create_post(uow, actor, payload)
    await uow.commit()
    return await _admin_response(uow, post.id)


@router.post(
    "/admin/blog/posts/cover",
    status_code=status.HTTP_201_CREATED,
    response_model=BlogImageUploadResponse,
    responses=_MANAGER_FAILURES,
)
async def upload_blog_cover(
    actor: BlogManager,
    file: Annotated[UploadFile, File(...)],
) -> BlogImageUploadResponse:
    """Upload a post cover through the shared media service (BR-67)."""
    _ = actor
    data = await file.read()
    url = await upload_image(
        data,
        file.content_type or "",
        folder="blog-covers",
        max_bytes=1 * 1024 * 1024,
    )
    return BlogImageUploadResponse(url=url)


@router.patch(
    "/admin/blog/posts/{post_id}",
    response_model=BlogPostAdminResponse,
    responses=_MANAGER_FAILURES,
)
async def patch_blog_post(
    post_id: UUID,
    payload: BlogPostUpdateRequest,
    actor: BlogManager,
    uow: _UoW,
) -> BlogPostAdminResponse:
    """Update a post and, when supplied, its publication date."""
    await update_post(uow, actor, post_id, payload)
    await uow.commit()
    return await _admin_response(uow, post_id)


@router.delete(
    "/admin/blog/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses=_MANAGER_FAILURES,
)
async def delete_blog_post(
    post_id: UUID,
    actor: BlogManager,
    uow: _UoW,
) -> Response:
    """Archive a post; the row and its history remain in the database."""
    await delete_post(uow, actor, post_id)
    await uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/admin/blog/posts/{post_id}/publish",
    response_model=BlogPostAdminResponse,
    responses=_MANAGER_FAILURES,
)
async def publish_blog_post(
    post_id: UUID,
    actor: BlogManager,
    uow: _UoW,
) -> BlogPostAdminResponse:
    """Publish a post immediately."""
    await publish_post(uow, actor, post_id)
    await uow.commit()
    return await _admin_response(uow, post_id)


@router.post(
    "/admin/blog/posts/{post_id}/schedule",
    response_model=BlogPostAdminResponse,
    responses=_MANAGER_FAILURES
    | {422: {"description": "The publication date is not in the future"}},
)
async def schedule_blog_post(
    post_id: UUID,
    payload: BlogPostScheduleRequest,
    actor: BlogManager,
    uow: _UoW,
) -> BlogPostAdminResponse:
    """Schedule a post for a future date."""
    await schedule_post(uow, actor, post_id, payload)
    await uow.commit()
    return await _admin_response(uow, post_id)
