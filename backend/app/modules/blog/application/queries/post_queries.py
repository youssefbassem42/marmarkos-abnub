"""Blog-post query use cases (Phase 7.2).

The member queries expose published posts only.  The administration
query exposes every lifecycle state so that drafts, scheduled posts,
and archived posts remain manageable (BR-63/BR-65).
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.core.pagination import Page, PageParams
from app.core.time.clock import now_utc
from app.modules.blog.application.dto.post_dto import (
    BlogAuthorResponse,
    BlogPostAdminResponse,
    BlogPostDetailResponse,
    BlogPostSummaryResponse,
    BlogTagResponse,
)
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.models import BlogCategory, BlogPost
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


def _author(post: BlogPost) -> BlogAuthorResponse:
    parts = [post.author.first_name, post.author.last_name]
    full_name = " ".join(part for part in parts if part)
    return BlogAuthorResponse(id=post.author.id, full_name=full_name)


def _tags(post: BlogPost) -> list[BlogTagResponse]:
    return [
        BlogTagResponse(id=category.id, name=category.name, slug=category.slug)
        for category in sorted(post.categories, key=lambda category: category.name)
    ]


def _summary(post: BlogPost) -> BlogPostSummaryResponse:
    return BlogPostSummaryResponse(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        cover_image=post.cover_image,
        tags=_tags(post),
        published_at=post.published_at,
        author=_author(post),
    )


def _detail(post: BlogPost) -> BlogPostDetailResponse:
    return BlogPostDetailResponse(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        body=post.content,
        cover_image=post.cover_image,
        tags=_tags(post),
        published_at=post.published_at,
        author=_author(post),
    )


def _admin(post: BlogPost) -> BlogPostAdminResponse:
    return BlogPostAdminResponse(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        body=post.content,
        cover_image=post.cover_image,
        tags=_tags(post),
        status=post.status.value,
        published_at=post.published_at,
        author=_author(post),
        author_id=post.author_id,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


async def list_public_posts(
    uow: UnitOfWork,
    page: PageParams,
    *,
    tag: str | None = None,
    search: str | None = None,
) -> Page[BlogPostSummaryResponse]:
    """List published posts, optionally filtered by tag and title search."""
    conditions = [
        BlogPost.status == PostStatus.PUBLISHED,
        or_(BlogPost.published_at.is_(None), BlogPost.published_at <= now_utc()),
    ]
    join_categories = False
    if tag:
        join_categories = True
        conditions.append(or_(BlogCategory.slug == tag, BlogCategory.name == tag))
    if search:
        conditions.append(BlogPost.title.ilike(f"%{search.strip()}%"))

    statement = select(BlogPost).options(
        selectinload(BlogPost.author),
        selectinload(BlogPost.categories),
    )
    count_statement = select(func.count(BlogPost.id))
    if join_categories:
        statement = statement.join(BlogPost.categories)
        count_statement = count_statement.join(BlogPost.categories)
    statement = statement.where(*conditions).order_by(
        BlogPost.published_at.desc().nullslast(), BlogPost.created_at.desc()
    )
    count_statement = count_statement.where(*conditions)

    total = int((await uow.session.execute(count_statement)).scalar_one())
    result = await uow.session.execute(statement.limit(page.size).offset(page.offset))
    posts = list(result.scalars().unique().all())
    return Page.build([_summary(post) for post in posts], total, page)


async def get_public_post_detail(
    uow: UnitOfWork, post_id: uuid.UUID
) -> BlogPostDetailResponse | None:
    """Return a published post; a draft, scheduled, or archived row is hidden."""
    result = await uow.session.execute(
        select(BlogPost)
        .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
        .where(
            BlogPost.id == post_id,
            BlogPost.status == PostStatus.PUBLISHED,
            or_(BlogPost.published_at.is_(None), BlogPost.published_at <= now_utc()),
        )
    )
    post = result.scalar_one_or_none()
    return _detail(post) if post is not None else None


async def list_admin_posts(uow: UnitOfWork, page: PageParams) -> Page[BlogPostAdminResponse]:
    """List every post for the administration, newest first."""
    total = int((await uow.session.execute(select(func.count(BlogPost.id)))).scalar_one())
    result = await uow.session.execute(
        select(BlogPost)
        .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
        .order_by(BlogPost.created_at.desc())
        .limit(page.size)
        .offset(page.offset)
    )
    posts = list(result.scalars().unique().all())
    return Page.build([_admin(post) for post in posts], total, page)


async def get_admin_post(uow: UnitOfWork, post_id: uuid.UUID) -> BlogPostAdminResponse | None:
    """Return one post with its administration fields."""
    result = await uow.session.execute(
        select(BlogPost)
        .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
        .where(BlogPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    return _admin(post) if post is not None else None
