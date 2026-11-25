"""Read queries for the comment tree of a blog post (Phase 7.6).

The member-facing answer contains visible comments, deleted tombstones, and
the replies nested below them.  Hidden and flagged branches stay out of the
answer.  Pagination applies to the top-level comments; a root always carries
its complete reply tree (BR-80).
"""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.pagination import Page, PageParams
from app.core.time.clock import now_utc
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.comments.application.dto.comment_dto import (
    CommentAuthorResponse,
    CommentLikeResponse,
    CommentResponse,
)
from app.modules.comments.application.services.comment_content import (
    DELETED_COMMENT_CONTENT,
)
from app.modules.comments.domain.enums.comment_status import CommentStatus
from app.modules.comments.infrastructure.persistence.models import Comment
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


def _author(comment: Comment) -> CommentAuthorResponse:
    parts = [comment.author.first_name, comment.author.last_name]
    full_name = " ".join(part for part in parts if part)
    return CommentAuthorResponse(id=comment.author.id, full_name=full_name)


def _response(
    comment: Comment,
    replies: list[CommentResponse],
    *,
    likes_count: int,
    liked: bool,
) -> CommentResponse:
    content = comment.content
    if comment.status is CommentStatus.DELETED:
        content = DELETED_COMMENT_CONTENT
    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        parent_comment_id=comment.parent_comment_id,
        content=content,
        status=comment.status.value,
        author=_author(comment),
        likes_count=max(0, likes_count),
        liked=liked,
        replies=replies,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


def _render_tree(
    comment: Comment,
    children_by_parent: dict[uuid.UUID, list[Comment]],
    counts: dict[uuid.UUID, int],
    liked_ids: set[uuid.UUID],
) -> CommentResponse | None:
    """Render one branch, hiding moderated branches completely."""
    if comment.status not in {CommentStatus.VISIBLE, CommentStatus.DELETED}:
        return None

    replies: list[CommentResponse] = []
    for child in children_by_parent.get(comment.id, []):
        rendered = _render_tree(child, children_by_parent, counts, liked_ids)
        if rendered is not None:
            replies.append(rendered)
    return _response(
        comment,
        replies,
        likes_count=counts.get(comment.id, 0),
        liked=comment.id in liked_ids,
    )


async def _post_is_visible(uow: UnitOfWork, post_id: uuid.UUID) -> bool:
    post = await uow.blog_posts.get_by_id(post_id)
    if post is None or post.status is not PostStatus.PUBLISHED:
        return False
    return post.published_at is None or post.published_at <= now_utc()


async def list_comment_tree(
    uow: UnitOfWork,
    post_id: uuid.UUID,
    page: PageParams,
    *,
    viewer_id: uuid.UUID,
) -> Page[CommentResponse] | None:
    """Return the visible comment tree, or ``None`` for a hidden post."""
    if not await _post_is_visible(uow, post_id):
        return None

    result = await uow.session.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at, Comment.id)
    )
    comments = list(result.scalars().all())
    comment_ids = [comment.id for comment in comments]
    counts = await uow.comment_likes.counts_for_comments(comment_ids)
    liked_ids = await uow.comment_likes.liked_comment_ids(comment_ids, viewer_id)
    children_by_parent: dict[uuid.UUID, list[Comment]] = defaultdict(list)
    for comment in comments:
        if comment.parent_comment_id is not None:
            children_by_parent[comment.parent_comment_id].append(comment)

    roots = [
        rendered
        for comment in comments
        if comment.parent_comment_id is None
        if (rendered := _render_tree(comment, children_by_parent, counts, liked_ids)) is not None
    ]
    page_items = roots[page.offset : page.offset + page.size]
    return Page.build(page_items, len(roots), page)


async def get_comment_response(
    uow: UnitOfWork,
    comment_id: uuid.UUID,
    *,
    viewer_id: uuid.UUID,
) -> CommentResponse | None:
    """Return one comment with its direct replies for a write answer."""
    result = await uow.session.execute(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        return None

    replies_result = await uow.session.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(
            Comment.parent_comment_id == comment.id,
            Comment.status.in_((CommentStatus.VISIBLE, CommentStatus.DELETED)),
        )
        .order_by(Comment.created_at, Comment.id)
    )
    replies = list(replies_result.scalars().all())
    comment_ids = [comment.id, *(reply.id for reply in replies)]
    counts = await uow.comment_likes.counts_for_comments(comment_ids)
    liked_ids = await uow.comment_likes.liked_comment_ids(comment_ids, viewer_id)
    reply_responses = [
        _response(
            reply,
            [],
            likes_count=counts.get(reply.id, 0),
            liked=reply.id in liked_ids,
        )
        for reply in replies
    ]
    return _response(
        comment,
        reply_responses,
        likes_count=counts.get(comment.id, 0),
        liked=comment.id in liked_ids,
    )


async def get_comment_likes(
    uow: UnitOfWork,
    comment_id: uuid.UUID,
    *,
    viewer_id: uuid.UUID,
) -> CommentLikeResponse | None:
    """Return one comment's active likes and the caller's own state."""
    if await uow.comments.get_by_id(comment_id) is None:
        return None
    likes_count = max(0, await uow.comment_likes.count_for_comment(comment_id))
    liked = await uow.comment_likes.has_liked(comment_id, viewer_id)
    return CommentLikeResponse(
        comment_id=comment_id,
        likes_count=likes_count,
        liked=liked,
    )
