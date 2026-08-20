import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.blog.infrastructure.persistence.models import BlogPostLike


class BlogPostLikeRepository:
    """Like/unlike: physical delete for unlike (no audit requirement).

    The unique (post_id, user_id) constraint prevents duplicates. The
    toggle is race-safe: ``INSERT ... ON CONFLICT DO NOTHING`` decides
    the outcome atomically without poisoning the surrounding transaction.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def toggle(self, post_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Like or unlike; returns True when the post is now liked."""
        insert_stmt = (
            pg_insert(BlogPostLike)
            .values(post_id=post_id, user_id=user_id)
            .on_conflict_do_nothing()
        )
        result = await self._session.execute(insert_stmt)
        assert isinstance(result, CursorResult)
        if result.rowcount == 1:
            return True
        await self._session.execute(
            delete(BlogPostLike).where(
                BlogPostLike.post_id == post_id, BlogPostLike.user_id == user_id
            )
        )
        return False

    async def has_liked(self, post_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(BlogPostLike.id).where(
                BlogPostLike.post_id == post_id, BlogPostLike.user_id == user_id
            )
        )
        return result.scalar_one_or_none() is not None

    async def count_for_post(self, post_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(BlogPostLike.id)).where(BlogPostLike.post_id == post_id)
        )
        return int(result.scalar_one())
