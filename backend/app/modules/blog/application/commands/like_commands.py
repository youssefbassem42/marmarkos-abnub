"""Like and unlike commands for a blog post.

A repeated like is idempotent: it leaves the single active like in place.
Two truly concurrent first likes still race at the unique database index;
the loser is reported as a conflict rather than as a server error
(BR-69/BR-70).
"""

from __future__ import annotations

import uuid

from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.blog.application.dto.like_dto import LikeResponse
from app.modules.blog.infrastructure.persistence.models import BlogPost, BlogPostLike
from app.modules.notifications.application.services.notification_service import (
    NotificationService,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def _require_post(uow: UnitOfWork, post_id: uuid.UUID) -> BlogPost:
    post = await uow.blog_posts.get_by_id(post_id)
    if post is None:
        raise NotFoundError("Post not found")
    return post


def _display_name(user: User) -> str:
    return " ".join(part for part in (user.first_name, user.last_name) if part) or "عضو"


async def _like_response(
    uow: UnitOfWork,
    post_id: uuid.UUID,
    *,
    liked: bool,
) -> LikeResponse:
    likes_count = max(0, await uow.blog_likes.count_for_post(post_id))
    return LikeResponse(post_id=post_id, likes_count=likes_count, liked=liked)


async def like_post(
    uow: UnitOfWork,
    actor: User,
    post_id: uuid.UUID,
) -> LikeResponse:
    """Like a post once; a repeated request keeps the same like (BR-70)."""
    post = await _require_post(uow, post_id)

    if await uow.blog_likes.has_liked(post_id, actor.id):
        return await _like_response(uow, post_id, liked=True)

    uow.session.add(BlogPostLike(post_id=post_id, user_id=actor.id))
    try:
        await uow.session.flush()
    except IntegrityError as exc:
        # A concurrent request inserted the unique (post, user) pair first.
        raise ConflictError("The post is already liked") from exc

    await NotificationService(uow).notify_blog_post_liked(
        post_id=post_id,
        author_id=post.author_id,
        slug=post.slug,
        liker_id=actor.id,
        liker_name=_display_name(actor),
    )
    return await _like_response(uow, post_id, liked=True)


async def unlike_post(
    uow: UnitOfWork,
    actor: User,
    post_id: uuid.UUID,
) -> LikeResponse:
    """Take back the caller's like; doing it twice is still successful (BR-71)."""
    await _require_post(uow, post_id)
    await uow.session.execute(
        delete(BlogPostLike).where(
            BlogPostLike.post_id == post_id,
            BlogPostLike.user_id == actor.id,
        )
    )
    return await _like_response(uow, post_id, liked=False)
