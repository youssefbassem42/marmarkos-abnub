import uuid

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

    async def get_by_id(self, post_id: uuid.UUID) -> BlogPost | None:
        result = await self._session.execute(
            select(BlogPost)
            .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
            .where(BlogPost.id == post_id)
        )
        return result.scalar_one_or_none()

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
            from datetime import datetime

            post.published_at = datetime.now()
        await self._session.flush()
