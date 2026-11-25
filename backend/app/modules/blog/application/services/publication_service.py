"""The publication of the scheduled posts of the blog (BR-64).

A scheduled post is a draft whose publication date has come. The shared
scheduler tick publishes it: the runner is **idempotent** (a post is
claimed while it is a draft, and a second tick finds nothing to claim) and
**safe concurrently** (``FOR UPDATE SKIP LOCKED`` claims, a row lock while
the status changes). A failure of one post is counted, never raised: the
tick answers with its counters and the next tick tries again.
"""

import logging
from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.time.clock import now_utc
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.domain.events.blog_post_published import BlogPostPublished
from app.modules.points.application.services.blog_post_points_service import (
    award_blog_post_publication_points,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


async def publish_due(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    limit: int = 50,
    now: Callable[[], datetime] | None = None,
) -> dict[str, int]:
    """Publish the scheduled posts whose date has come.

    Returns the counters of the tick: ``{"published", "failed", "skipped"}``.
    """
    clock = now or now_utc
    reference = clock()

    claimed_ids: list[UUID] = []
    async with UnitOfWork.create(session_factory) as claimer:
        posts = await claimer.blog_posts.claim_due_for_publication(limit=limit, now=reference)
        claimed_ids = [post.id for post in posts]

    published = failed = skipped = 0
    for post_id in claimed_ids:
        result = await _publish_one(session_factory, post_id, reference)
        if result == "published":
            published += 1
        elif result == "skipped":
            skipped += 1
        else:
            failed += 1
    return {"published": published, "failed": failed, "skipped": skipped}


async def _publish_one(
    session_factory: async_sessionmaker[AsyncSession],
    post_id: UUID,
    reference: datetime,
) -> str:
    async with UnitOfWork.create(session_factory) as uow:
        # The row is locked for the transaction: a concurrent tick waits here
        # and then sees the published status (BR-64).
        post = await uow.blog_posts.get_by_id(post_id, for_update=True)
        if post is None:
            return "skipped"
        if post.status is not PostStatus.DRAFT:
            # Published (or archived) between the claim and the publication.
            return "skipped"
        if post.published_at is None or post.published_at > reference:
            # The date was moved away between the claim and the publication.
            return "skipped"
        try:
            post.status = PostStatus.PUBLISHED
            await award_blog_post_publication_points(
                uow,
                user_id=post.author_id,
                blog_post_id=post.id,
                awarded_at=reference,
            )
            uow.record(
                BlogPostPublished(
                    aggregate_id=post.id,
                    author_id=post.author_id,
                    title=post.title,
                    slug=post.slug,
                )
            )
            await uow.commit()
        except Exception:  # noqa: BLE001 - per-item isolation (BR-64)
            logger.exception("The publication of the scheduled post %s failed", post_id)
            await uow.rollback()
            return "failed"
        return "published"
