"""Outbox consumer for ``comment.created`` (Phase 7.6).

A new comment notifies the owner of its post.  A reply also notifies the
owner of the parent comment.  The author never notifies themself, and one
person who owns both the post and the parent receives one notification
(BR-82).
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.modules.blog.infrastructure.persistence.models import BlogPost
from app.modules.comments.infrastructure.persistence.models import Comment
from app.modules.notifications.application.copy import NotificationCopy
from app.modules.notifications.application.services.notification_service import (
    NotificationService,
)
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from app.shared.application.outbox_dispatcher import register_handler
from app.shared.infrastructure.persistence.outbox import OutboxEvent
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


def _comment_copy(*, commenter_name: str, is_reply: bool) -> NotificationCopy:
    if is_reply:
        return NotificationCopy(
            title_ar="رد جديد على تعليقك",
            title_en="New reply to your comment",
            message_ar=f"أضاف {commenter_name} ردًا جديدًا على تعليقك.",
            message_en=f"{commenter_name} added a new reply to your comment.",
        )
    return NotificationCopy(
        title_ar="تعليق جديد على منشورك",
        title_en="New comment on your post",
        message_ar=f"أضاف {commenter_name} تعليقًا جديدًا على منشورك.",
        message_en=f"{commenter_name} added a new comment to your post.",
    )


async def handle_comment_created(uow: UnitOfWork, event: OutboxEvent) -> None:
    """Create the personal notifications of one created comment."""
    comment_id = event.aggregate_id
    result = await uow.session.execute(
        select(Comment)
        .options(
            selectinload(Comment.author),
            selectinload(Comment.post).selectinload(BlogPost.author),
            selectinload(Comment.parent).selectinload(Comment.author),
        )
        .where(Comment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        logger.warning("Comment-created event %s has no comment", event.id)
        return

    recipients: dict[uuid.UUID, User] = {}
    post_owner = comment.post.author
    if post_owner.id != comment.user_id and post_owner.status is UserStatus.ACTIVE:
        recipients[post_owner.id] = post_owner

    parent_owner = comment.parent.author if comment.parent is not None else None
    if (
        parent_owner is not None
        and parent_owner.id != comment.user_id
        and parent_owner.status is UserStatus.ACTIVE
    ):
        recipients[parent_owner.id] = parent_owner

    commenter_name = " ".join(
        part for part in (comment.author.first_name, comment.author.last_name) if part
    )
    if not commenter_name:
        commenter_name = "عضو"

    service = NotificationService(uow)
    for user_id, recipient in recipients.items():
        is_reply = (
            parent_owner is not None
            and recipient.id == parent_owner.id
            and recipient.id != post_owner.id
        )
        await service.create_for_user(
            user_id=user_id,
            type=NotificationType.BLOG_COMMENT,
            copy=_comment_copy(commenter_name=commenter_name, is_reply=is_reply),
            data={
                "post_id": str(comment.post_id),
                "cta_url": f"/blog/{comment.post.slug}",
                "icon": "MessageSquare",
            },
        )


register_handler("comment.created", handle_comment_created)
