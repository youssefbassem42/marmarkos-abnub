"""Outbox consumer for a published blog post (BR-72/BR-75).

The handler runs from the shared outbox tick, never from the publication
request. It checks the current state of the post before delivering the
bell notifications and the mails, so a draft, a post that is not due, or
an archived post cannot notify the members.
"""

import logging

from app.core.time.clock import now_utc
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.notifications.application.services.notification_service import (
    NotificationService,
)
from app.modules.points.application.services.blog_post_points_service import (
    award_blog_post_publication_points,
)
from app.shared.application.outbox_dispatcher import register_handler
from app.shared.infrastructure.persistence.outbox import OutboxEvent
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


async def handle_blog_post_published(uow: UnitOfWork, event: OutboxEvent) -> None:
    """Deliver the notification and mail fan-out for one published post."""
    post = await uow.blog_posts.get_by_id(event.aggregate_id)
    if post is None:
        logger.warning("Skipping the blog notification for missing post %s", event.aggregate_id)
        return

    published_at = post.published_at
    if post.status is not PostStatus.PUBLISHED or published_at is None or published_at > now_utc():
        logger.info(
            "Skipping the blog notification for post %s: it is not published and due",
            post.id,
        )
        return

    await award_blog_post_publication_points(
        uow,
        user_id=post.author_id,
        blog_post_id=post.id,
        awarded_at=now_utc(),
    )

    await NotificationService(uow).notify_blog_post_published(
        post_id=post.id,
        author_id=post.author_id,
        slug=post.slug,
        title_ar=post.title,
        excerpt=post.excerpt,
    )


register_handler("blog.post_published", handle_blog_post_published)
