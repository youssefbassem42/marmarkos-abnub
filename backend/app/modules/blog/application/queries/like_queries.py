"""Read queries for the likes of a blog post (Phase 7.8).

The count is public.  When the caller is signed in, the answer also says
whether that member is one of the members who liked the post (BR-69).
"""

from __future__ import annotations

import uuid

from app.modules.blog.application.dto.like_dto import LikeResponse
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def get_post_likes(
    uow: UnitOfWork,
    post_id: uuid.UUID,
    viewer: User | None,
) -> LikeResponse | None:
    """Return the active likes of a post, or ``None`` when it does not exist."""
    if await uow.blog_posts.get_by_id(post_id) is None:
        return None

    likes_count = max(0, await uow.blog_likes.count_for_post(post_id))
    liked = viewer is not None and await uow.blog_likes.has_liked(post_id, viewer.id)
    return LikeResponse(post_id=post_id, likes_count=likes_count, liked=liked)
