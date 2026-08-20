import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.comments.domain.enums.comment_status import CommentStatus
from app.modules.comments.infrastructure.persistence.models import Comment


class CommentRepository:
    """Comment/reply persistence with moderation.

    Comments are never physically deleted: moderators flip ``status``
    (VISIBLE/HIDDEN/DELETED/FLAGGED).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, comment_id: uuid.UUID) -> Comment | None:
        result = await self._session.execute(
            select(Comment)
            .options(selectinload(Comment.author), selectinload(Comment.replies))
            .where(Comment.id == comment_id)
        )
        return result.scalar_one_or_none()

    async def add(self, comment: Comment) -> None:
        self._session.add(comment)
        await self._session.flush()

    async def list_by_post(self, post_id: uuid.UUID, include_hidden: bool = False) -> list[Comment]:
        stmt = (
            select(Comment)
            .options(selectinload(Comment.author), selectinload(Comment.parent))
            .where(Comment.post_id == post_id)
            .order_by(Comment.created_at)
        )
        if not include_hidden:
            stmt = stmt.where(Comment.status == CommentStatus.VISIBLE)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def set_status(self, comment: Comment, status: CommentStatus) -> None:
        comment.status = status
        await self._session.flush()

    async def count_for_post(self, post_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(Comment.id)).where(
                Comment.post_id == post_id, Comment.status == CommentStatus.VISIBLE
            )
        )
        return int(result.scalar_one())
