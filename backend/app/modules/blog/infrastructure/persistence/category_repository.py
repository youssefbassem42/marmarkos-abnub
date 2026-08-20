from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.blog.infrastructure.persistence.models import BlogCategory


class BlogCategoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_slug(self, slug: str) -> BlogCategory | None:
        result = await self._session.execute(select(BlogCategory).where(BlogCategory.slug == slug))
        return result.scalar_one_or_none()

    async def add(self, category: BlogCategory) -> None:
        self._session.add(category)
        await self._session.flush()

    async def list_all(self) -> list[BlogCategory]:
        result = await self._session.execute(select(BlogCategory).order_by(BlogCategory.name))
        return list(result.scalars().all())
