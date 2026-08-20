"""Outbox pattern tests: transactional persistence of domain events."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.database import async_session_factory
from app.modules.attendance.domain.events import AttendanceRecorded
from app.modules.blog.domain.events import BlogPostPublished
from app.modules.comments.domain.events import CommentCreated
from app.modules.users.domain.events import UserRegistered
from app.shared.infrastructure.persistence.outbox import OutboxEvent
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def test_domain_event_persisted_on_commit(uow: UnitOfWork) -> None:
    user = await make_user(uow, "event@example.com")
    await uow.commit()

    await uow.users.set_last_login(user, datetime.now(UTC))
    uow.record(
        UserRegistered(aggregate_id=user.id, email=user.email, first_name="Event", last_name="User")
    )
    await uow.commit()

    events = await uow.outbox.list_pending()
    assert len(events) == 1
    event = events[0]
    assert event.event_type == "user.registered"
    assert event.aggregate_type == "user"
    assert event.aggregate_id == user.id
    assert event.payload["email"] == "event@example.com"
    assert event.status.value == "PENDING"
    assert event.attempts == 0


async def test_outbox_event_is_atomic_with_aggregate_change(uow: UnitOfWork) -> None:
    """If the transaction rolls back, the outbox row rolls back too."""
    user = await make_user(uow, "atomic@example.com")
    await uow.commit()

    async with UnitOfWork.create(async_session_factory) as second:
        await second.users.set_last_login(user, datetime.now(UTC))
        second.record(UserRegistered(aggregate_id=user.id, email=user.email))
        await second.rollback()

    async with UnitOfWork.create(async_session_factory) as third:
        events = await third.outbox.list_pending()
        assert events == []
        stored = await third.users.get_by_id(user.id)
        assert stored is not None
        assert stored.last_login_at is None


async def test_claim_and_process_flow(uow: UnitOfWork) -> None:
    user = await make_user(uow, "worker@example.com")
    await uow.commit()

    await uow.users.set_last_login(user, datetime.now(UTC))
    uow.record(UserRegistered(aggregate_id=user.id, email=user.email))
    await uow.commit()

    claimed = await uow.outbox.claim_pending(limit=10)
    assert len(claimed) == 1
    await uow.outbox.mark_processed(claimed[0])
    await uow.commit()

    pending = await uow.outbox.list_pending()
    assert pending == []


async def test_failed_event_records_error_and_backoff(uow: UnitOfWork) -> None:
    user = await make_user(uow, "fail@example.com")
    await uow.commit()

    uow.record(UserRegistered(aggregate_id=user.id, email=user.email))
    await uow.commit()

    claimed = await uow.outbox.claim_pending()
    await uow.outbox.mark_failed(claimed[0], "dispatch boom", retry_after_seconds=60)
    await uow.commit()

    async with UnitOfWork.create(async_session_factory) as second:
        failed = (
            await second.session.execute(
                select(OutboxEvent).where(OutboxEvent.event_type == "user.registered")
            )
        ).scalar_one()
        assert failed.status.value == "FAILED"
        assert failed.attempts == 1
        assert failed.last_error == "dispatch boom"
        assert failed.available_at > datetime.now(UTC)


async def test_all_workflow_events_serialize(uow: UnitOfWork) -> None:
    """Every registered event type round-trips through the outbox JSONB."""
    user = await make_user(uow, "serialize@example.com")
    await uow.commit()

    events = [
        UserRegistered(aggregate_id=user.id, email=user.email),
        BlogPostPublished(
            aggregate_id=uuid.uuid4(),
            author_id=user.id,
            title="T",
            slug="t",
        ),
        CommentCreated(
            aggregate_id=uuid.uuid4(),
            post_id=uuid.uuid4(),
            author_id=user.id,
            parent_comment_id=None,
        ),
        AttendanceRecorded(
            aggregate_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            attendance_date=datetime.now(UTC).date(),
            method="QR_SCAN",
            scanned_by=user.id,
        ),
    ]
    for event in events:
        uow.record(event)
    await uow.commit()

    rows = list((await uow.session.execute(select(OutboxEvent))).scalars().all())
    assert {row.event_type for row in rows} == {
        "user.registered",
        "blog.post_published",
        "comment.created",
        "attendance.recorded",
    }
    for row in rows:
        assert isinstance(row.payload, dict)
        assert "aggregate_id" in row.payload


async def test_duplicate_event_replay_is_idempotent(uow: UnitOfWork) -> None:
    """mark_processed can be called multiple times without side effects."""
    user = await make_user(uow, "replay@example.com")
    await uow.commit()

    uow.record(UserRegistered(aggregate_id=user.id, email=user.email))
    await uow.commit()

    claimed = await uow.outbox.claim_pending()
    await uow.outbox.mark_processed(claimed[0])
    await uow.outbox.mark_processed(claimed[0])
    await uow.commit()

    async with UnitOfWork.create(async_session_factory) as second:
        row = (
            await second.session.execute(
                select(OutboxEvent).where(OutboxEvent.event_type == "user.registered")
            )
        ).scalar_one()
        assert row.status.value == "PROCESSED"
        assert row.processed_at is not None
