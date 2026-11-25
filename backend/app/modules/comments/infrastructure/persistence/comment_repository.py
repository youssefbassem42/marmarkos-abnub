import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.comments.domain.enums.comment_status import CommentStatus
from app.modules.comments.infrastructure.persistence.models import Comment


class CommentRepository:
    """Comment/reply persistence with moderation and hard deletion.

    Moderation may hide or flag a branch. A member's deletion removes the
    selected row; the database's self-referencing cascade removes its
    whole reply subtree in the same transaction.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, comment_id: uuid.UUID) -> Comment | None:
        result = await self._session.execute(
            select(Comment)
            .options(
                selectinload(Comment.author),
                selectinload(Comment.post),
                selectinload(Comment.replies),
            )
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

    async def delete_subtree(self, comment_id: uuid.UUID) -> None:
        """Delete a comment and every reply below it.

        The ``comments.parent_comment_id`` foreign key uses
        ``ON DELETE CASCADE``. A Core delete bypasses ORM relationship
        bookkeeping, so PostgreSQL owns the recursive removal atomically.
        """
        await self._session.execute(delete(Comment).where(Comment.id == comment_id))
        await self._session.flush()

    async def count_for_post(self, post_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(Comment.id)).where(
                Comment.post_id == post_id, Comment.status == CommentStatus.VISIBLE
            )
        )
        return int(result.scalar_one())

    async def counts_for_posts(self, post_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        """Count the comments of a whole page with one grouped query.

        The blog needs the number of the comments of every card of the
        list. The count belongs to the comments (they own the rows and
        the state), and the blog asks for it through the unit of work:
        importing the model of the comments into the blog would close an
        import cycle (the comments already know the posts).
        """
        if not post_ids:
            return {}
        result = await self._session.execute(
            select(Comment.post_id, func.count(Comment.id))
            .where(Comment.post_id.in_(post_ids))
            .group_by(Comment.post_id)
        )
        return {post_id: int(count) for post_id, count in result.all()}
