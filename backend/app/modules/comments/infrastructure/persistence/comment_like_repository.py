"""Persistence for the likes of blog comments and replies."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.comments.infrastructure.persistence.models import BlogCommentLike


class BlogCommentLikeRepository:
    """Read and remove the active likes of comments and replies."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def has_liked(self, comment_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(BlogCommentLike.id).where(
                BlogCommentLike.comment_id == comment_id,
                BlogCommentLike.user_id == user_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def count_for_comment(self, comment_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(BlogCommentLike.id)).where(BlogCommentLike.comment_id == comment_id)
        )
        return int(result.scalar_one())

    async def counts_for_comments(self, comment_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
        """The active-like count of every requested comment."""
        if not comment_ids:
            return {}
        result = await self._session.execute(
            select(BlogCommentLike.comment_id, func.count(BlogCommentLike.id))
            .where(BlogCommentLike.comment_id.in_(comment_ids))
            .group_by(BlogCommentLike.comment_id)
        )
        return {comment_id: int(count) for comment_id, count in result.all()}

    async def liked_comment_ids(
        self, comment_ids: Sequence[uuid.UUID], user_id: uuid.UUID
    ) -> set[uuid.UUID]:
        """The requested comments that this member has liked."""
        if not comment_ids:
            return set()
        result = await self._session.execute(
            select(BlogCommentLike.comment_id).where(
                BlogCommentLike.comment_id.in_(comment_ids),
                BlogCommentLike.user_id == user_id,
            )
        )
        return set(result.scalars().all())
