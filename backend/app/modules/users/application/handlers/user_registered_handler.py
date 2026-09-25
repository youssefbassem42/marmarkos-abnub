"""Outbox consumer for ``user.registered``.

Delivers the welcome email from the transactional outbox so a transient
mail outage never silently loses it. Delivery is retried a small number
of times and then dropped (logged) — a permanently broken provider must
not pin the event in a FAILED retry loop forever.
"""

import logging

from app.config import settings
from app.modules.notifications.infrastructure.email.service import EmailService
from app.shared.application.outbox_dispatcher import register_handler
from app.shared.infrastructure.persistence.outbox import OutboxEvent
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)

MAX_WELCOME_ATTEMPTS = 5


async def handle_user_registered(uow: UnitOfWork, event: OutboxEvent) -> None:
    payload = event.payload or {}
    email = str(payload.get("email") or "").strip()
    if not email:
        logger.warning("user.registered event %s carries no email; acknowledging", event.id)
        return

    ok = await EmailService().send_welcome_email(
        to_email=email,
        first_name=payload.get("first_name"),
        sign_in_url=f"{settings.FRONTEND_URL.rstrip('/')}/login",
    )
    if ok:
        return
    if event.attempts >= MAX_WELCOME_ATTEMPTS - 1:
        logger.error(
            "Welcome email permanently failed for %s; dropping event %s", email, event.id
        )
        return
    raise RuntimeError("Welcome email delivery failed")


register_handler("user.registered", handle_user_registered)