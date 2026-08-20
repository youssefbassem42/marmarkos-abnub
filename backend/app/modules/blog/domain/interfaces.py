"""Repository interfaces for the blog module."""

import uuid
from typing import Protocol

from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.models import (
    BlogCategory,
    BlogPost,
)


class BlogPostRepository(Protocol):
    async def get_by_id(self, post_id: uuid.UUID) -> BlogPost | None: ...

    async def get_by_slug(self, slug: str) -> BlogPost | None: ...

    async def exists_slug(self, slug: str) -> bool: ...

    async def add(self, post: BlogPost) -> None: ...

    async def list_published(
        self,
        *,
        category_slug: str | None = None,
        search: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[BlogPost]: ...

    async def set_status(self, post: BlogPost, status: PostStatus) -> None: ...


class BlogCategoryRepository(Protocol):
    async def get_by_slug(self, slug: str) -> BlogCategory | None: ...

    async def add(self, category: BlogCategory) -> None: ...

    async def list_all(self) -> list[BlogCategory]: ...


class BlogPostLikeRepository(Protocol):
    async def toggle(self, post_id: uuid.UUID, user_id: uuid.UUID) -> bool: ...

    async def count_for_post(self, post_id: uuid.UUID) -> int: ...

    async def has_liked(self, post_id: uuid.UUID, user_id: uuid.UUID) -> bool: ...
