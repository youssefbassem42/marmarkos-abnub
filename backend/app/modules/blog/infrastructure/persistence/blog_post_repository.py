import uuid
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.models import (
    BlogCategory,
    BlogPost,
)


class BlogPostRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, post_id: uuid.UUID, *, for_update: bool = False) -> BlogPost | None:
        """Load one post; ``for_update`` locks the row for the transaction.

        The lock is what makes the publication of a scheduled post safe when
        two ticks run at the same time (BR-64).
        """
        stmt = (
            select(BlogPost)
            .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
            .where(BlogPost.id == post_id)
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def claim_due_for_publication(self, *, limit: int, now: datetime) -> list[BlogPost]:
        """Claim the scheduled posts whose date has come (BR-64).

        ``SELECT … FOR UPDATE SKIP LOCKED`` serialises the concurrent ticks:
        each post is claimed by one of them. The claim is a lease of the
        transaction: the post stays a draft until it is published, and the
        status change happens under a row lock.
        """
        stmt = (
            select(BlogPost)
            .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
            .where(
                BlogPost.status == PostStatus.DRAFT,
                BlogPost.published_at.is_not(None),
                BlogPost.published_at <= now,
            )
            .order_by(BlogPost.published_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_slug(self, slug: str) -> BlogPost | None:
        result = await self._session.execute(
            select(BlogPost)
            .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
            .where(BlogPost.slug == slug)
        )
        return result.scalar_one_or_none()

    async def exists_slug(self, slug: str) -> bool:
        result = await self._session.execute(
            select(BlogPost.id).where(BlogPost.slug == slug).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def add(self, post: BlogPost) -> None:
        self._session.add(post)
        await self._session.flush()

    async def list_published(
        self,
        *,
        category_slug: str | None = None,
        search: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[BlogPost]:
        stmt = (
            select(BlogPost)
            .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
            .where(BlogPost.status == PostStatus.PUBLISHED)
            .order_by(BlogPost.published_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if category_slug is not None:
            stmt = stmt.join(BlogPost.categories).where(BlogCategory.slug == category_slug)
        if search is not None:
            stmt = stmt.where(
                or_(
                    BlogPost.title.ilike(f"%{search}%"),
                    BlogPost.excerpt.ilike(f"%{search}%"),
                )
            )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def set_status(self, post: BlogPost, status: PostStatus) -> None:
        post.status = status
        if status is PostStatus.PUBLISHED and post.published_at is None:
            from app.core.time.clock import now_utc

            post.published_at = now_utc()
        await self._session.flush()
