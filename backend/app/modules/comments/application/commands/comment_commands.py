"""Command use cases for the comments of a blog post (Phase 7.6).

The browser's HTML is sanitised and counted before it is stored.  Ownership
is deliberately narrow: only the author of a comment may edit it, while the
author, an administrator, or a servant may delete it (BR-77).
"""

from __future__ import annotations

import uuid

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.time.clock import now_utc
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.models import BlogPost
from app.modules.comments.application.dto.comment_dto import (
    CommentCreateRequest,
    CommentUpdateRequest,
)
from app.modules.comments.application.services.comment_content import (
    count_comment_words,
    sanitize_comment_html,
)
from app.modules.comments.domain.enums.comment_status import CommentStatus
from app.modules.comments.domain.events.comment_created import CommentCreated
from app.modules.comments.infrastructure.persistence.models import Comment
from app.modules.users.infrastructure.persistence.models import User
from app.shared.contracts.users import RoleName
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

MAX_COMMENT_WORDS = 500


def _may_manage_post(actor: User, post: BlogPost) -> bool:
    """True when the member sees the post in the administration."""
    return actor.id == post.author_id or actor.role.name in {
        RoleName.ADMIN,
        RoleName.SERVANT,
    }


async def _require_published_post(uow: UnitOfWork, post_id: uuid.UUID, actor: User) -> None:
    """A member may comment only on a post that is visible to members.

    The manager of a post (its author, an administrator, a servant) sees
    the draft in the administration, so telling them "not found" would
    be a lie: they are told the truth. Everybody else gets the answer of
    a post that does not exist, so a draft cannot be discovered (BR-64).
    """
    post = await uow.blog_posts.get_by_id(post_id)
    if post is None:
        raise NotFoundError("Post not found")
    if post.status is not PostStatus.PUBLISHED or (
        post.published_at is not None and post.published_at > now_utc()
    ):
        if _may_manage_post(actor, post):
            raise ConflictError("The post is not published yet")
        raise NotFoundError("Post not found")


def _prepare_content(value: str) -> str:
    """Sanitize the editor HTML and enforce the backend word limit."""
    sanitized = sanitize_comment_html(value)
    word_count = count_comment_words(sanitized)
    if word_count == 0:
        raise ValidationError("The comment must contain visible text")
    if word_count > MAX_COMMENT_WORDS:
        raise ValidationError("The comment must contain at most 500 words")
    return sanitized


async def _require_parent(
    uow: UnitOfWork,
    post_id: uuid.UUID,
    parent_comment_id: uuid.UUID,
) -> Comment:
    """Load a reply target that belongs to the same visible thread."""
    parent = await uow.comments.get_by_id(parent_comment_id)
    if parent is None or parent.post_id != post_id or parent.status is not CommentStatus.VISIBLE:
        raise NotFoundError("Parent comment not found")
    return parent


async def create_comment(
    uow: UnitOfWork,
    actor: User,
    post_id: uuid.UUID,
    payload: CommentCreateRequest,
) -> Comment:
    """Create a top-level comment or a reply and record its domain event."""
    await _require_published_post(uow, post_id, actor)
    content = _prepare_content(payload.content)

    parent: Comment | None = None
    if payload.parent_comment_id is not None:
        parent = await _require_parent(uow, post_id, payload.parent_comment_id)

    comment = Comment(
        post_id=post_id,
        user_id=actor.id,
        parent_comment_id=parent.id if parent is not None else None,
        content=content,
        status=CommentStatus.VISIBLE,
    )
    await uow.comments.add(comment)
    uow.record(
        CommentCreated(
            aggregate_id=comment.id,
            post_id=post_id,
            author_id=actor.id,
            parent_comment_id=comment.parent_comment_id,
        )
    )
    await uow.audit.record(
        action="comment.create",
        entity_type="comment",
        entity_id=str(comment.id),
        actor_user_id=actor.id,
        metadata={"post_id": str(post_id), "parent_comment_id": str(parent.id) if parent else None},
    )
    return comment


async def update_comment(
    uow: UnitOfWork,
    actor: User,
    comment_id: uuid.UUID,
    payload: CommentUpdateRequest,
) -> Comment:
    """Edit a comment; its owner is the only member allowed to do so."""
    comment = await uow.comments.get_by_id(comment_id)
    if comment is None or comment.status is not CommentStatus.VISIBLE:
        raise NotFoundError("Comment not found")
    if actor.id != comment.user_id:
        raise ForbiddenError("Only the owner of a comment may edit it")

    comment.content = _prepare_content(payload.content)
    await uow.audit.record(
        action="comment.update",
        entity_type="comment",
        entity_id=str(comment.id),
        actor_user_id=actor.id,
    )
    return comment


async def delete_comment(uow: UnitOfWork, actor: User, comment_id: uuid.UUID) -> Comment:
    """Delete a comment and its replies; its owner, admin, or servant may."""
    comment = await uow.comments.get_by_id(comment_id)
    if comment is None:
        raise NotFoundError("Comment not found")

    may_delete = actor.id == comment.user_id or actor.role.name in {
        RoleName.ADMIN,
        RoleName.SERVANT,
    }
    if not may_delete:
        raise ForbiddenError("Only the owner, an admin, or a servant may delete a comment")

    await uow.audit.record(
        action="comment.delete",
        entity_type="comment",
        entity_id=str(comment.id),
        actor_user_id=actor.id,
    )
    await uow.comments.delete_subtree(comment.id)
    return comment
