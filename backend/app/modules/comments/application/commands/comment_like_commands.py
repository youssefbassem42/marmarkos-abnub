"""Like and unlike commands for a blog comment or reply (BR-87)."""

from __future__ import annotations

import uuid

from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.comments.application.dto.comment_dto import CommentLikeResponse
from app.modules.comments.domain.enums.comment_status import CommentStatus
from app.modules.comments.infrastructure.persistence.models import (
    BlogCommentLike,
    Comment,
)
from app.modules.notifications.application.services.notification_service import (
    NotificationService,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def _require_comment(uow: UnitOfWork, comment_id: uuid.UUID) -> Comment:
    comment = await uow.comments.get_by_id(comment_id)
    if comment is None or comment.status is not CommentStatus.VISIBLE:
        raise NotFoundError("Comment not found")
    return comment


def _display_name(user: User) -> str:
    return " ".join(part for part in (user.first_name, user.last_name) if part) or "عضو"


async def _response(
    uow: UnitOfWork,
    comment_id: uuid.UUID,
    *,
    liked: bool,
) -> CommentLikeResponse:
    likes_count = max(0, await uow.comment_likes.count_for_comment(comment_id))
    return CommentLikeResponse(
        comment_id=comment_id,
        likes_count=likes_count,
        liked=liked,
    )


async def like_comment(
    uow: UnitOfWork,
    actor: User,
    comment_id: uuid.UUID,
) -> CommentLikeResponse:
    """Like a comment or reply once; a repeated request is idempotent."""
    comment = await _require_comment(uow, comment_id)
    if await uow.comment_likes.has_liked(comment_id, actor.id):
        return await _response(uow, comment_id, liked=True)

    uow.session.add(BlogCommentLike(comment_id=comment_id, user_id=actor.id))
    try:
        await uow.session.flush()
    except IntegrityError as exc:
        raise ConflictError("The comment is already liked") from exc

    await NotificationService(uow).notify_blog_comment_liked(
        post_id=comment.post_id,
        comment_id=comment.id,
        slug=comment.post.slug,
        comment_author_id=comment.user_id,
        liker_id=actor.id,
        liker_name=_display_name(actor),
    )
    return await _response(uow, comment_id, liked=True)


async def unlike_comment(
    uow: UnitOfWork,
    actor: User,
    comment_id: uuid.UUID,
) -> CommentLikeResponse:
    """Take back the caller's like; doing it twice stays successful."""
    await _require_comment(uow, comment_id)
    await uow.session.execute(
        delete(BlogCommentLike).where(
            BlogCommentLike.comment_id == comment_id,
            BlogCommentLike.user_id == actor.id,
        )
    )
    return await _response(uow, comment_id, liked=False)
