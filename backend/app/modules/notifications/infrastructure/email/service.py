"""High-level entry point of the mail service component.

``EmailService.send`` takes a case ``BrandEmailContent``, renders it
through the single branded template and hands it to the configured
transport. Delivery problems never break the calling flow — they are
logged so registration/reset can proceed (the UI offers a resend).
"""

import logging
from typing import Any

from app.config import settings
from app.modules.notifications.infrastructure.email.messages import (
    notification_email,
    password_reset_email,
    verification_email,
    welcome_email,
)
from app.modules.notifications.infrastructure.email.sender import (
    EmailSender,
    get_email_sender,
)
from app.modules.notifications.infrastructure.email.templates import (
    BrandEmailContent,
    render_brand_email,
)

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self, sender: EmailSender | None = None) -> None:
        self._sender = sender or get_email_sender()

    async def send(self, *, to_email: str, content: BrandEmailContent) -> bool:
        html = render_brand_email(
            content, logo_url=f"{_frontend_origin()}/images/logo-placeholder.png"
        )
        try:
            await self._sender.send(to_email=to_email, subject=content.subject, html=html)
            return True
        except Exception:  # noqa: BLE001 — email must never take the flow down
            logger.exception("Failed to send email to %s (%r)", to_email, content.subject)
            return False

    # -- convenience wrappers for the common transactional cases ----------

    async def send_verification_email(
        self, *, to_email: str, first_name: str | None, verify_url: str, expire_hours: int
    ) -> bool:
        return await self.send(
            to_email=to_email,
            content=verification_email(
                first_name=first_name,
                verify_url=verify_url,
                expire_hours=expire_hours,
            ),
        )

    async def send_password_reset_email(
        self, *, to_email: str, first_name: str | None, reset_url: str, expire_minutes: int
    ) -> bool:
        return await self.send(
            to_email=to_email,
            content=password_reset_email(
                first_name=first_name,
                reset_url=reset_url,
                expire_minutes=expire_minutes,
            ),
        )

    async def send_notification_email(self, *, to_email: str, **kwargs: Any) -> bool:
        return await self.send(to_email=to_email, content=notification_email(**kwargs))

    async def send_welcome_email(
        self, *, to_email: str, first_name: str | None, sign_in_url: str
    ) -> bool:
        return await self.send(
            to_email=to_email,
            content=welcome_email(first_name=first_name, sign_in_url=sign_in_url),
        )


def _frontend_origin() -> str:
    url = settings.FRONTEND_URL.rstrip("/")
    return url if url.startswith(("http://", "https://")) else f"https://{url}"
