"""Blog-post query use cases (Phase 7.2).

The member queries expose published posts only.  An administrator or a
servant may list and read every lifecycle state from the same routes, but
a member's view is never widened by a status filter (BR-64/BR-89).
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.selectable import ScalarSelect

from app.core.pagination import Page, PageParams
from app.core.time.clock import now_utc
from app.modules.blog.application.dto.post_dto import (
    BlogAuthorResponse,
    BlogPostAdminResponse,
    BlogPostDetailResponse,
    BlogPostSummaryResponse,
    BlogShortLinkResponse,
    BlogTagResponse,
)
from app.modules.blog.domain.enums.post_status import PostStatus, PostStatusFilter
from app.modules.blog.infrastructure.persistence.models import (
    BlogCategory,
    BlogPost,
    BlogPostLike,
)
from app.modules.comments.infrastructure.persistence.models import Comment
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


def _summary(
    post: BlogPost,
    likes_count: int,
    comments_count: int,
) -> BlogPostSummaryResponse:
    return BlogPostSummaryResponse(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        cover_image=post.cover_image,
        tags=_tags(post),
        likes_count=max(0, likes_count),
        comments_count=max(0, comments_count),
        status=post.status.value,
        published_at=post.published_at,
        author=_author(post),
    )


def _detail(
    post: BlogPost,
    likes_count: int,
    comments_count: int,
) -> BlogPostDetailResponse:
    return BlogPostDetailResponse(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        body=post.content,
        cover_image=post.cover_image,
        tags=_tags(post),
        likes_count=max(0, likes_count),
        comments_count=max(0, comments_count),
        status=post.status.value,
        short_code=post.short_code or "",
        published_at=post.published_at,
        author=_author(post),
    )


def _admin(
    post: BlogPost,
    likes_count: int,
    comments_count: int,
) -> BlogPostAdminResponse:
    return BlogPostAdminResponse(
        id=post.id,
        title=post.title,
        excerpt=post.excerpt,
        body=post.content,
        cover_image=post.cover_image,
        tags=_tags(post),
        likes_count=max(0, likes_count),
        comments_count=max(0, comments_count),
        status=post.status.value,
        short_code=post.short_code or "",
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


def _likes_count_query() -> ScalarSelect[int]:
    return (
        select(func.count(BlogPostLike.id))
        .where(BlogPostLike.post_id == BlogPost.id)
        .correlate(BlogPost)
        .scalar_subquery()
    )


def _comments_count_query() -> ScalarSelect[int]:
    return (
        select(func.count(Comment.id))
        .where(Comment.post_id == BlogPost.id)
        .correlate(BlogPost)
        .scalar_subquery()
    )


async def _comment_counts(
    uow: UnitOfWork,
    post_ids: list[uuid.UUID],
) -> dict[uuid.UUID, int]:
    """Count the comments of a whole page with one grouped query."""
    if not post_ids:
        return {}
    result = await uow.session.execute(
        select(Comment.post_id, func.count(Comment.id))
        .where(Comment.post_id.in_(post_ids))
        .group_by(Comment.post_id)
    )
    return {post_id: int(count) for post_id, count in result.all()}


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

    likes_count = _likes_count_query()
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
    rows = result.all()
    comments_counts = await _comment_counts(uow, [post.id for post, _ in rows])
    posts = [
        _summary(post, int(likes_count), comments_counts.get(post.id, 0))
        for post, likes_count in rows
    ]
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
    likes_count = _likes_count_query()
    comments_count = _comments_count_query()
    result = await uow.session.execute(
        select(BlogPost, likes_count.label("likes_count"), comments_count.label("comments_count"))
        .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
        .where(BlogPost.id == post_id)
    )
    row = result.one_or_none()
    if row is None:
        return None
    post, post_likes_count, post_comments_count = row

    is_public = post.status is PostStatus.PUBLISHED and (
        post.published_at is None or post.published_at <= now_utc()
    )
    may_manage = viewer is not None and (viewer.id == post.author_id or _is_manager(viewer))
    if not is_public and not may_manage:
        return None
    return _detail(post, int(post_likes_count), int(post_comments_count))


async def get_short_link(
    uow: UnitOfWork,
    code: str,
) -> BlogShortLinkResponse | None:
    """Resolve a stable tiny code to its post (BR-90)."""
    result = await uow.session.execute(
        select(BlogPost.id, BlogPost.slug).where(BlogPost.short_code == code)
    )
    row = result.one_or_none()
    if row is None:
        return None
    post_id, slug = row
    return BlogShortLinkResponse(post_id=post_id, slug=slug)


async def get_admin_post(uow: UnitOfWork, post_id: uuid.UUID) -> BlogPostAdminResponse | None:
    """Return one post with its administration fields."""
    likes_count = _likes_count_query()
    comments_count = _comments_count_query()
    result = await uow.session.execute(
        select(BlogPost, likes_count.label("likes_count"), comments_count.label("comments_count"))
        .options(selectinload(BlogPost.author), selectinload(BlogPost.categories))
        .where(BlogPost.id == post_id)
    )
    row = result.one_or_none()
    if row is None:
        return None
    post, post_likes_count, post_comments_count = row
    return _admin(post, int(post_likes_count), int(post_comments_count))
