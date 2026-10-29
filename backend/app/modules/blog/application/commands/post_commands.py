"""Blog-post command use cases (Phase 7.2).

A future publication date is a derived schedule: the row stays
``DRAFT`` and the shared scheduler publishes it when the date passes
(BR-63/BR-64).  Deletion archives the row and never removes it (BR-65).
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.core.exceptions import ForbiddenError, InvalidScheduleError, NotFoundError, ValidationError
from app.core.time.clock import now_utc, platform_timezone
from app.modules.blog.application.dto.post_dto import (
    BlogPostCreateRequest,
    BlogPostScheduleRequest,
    BlogPostUpdateRequest,
)
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.domain.events.blog_post_published import BlogPostPublished
from app.modules.blog.infrastructure.persistence.models import BlogCategory, BlogPost
from app.shared.contracts.users import RoleName

if TYPE_CHECKING:
    from app.modules.users.infrastructure.persistence.models import User
    from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

_TAG_SEPARATOR = re.compile(r"[^0-9a-z\u0600-\u06ff]+")


def assert_writer(actor: User) -> None:
    """D-6/BR-61: only an admin or a servant may write a post."""
    if actor.role.name not in (RoleName.ADMIN, RoleName.SERVANT):
        raise ForbiddenError("Only an admin or a servant may write blog posts")


def assert_can_manage(actor: User, post: BlogPost) -> None:
    """BR-62: the author, an admin, or a servant may manage the post."""
    assert_writer(actor)
    if actor.id != post.author_id and actor.role.name not in (RoleName.ADMIN, RoleName.SERVANT):
        raise ForbiddenError("Only the author, an admin, or a servant may manage this post")


def _as_utc(value: datetime) -> datetime:
    """Interpret a naive date in the platform timezone and return UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=platform_timezone())
    return value.astimezone(UTC)


def _slug_part(value: str, *, fallback: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).strip().lower()
    slug = _TAG_SEPARATOR.sub("-", normalized).strip("-")
    return slug or fallback


def _post_slug(title: str) -> str:
    """Build a stable, URL-safe and unique slug from an Arabic title."""
    base = _slug_part(title, fallback="post")[:220]
    return f"{base}-{uuid.uuid4().hex[:12]}"


def _tag_name(value: str) -> str:
    name = " ".join(value.split())
    if not name:
        raise ValidationError("Tag names must not be empty")
    if len(name) > 80:
        raise ValidationError("Tag names must be at most 80 characters")
    return name


async def _resolve_tags(uow: UnitOfWork, raw_tags: list[str]) -> list[BlogCategory]:
    """Find or create the categories that carry the post's tags (D-4/BR-66)."""
    categories: list[BlogCategory] = []
    seen: set[str] = set()
    for raw_name in raw_tags:
        name = _tag_name(raw_name)
        if name in seen:
            continue
        seen.add(name)

        result = await uow.session.execute(select(BlogCategory).where(BlogCategory.name == name))
        category = result.scalar_one_or_none()
        if category is None:
            base = _slug_part(name, fallback="tag")[:80]
            slug = f"{base}-{uuid.uuid4().hex[:12]}"
            category = BlogCategory(name=name, slug=slug)
            await uow.blog_categories.add(category)
        categories.append(category)
    return categories


def _record_published(uow: UnitOfWork, post: BlogPost) -> None:
    uow.record(
        BlogPostPublished(
            aggregate_id=post.id,
            author_id=post.author_id,
            title=post.title,
            slug=post.slug,
        )
    )


async def _audit(
    uow: UnitOfWork,
    actor: User,
    action: str,
    post: BlogPost,
    metadata: dict[str, str] | None = None,
) -> None:
    await uow.audit.record(
        action=action,
        entity_type="blog_post",
        entity_id=str(post.id),
        actor_user_id=actor.id,
        metadata=metadata,
    )


async def create_post(uow: UnitOfWork, actor: User, payload: BlogPostCreateRequest) -> BlogPost:
    """Create a draft, an immediately published post, or a scheduled post."""
    assert_writer(actor)
    tags = await _resolve_tags(uow, payload.tags)
    moment = _as_utc(payload.published_at) if payload.published_at is not None else None
    is_published = moment is not None and moment <= now_utc()

    post = BlogPost(
        author_id=actor.id,
        title=payload.title,
        slug=_post_slug(payload.title),
        excerpt=payload.excerpt,
        content=payload.body,
        cover_image=payload.cover_image,
        status=PostStatus.PUBLISHED if is_published else PostStatus.DRAFT,
        published_at=moment,
        categories=tags,
    )
    await uow.blog_posts.add(post)
    if is_published:
        _record_published(uow, post)
    await _audit(uow, actor, "blog_post.create", post)
    return post


async def update_post(
    uow: UnitOfWork,
    actor: User,
    post_id: uuid.UUID,
    payload: BlogPostUpdateRequest,
) -> BlogPost:
    """Update a post; changing its date also changes its derived visibility."""
    assert_writer(actor)
    post = await uow.blog_posts.get_by_id(post_id)
    if post is None or post.status is PostStatus.ARCHIVED:
        raise NotFoundError("Post not found")
    assert_can_manage(actor, post)

    fields = payload.model_fields_set
    if "title" in fields:
        if payload.title is None:
            raise ValidationError("The title must not be empty")
        post.title = payload.title
    if "excerpt" in fields:
        post.excerpt = payload.excerpt
    if "body" in fields:
        if payload.body is None:
            raise ValidationError("The body must not be empty")
        post.content = payload.body
    if "cover_image" in fields:
        post.cover_image = payload.cover_image
    if "tags" in fields:
        post.categories = await _resolve_tags(uow, payload.tags or [])

    if "published_at" in fields:
        was_published = post.status is PostStatus.PUBLISHED
        if payload.published_at is None:
            post.published_at = None
            post.status = PostStatus.DRAFT
        else:
            moment = _as_utc(payload.published_at)
            post.published_at = moment
            if moment <= now_utc():
                post.status = PostStatus.PUBLISHED
                if not was_published:
                    _record_published(uow, post)
            else:
                post.status = PostStatus.DRAFT

    await _audit(uow, actor, "blog_post.update", post)
    return post


async def delete_post(uow: UnitOfWork, actor: User, post_id: uuid.UUID) -> BlogPost:
    """Soft-delete a post by archiving it (BR-65)."""
    assert_writer(actor)
    post = await uow.blog_posts.get_by_id(post_id)
    if post is None:
        raise NotFoundError("Post not found")
    assert_can_manage(actor, post)
    post.status = PostStatus.ARCHIVED
    await _audit(uow, actor, "blog_post.archive", post)
    return post


async def publish_post(uow: UnitOfWork, actor: User, post_id: uuid.UUID) -> BlogPost:
    """Publish a post immediately; a scheduled post loses its future date."""
    assert_writer(actor)
    post = await uow.blog_posts.get_by_id(post_id)
    if post is None or post.status is PostStatus.ARCHIVED:
        raise NotFoundError("Post not found")
    assert_can_manage(actor, post)

    was_published = post.status is PostStatus.PUBLISHED
    moment = now_utc()
    post.status = PostStatus.PUBLISHED
    if post.published_at is None or post.published_at > moment:
        post.published_at = moment
    if not was_published:
        _record_published(uow, post)
    await _audit(uow, actor, "blog_post.publish", post)
    return post


async def schedule_post(
    uow: UnitOfWork,
    actor: User,
    post_id: uuid.UUID,
    payload: BlogPostScheduleRequest,
) -> BlogPost:
    """Schedule a post for a strictly future date (BR-63)."""
    assert_writer(actor)
    post = await uow.blog_posts.get_by_id(post_id)
    if post is None or post.status is PostStatus.ARCHIVED:
        raise NotFoundError("Post not found")
    assert_can_manage(actor, post)

    moment = _as_utc(payload.published_at)
    if moment <= now_utc():
        raise InvalidScheduleError()
    post.published_at = moment
    post.status = PostStatus.DRAFT
    await _audit(
        uow,
        actor,
        "blog_post.schedule",
        post,
        metadata={"published_at": moment.isoformat()},
    )
    return post
