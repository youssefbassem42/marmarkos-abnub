"""Anonymous message privacy + lifecycle tests.

CRITICAL: the table must have NO column linking a message to a sender.
"""

from sqlalchemy import inspect

from app.modules.anonymous_messages.domain.enums.message_status import (
    MessageStatus,
    TelegramStatus,
)
from app.modules.anonymous_messages.infrastructure.persistence.models import AnonymousMessage
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def test_anonymous_message_persists_without_user_identity(
    uow: UnitOfWork, db_session
) -> None:
    message = AnonymousMessage(message="Please pray for my family")
    await uow.anonymous_messages.add(message)
    await uow.commit()

    stored = await uow.anonymous_messages.get_by_id(message.id)
    assert stored is not None
    assert stored.message == "Please pray for my family"
    assert stored.status is MessageStatus.PENDING
    assert stored.telegram_status is TelegramStatus.PENDING


async def test_table_has_no_identity_columns(db_session) -> None:
    columns = {column.name for column in inspect(AnonymousMessage).columns}
    assert "user_id" not in columns
    assert "email" not in columns
    assert "phone" not in columns
    assert "author_id" not in columns
    assert "sender" not in columns


async def test_message_lifecycle_sent_via_telegram(uow: UnitOfWork) -> None:
    message = AnonymousMessage(message="Anonymous thanks!")
    await uow.anonymous_messages.add(message)
    await uow.commit()

    await uow.anonymous_messages.mark_sent(message, telegram_message_id="12345")
    await uow.commit()

    stored = await uow.anonymous_messages.get_by_id(message.id)
    assert stored is not None
    assert stored.status is MessageStatus.SENT
    assert stored.telegram_status is TelegramStatus.SENT
    assert stored.telegram_message_id == "12345"
    assert stored.sent_at is not None


async def test_message_failure_path(uow: UnitOfWork) -> None:
    message = AnonymousMessage(message="Will fail")
    await uow.anonymous_messages.add(message)
    await uow.commit()

    await uow.anonymous_messages.mark_failed(message, "Telegram API timeout")
    await uow.commit()

    stored = await uow.anonymous_messages.get_by_id(message.id)
    assert stored is not None
    assert stored.status is MessageStatus.FAILED
    assert stored.failure_reason == "Telegram API timeout"


async def test_claim_pending_is_exclusive(uow: UnitOfWork) -> None:
    m1 = AnonymousMessage(message="one")
    m2 = AnonymousMessage(message="two")
    m3 = AnonymousMessage(message="three")
    await uow.anonymous_messages.add(m1)
    await uow.anonymous_messages.add(m2)
    await uow.anonymous_messages.add(m3)
    await uow.commit()

    claimed = await uow.anonymous_messages.claim_pending(limit=2)
    assert {m.id for m in claimed} == {m1.id, m2.id}
    assert m3.id not in {m.id for m in claimed}
