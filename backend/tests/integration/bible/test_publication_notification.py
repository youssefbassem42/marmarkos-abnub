"""Publication notification integration tests (P5-017 acceptance).

One email + one in-app notification per publication; replaying the
dispatcher sends nothing more; email failures leave PENDING with
attempts = 1 and permanently fail after five attempts.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from httpx import AsyncClient

from app.core.database import async_session_factory
from app.modules.bible.application.handlers.bible_verse_published_handler import (  # noqa: F401
    handle_bible_verse_published,
)
from app.modules.bible.application.services.publication_service import publish_due
from app.modules.bible.domain.enums import NotificationDeliveryStatus
from app.modules.bible.infrastructure.persistence.models import (
    BibleVerse,
    VersePublicationSchedule,
)
from app.modules.notifications.infrastructure.email.service import EmailService
from app.shared.application.outbox_dispatcher import dispatch_pending
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def _scheduled_verse_with_creator(db_engine) -> tuple:
    from tests.utils import create_user_direct

    creator_id = await create_user_direct(
        engine=db_engine, email="creator@example.com"
    )
    async with UnitOfWork.create(async_session_factory) as uow:
        verse = BibleVerse(
            title="Psalm 23",
            verse_reference="Psalm 23:1",
            book="Psalms",
            chapter=23,
            verse_start=1,
            text="The Lord is my shepherd",
            created_by=creator_id,
        )
        await uow.bible_verses.add(verse)
        schedule = VersePublicationSchedule(
            verse_id=verse.id,
            scheduled_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        await uow.verse_schedules.add(schedule)
        verse.status = "SCHEDULED"
        await uow.commit()
        return verse.id, schedule.id


async def test_publication_sends_exactly_one_email_and_one_notification(
    client: AsyncClient, db_engine, captured_emails: list
) -> None:
    """The member must exist for the API-level feed check below."""
    from sqlalchemy import select

    from app.modules.notifications.infrastructure.persistence.models import Notification
    from tests.utils import register_and_login

    await register_and_login(client, email="member-feed@example.com")

    await _scheduled_verse_with_creator(db_engine)
    counters = await publish_due(async_session_factory)
    assert counters["published"] == 1

    # Registration already sent a verification email; isolate ours.
    emails_before = len(captured_emails)

    # The outbox row commits with the publication; drain it.
    result = await dispatch_pending(async_session_factory)
    assert result["processed"] == 1

    assert len(captured_emails) == emails_before + 1
    to_email, content = captured_emails[-1]
    assert to_email == "creator@example.com"
    assert "published" in content.subject.lower()
    assert any("Psalm 23" in paragraph for paragraph in content.sections[1].paragraphs)

    # Re-running the dispatcher sends nothing more (idempotent handler).
    again = await dispatch_pending(async_session_factory)
    assert again["processed"] == 0
    assert len(captured_emails) == emails_before + 1

    async with UnitOfWork.create(async_session_factory) as uow:
        rows = (
            (
                await uow.session.execute(
                    select(Notification).where(Notification.type == "BIBLE_VERSE")
                )
            )
            .scalars()
            .all()
        )
        assert len(rows) == 1
        assert rows[0].data["verse_id"] is not None
        assert rows[0].data["icon"] == "BookOpen"


async def test_email_failure_keeps_pending_and_retries_then_fails_permanently(
    db_engine, captured_emails: list
) -> None:
    _, schedule_id = await _scheduled_verse_with_creator(db_engine)

    async def always_fail(self, *, to_email: str, content) -> bool:  # noqa: ANN001
        del self, to_email, content
        return False

    with patch.object(EmailService, "send", always_fail):
        await publish_due(async_session_factory)
        first = await dispatch_pending(async_session_factory, retry_after_seconds=0)
        assert first["failed"] == 1

        async with UnitOfWork.create(async_session_factory) as uow:
            row = await uow.verse_schedules.get_by_id(schedule_id)
            assert row.notification_status is NotificationDeliveryStatus.PENDING
            assert row.notification_attempts == 1

        # Four more failed rounds exhaust the five-attempt budget.
        for expected in range(2, 6):
            await dispatch_pending(async_session_factory, retry_after_seconds=0)
            async with UnitOfWork.create(async_session_factory) as uow:
                row = await uow.verse_schedules.get_by_id(schedule_id)
                assert row.notification_attempts == expected
                if expected < 5:
                    assert row.notification_status is NotificationDeliveryStatus.PENDING

    async with UnitOfWork.create(async_session_factory) as uow:
        row = await uow.verse_schedules.get_by_id(schedule_id)
        assert row.notification_status is NotificationDeliveryStatus.FAILED
    assert len(captured_emails) == 0
