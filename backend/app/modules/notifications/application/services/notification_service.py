"""Notification use cases: broadcast push, email fan-out, event consumers.

Transaction rule (BR-8): the notification row (and the audit row) commit
first; email delivery happens inline only after a successful commit.
Per-message failures are counted, never raised — a broken SMTP must not
undo or fail a notification that was already created.
"""

import asyncio
import logging
import uuid
from datetime import date

from app.config import settings
from app.core.exceptions.errors import ForbiddenError
from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.notifications.application.copy import (
    NotificationCopy,
    attendance_recorded_copy,
    blog_post_published_copy,
)
from app.modules.notifications.application.dto.notification_dto import (
    PushNotificationRequest,
    PushNotificationResponse,
)
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.email.messages import (
    new_post_email,
    notification_email,
)
from app.modules.notifications.infrastructure.email.service import EmailService
from app.modules.notifications.infrastructure.email.templates import BrandEmailContent
from app.modules.notifications.infrastructure.persistence.models import Notification
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)

_ANNOUNCEMENT_CTA_LABEL = "افتح التطبيق — OPEN APP"


class NotificationService:
    def __init__(self, uow: UnitOfWork, email: EmailService | None = None) -> None:
        self._uow = uow
        self._email = email or EmailService()

    async def create_for_user(
        self,
        *,
        user_id: uuid.UUID,
        type: NotificationType,  # noqa: A002 - frozen domain vocabulary
        copy: NotificationCopy,
        data: dict[str, object] | None = None,
    ) -> Notification:
        return await self._uow.notifications.create(
            user_id=user_id,
            type=type,
            title=copy.title_ar,
            message=copy.message_ar,
            title_en=copy.title_en,
            message_en=copy.message_en,
            data=data,
        )

    async def create_broadcast(
        self,
        *,
        type: NotificationType,  # noqa: A002 - frozen domain vocabulary
        copy: NotificationCopy,
        data: dict[str, object] | None = None,
    ) -> Notification:
        return await self._uow.notifications.create(
            user_id=None,
            type=type,
            title=copy.title_ar,
            message=copy.message_ar,
            title_en=copy.title_en,
            message_en=copy.message_en,
            data=data,
        )

    async def push_announcement(
        self, *, actor: User, request: PushNotificationRequest
    ) -> PushNotificationResponse:
        """BR-6/BR-8: admin-only bilingual broadcast, optional email fan-out."""
        # Defence in depth: the router already guards with require_role.
        if actor.role.name is not RoleName.ADMIN:
            raise ForbiddenError("Only administrators can send announcements")

        copy = NotificationCopy(
            title_ar=request.title_ar,
            title_en=request.title_en,
            message_ar=request.message_ar,
            message_en=request.message_en,
        )
        data: dict[str, object] | None = {"cta_url": request.cta_url} if request.cta_url else None
        notification = await self.create_broadcast(
            type=NotificationType.ANNOUNCEMENT, copy=copy, data=data
        )
        await self._uow.audit.record(
            action="notification.push",
            entity_type="notification",
            entity_id=str(notification.id),
            actor_user_id=actor.id,
            metadata={"send_email": request.send_email},
        )
        await self._uow.commit()

        sent = failed = 0
        if request.send_email:
            content = notification_email(
                title_ar=request.title_ar,
                title_en=request.title_en,
                message_ar=request.message_ar,
                message_en=request.message_en,
                cta_label=_ANNOUNCEMENT_CTA_LABEL if request.cta_url else None,
                cta_url=request.cta_url,
            )
            sent, failed = await self._fan_out_content(content)
        return PushNotificationResponse(
            notification_id=notification.id,
            recipients=sent + failed,
            emails_sent=sent,
            emails_failed=failed,
        )

    async def notify_attendance_recorded(
        self, *, user_id: uuid.UUID, meeting_date: date, status: AttendanceStatus
    ) -> None:
        """BR-10: per-user reminder inside the caller's transaction.

        Creates the row in the caller's Unit of Work and never commits;
        callers wrap it so a notification failure can never abort a
        check-in that already succeeded.
        """
        await self.create_for_user(
            user_id=user_id,
            type=NotificationType.ATTENDANCE,
            copy=attendance_recorded_copy(meeting_date=meeting_date, status=status),
        )

    # TODO(phase-blog): wire this consumer into the blog publish command
    # when the blog phase lands (D-13). It ships dormant and tested only.
    async def notify_blog_post_published(
        self, *, post_id: uuid.UUID, slug: str, title_ar: str, title_en: str
    ) -> None:
        """BR-9/D-13: broadcast + email fan-out for a published post."""
        copy = blog_post_published_copy(title_ar=title_ar, title_en=title_en)
        cta_url = f"{settings.FRONTEND_URL}/blog/{slug}"
        notification = await self.create_broadcast(
            type=NotificationType.BLOG_POST,
            copy=copy,
            data={"post_id": str(post_id), "slug": slug, "cta_url": cta_url},
        )
        await self._uow.audit.record(
            action="notification.blog_post",
            entity_type="notification",
            entity_id=str(notification.id),
            metadata={"post_id": str(post_id), "slug": slug},
        )
        await self._uow.commit()

        content = new_post_email(
            title_ar=copy.title_ar,
            title_en=copy.title_en,
            message_ar=copy.message_ar,
            message_en=copy.message_en,
            cta_url=cta_url,
        )
        sent, failed = await self._fan_out_content(content)
        logger.info(
            "Blog post notification %s emailed: sent=%d failed=%d",
            notification.id,
            sent,
            failed,
        )

    async def email_fan_out(
        self, *, copy: NotificationCopy, cta_url: str | None
    ) -> tuple[int, int]:
        """Inline bilingual fan-out to ACTIVE users with verified emails.

        Returns ``(sent, failed)``. Never raises for individual failures:
        ``EmailService`` already swallows them and reports False.
        """
        content = notification_email(
            title_ar=copy.title_ar,
            title_en=copy.title_en,
            message_ar=copy.message_ar,
            message_en=copy.message_en,
            cta_label=_ANNOUNCEMENT_CTA_LABEL if cta_url else None,
            cta_url=cta_url,
        )
        return await self._fan_out_content(content)

    async def _fan_out_content(self, content: BrandEmailContent) -> tuple[int, int]:
        users = await self._uow.users.list_all()
        targets = [
            user
            for user in users
            if user.status is UserStatus.ACTIVE and user.email_verified and bool(user.email)
        ]
        semaphore = asyncio.Semaphore(settings.NOTIFICATION_EMAIL_CONCURRENCY)

        async def _send(user: User) -> bool:
            async with semaphore:
                return await self._email.send(to_email=user.email, content=content)

        results = await asyncio.gather(*(_send(user) for user in targets))
        sent = sum(1 for ok in results if ok)
        return sent, len(results) - sent
