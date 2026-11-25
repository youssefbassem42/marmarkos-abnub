"""Blog-post query use cases (Phase 7.2).

The member queries expose published posts only.  An administrator or a
servant may list and read every lifecycle state from the same routes, but
a member's view is never widened by a status filter (BR-64/BR-86).
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.core.pagination import Page, PageParams
from app.core.time.clock import now_utc
from app.modules.blog.application.dto.post_dto import (
    BlogAuthorResponse,
    BlogPostAdminResponse,
    BlogPostDetailResponse,
    BlogPostSummaryResponse,
    BlogTagResponse,
)
from app.modules.blog.domain.enums.post_status import PostStatus, PostStatusFilter
from app.modules.blog.infrastructure.persistence.models import (
    BlogCategory,
    BlogPost,
    BlogPostLike,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.contracts.users import RoleName
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


def _is_manager(viewer: User | None) -> bool:
    return viewer is not None and viewer.role.name in (RoleName.ADMIN, RoleName.SERVANT)


def _author(post: BlogPost) -> BlogAuthorResponse:
    parts = [post.author.first_name, post.author.last_name]
    full_name = " ".join(part for part in parts if part)
    return BlogAuthorResponse(id=post.author.id, full_name=full_name)


def _tags(post: BlogPost) -> list[BlogTagResponse]:
    return [
        BlogTagResponse(id=category.id, name=category.name, slug=category.slug)
        for category in sorted(post.categories, key=lambda category: category.name)
    ]


def _summary(post: BlogPost, likes_count: int) -> BlogPostSummaryResponse:
    return BlogPostSummaryResponse(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        cover_image=post.cover_image,
        tags=_tags(post),
        likes_count=max(0, likes_count),
        status=post.status.value,
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
        status=post.status.value,
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


def _status_conditions(status_filter: PostStatusFilter) -> list[ColumnElement[bool]]:
    """Translate the list filter into the stored lifecycle state.

    The database keeps a scheduled post as a draft (BR-63).  The public
    filter still distinguishes the two: an unscheduled draft has no
    publication date, while a scheduled draft has one.
    """
    if status_filter is PostStatusFilter.DRAFT:
        return [BlogPost.status == PostStatus.DRAFT, BlogPost.published_at.is_(None)]
    if status_filter is PostStatusFilter.SCHEDULED:
        return [BlogPost.status == PostStatus.DRAFT, BlogPost.published_at.is_not(None)]
    return [BlogPost.status == PostStatus(status_filter.value)]


async def list_blog_posts(
    uow: UnitOfWork,
    page: PageParams,
    *,
    viewer: User | None,
    status_filter: PostStatusFilter | None = None,
    tag: str | None = None,
    search: str | None = None,
) -> Page[BlogPostSummaryResponse]:
    """List the posts visible to the caller, with the requested filters."""
    manager = _is_manager(viewer)
    conditions: list[ColumnElement[bool]] = []

    if not manager:
        # A member (and an anonymous reader) only ever receives published
        # and due posts.  A status filter cannot widen that view.
        conditions.extend(
            [
                BlogPost.status == PostStatus.PUBLISHED,
                or_(BlogPost.published_at.is_(None), BlogPost.published_at <= now_utc()),
            ]
        )
    elif status_filter is not None:
        conditions.extend(_status_conditions(status_filter))

    join_categories = False
    if tag:
        join_categories = True
        conditions.append(or_(BlogCategory.slug == tag, BlogCategory.name == tag))
    if search:
        conditions.append(BlogPost.title.ilike(f"%{search.strip()}%"))

    likes_count = (
        select(func.count(BlogPostLike.id))
        .where(BlogPostLike.post_id == BlogPost.id)
        .correlate(BlogPost)
        .scalar_subquery()
    )
    statement = select(BlogPost, likes_count.label("likes_count")).options(
        selectinload(BlogPost.author),
        selectinload(BlogPost.categories),
    )
    count_statement = select(func.count(BlogPost.id))
    if join_categories:
        statement = statement.join(BlogPost.categories)
        count_statement = count_statement.join(BlogPost.categories)
    statement = statement.where(*conditions)
    count_statement = count_statement.where(*conditions)

    if manager:
        statement = statement.order_by(BlogPost.created_at.desc())
    else:
        statement = statement.order_by(
            BlogPost.published_at.desc().nullslast(), BlogPost.created_at.desc()
        )

    total = int((await uow.session.execute(count_statement)).scalar_one())
    result = await uow.session.execute(statement.limit(page.size).offset(page.offset))
    posts = [_summary(post, int(likes_count)) for post, likes_count in result.all()]
    return Page.build(posts, total, page)


async def get_post_detail(
    uow: UnitOfWork,
    post_id: uuid.UUID,
    viewer: User | None,
) -> BlogPostDetailResponse | None:
    """Return one post when it is visible to the caller.

    A published and due post is visible to everybody.  Its author, an
    administrator, and a servant may also read a draft, a scheduled post,
    or an archived post.  Every other reader receives ``None`` (BR-64).
    """
    result = await uow.session.execute(
        select(BlogPost)
        .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
        .where(BlogPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if post is None:
        return None

    is_public = post.status is PostStatus.PUBLISHED and (
        post.published_at is None or post.published_at <= now_utc()
    )
    may_manage = viewer is not None and (viewer.id == post.author_id or _is_manager(viewer))
    if not is_public and not may_manage:
        return None
    return _detail(post)


async def get_admin_post(uow: UnitOfWork, post_id: uuid.UUID) -> BlogPostAdminResponse | None:
    """Return one post with its administration fields."""
    result = await uow.session.execute(
        select(BlogPost)
        .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
        .where(BlogPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    return _admin(post) if post is not None else None
