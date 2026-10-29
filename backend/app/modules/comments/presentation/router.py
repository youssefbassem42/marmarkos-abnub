"""HTTP API for the comments of a blog post (Phase 7.6).

Members write, edit, and delete their own comments.  Administrators and
servants may delete any comment, but they never edit a member's comment.
Every answer declares its response model so the OpenAPI contract is honest.
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.database import get_unit_of_work
from app.core.exceptions import NotFoundError
from app.core.pagination import Page, PageParams
from app.modules.comments.application.commands.comment_commands import (
    create_comment,
    delete_comment,
    update_comment,
)
from app.modules.comments.application.dto.comment_dto import (
    CommentCreateRequest,
    CommentResponse,
    CommentUpdateRequest,
)
from app.modules.comments.application.queries.comment_queries import (
    get_comment_response,
    list_comment_tree,
)
from app.modules.comments.presentation.dependencies import CurrentUser
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(tags=["Blog Comments"])

_UoW = Annotated[UnitOfWork, Depends(get_unit_of_work)]
_Page = Annotated[int, Query(ge=1, description="1-based page number")]
_Size = Annotated[int, Query(ge=1, le=100, description="Top-level comments per page")]

_COMMENT_FAILURES: dict[int | str, dict[str, Any]] = {
    403: {"description": "Insufficient permissions"},
    404: {"description": "Post or comment not found"},
    422: {"description": "The comment is empty or has more than 500 words"},
}


async def _comment_response(uow: UnitOfWork, comment_id: UUID) -> CommentResponse:
    item = await get_comment_response(uow, comment_id)
    if item is None:
        raise NotFoundError("Comment not found")
    return item


@router.get(
    "/blog/posts/{post_id}/comments",
    response_model=Page[CommentResponse],
    responses=_COMMENT_FAILURES,
)
async def list_blog_comments(
    post_id: UUID,
    viewer: CurrentUser,
    uow: _UoW,
    page: _Page = 1,
    size: _Size = 20,
) -> Page[CommentResponse]:
    """Return the visible comment tree of a published post."""
    _ = viewer
    result = await list_comment_tree(uow, post_id, PageParams(page=page, size=size))
    if result is None:
        raise NotFoundError("Post not found")
    return result


@router.post(
    "/blog/posts/{post_id}/comments",
    status_code=status.HTTP_201_CREATED,
    response_model=CommentResponse,
    responses=_COMMENT_FAILURES,
)
async def create_blog_comment(
    post_id: UUID,
    payload: CommentCreateRequest,
    actor: CurrentUser,
    uow: _UoW,
) -> CommentResponse:
    """Create a comment or a reply after sanitizing and counting its HTML."""
    comment = await create_comment(uow, actor, post_id, payload)
    await uow.commit()
    return await _comment_response(uow, comment.id)


@router.patch(
    "/blog/comments/{comment_id}",
    response_model=CommentResponse,
    responses=_COMMENT_FAILURES,
)
async def patch_blog_comment(
    comment_id: UUID,
    payload: CommentUpdateRequest,
    actor: CurrentUser,
    uow: _UoW,
) -> CommentResponse:
    """Edit a comment; only its owner may make the change."""
    await update_comment(uow, actor, comment_id, payload)
    await uow.commit()
    return await _comment_response(uow, comment_id)


@router.delete(
    "/blog/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses=_COMMENT_FAILURES,
)
async def delete_blog_comment(
    comment_id: UUID,
    actor: CurrentUser,
    uow: _UoW,
) -> Response:
    """Soft-delete a comment; the owner, an admin, or a servant may do so."""
    await delete_comment(uow, actor, comment_id)
    await uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
