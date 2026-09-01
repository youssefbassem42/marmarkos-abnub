"""Handler for ``bible_verse.published`` (P5-017, US-028).

Delivers the creator-only notification pair: in-app row + branded
email. Delivery state lives on the schedule row so a half-finished
notification is visible, retried (max 5 attempts, BR-11/BR-24) and
never duplicated.
"""

import logging
from dataclasses import fields as dataclass_fields
from datetime import date
from typing import Any

from app.config import settings
from app.core.time.clock import now_utc
from app.modules.bible.domain.enums import NotificationDeliveryStatus
from app.modules.bible.domain.events.bible_verse_published import BibleVersePublished
from app.modules.notifications.application.copy import verse_published_copy
from app.modules.notifications.application.services.notification_service import (
    NotificationService,
)
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.email.service import EmailService
from app.modules.users.domain.enums.user_status import UserStatus
from app.shared.application.outbox_dispatcher import register_handler
from app.shared.infrastructure.persistence.outbox import OutboxEvent
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)

MAX_NOTIFICATION_ATTEMPTS = 5


def _payload_as_event(payload: dict[str, Any]) -> dict[str, Any]:
    """Coerce the stored JSONB payload back into event field types."""
    known = {field.name for field in dataclass_fields(BibleVersePublished)}
    return {key: value for key, value in payload.items() if key in known}


async def handle_bible_verse_published(uow: UnitOfWork, event: OutboxEvent) -> None:
    payload = _payload_as_event(dict(event.payload))
    creator_id = payload.get("creator_id")
    verse_id = payload.get("verse_id")
    verse_reference = str(payload.get("verse_reference", ""))
    title = str(payload.get("title", ""))
    published_at = str(payload.get("published_at", ""))

    schedule = None
    raw_schedule_id = payload.get("schedule_id")
    if raw_schedule_id:
        from uuid import UUID

        schedule = await uow.verse_schedules.get_by_id(UUID(str(raw_schedule_id)))

    # Idempotent replay: already delivered successfully.
    if (
        schedule is not None
        and schedule.notification_status is NotificationDeliveryStatus.SENT
    ):
        return

    creator = None
    if creator_id:
        from uuid import UUID

        creator = await uow.users.get_by_id(UUID(str(creator_id)))

    # Nothing deliverable: do not retry forever — record as done with a skip note.
    if creator is None or creator.status is not UserStatus.ACTIVE or not creator.email_verified:
        logger.info(
            "Skipping verse-published notification for verse %s: creator missing/inactive",
            verse_id,
        )
        if schedule is not None:
            await uow.verse_schedules.set_notification_status(
                schedule, NotificationDeliveryStatus.SENT, notified_at=now_utc()
            )
            schedule.last_error = "notification skipped: creator unavailable"
        return

    ok = await EmailService().send_verse_published_email(
        to_email=creator.email,
        verse_reference=verse_reference,
        title=title,
        published_at=published_at,
        verse_url=f"{settings.FRONTEND_URL.rstrip('/')}/bible-verses/{verse_id}",
    )
    if not ok:
        # Failure path: keep PENDING until the attempt budget runs out.
        if schedule is not None:
            attempts = await uow.verse_schedules.bump_notification_attempts(schedule)
            if attempts >= MAX_NOTIFICATION_ATTEMPTS:
                await uow.verse_schedules.set_notification_status(
                    schedule, NotificationDeliveryStatus.FAILED
                )
                schedule.last_error = "email delivery failed repeatedly"
                logger.error(
                    "Verse publication email permanently failed for verse %s", verse_id
                )
                return
        raise RuntimeError("Verse publication email delivery failed")

    copy = verse_published_copy(
        verse_reference=verse_reference, published_at=_as_date(published_at)
    )
    await NotificationService(uow).create_for_user(
        user_id=creator.id,
        type=NotificationType.BIBLE_VERSE,
        copy=copy,
        data={
            "verse_id": str(verse_id),
            "cta_url": f"/bible-verses/{verse_id}",
            "icon": "BookOpen",
        },
    )
    if schedule is not None:
        await uow.verse_schedules.set_notification_status(
            schedule, NotificationDeliveryStatus.SENT, notified_at=now_utc()
        )


def _as_date(value: str) -> date:
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return now_utc().date()


register_handler("bible_verse.published", handle_bible_verse_published)
