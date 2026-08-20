"""Notification persistence tests (per-user + broadcast, unread counts)."""

from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def test_notification_creation(uow: UnitOfWork) -> None:
    user = await make_user(uow, "notified@example.com")
    await uow.commit()

    notification = await uow.notifications.create(
        user_id=user.id,
        type=NotificationType.ATTENDANCE,
        title="Attendance recorded",
        message="You attended Sunday service",
        data={"session": "sunday"},
    )
    await uow.commit()

    listed = await uow.notifications.list_for_user(user.id)
    assert len(listed) == 1
    assert listed[0].id == notification.id
    assert listed[0].type is NotificationType.ATTENDANCE
    assert listed[0].data == {"session": "sunday"}
    assert listed[0].read_at is None


async def test_broadcast_and_per_user_delivery(uow: UnitOfWork) -> None:
    user = await make_user(uow, "bell@example.com")
    await uow.commit()

    await uow.notifications.create(
        user_id=user.id,
        type=NotificationType.SYSTEM,
        title="Private",
        message="Only for you",
    )
    await uow.notifications.create(
        user_id=None,
        type=NotificationType.ANNOUNCEMENT,
        title="Broadcast",
        message="Everyone sees this",
    )
    await uow.commit()

    listed = await uow.notifications.list_for_user(user.id)
    assert {n.title for n in listed} == {"Private", "Broadcast"}

    unread = await uow.notifications.count_unread(user.id)
    assert unread == 2


async def test_mark_read(uow: UnitOfWork) -> None:
    user = await make_user(uow, "read@example.com")
    await uow.commit()

    notification = await uow.notifications.create(
        user_id=user.id,
        type=NotificationType.BLOG_POST,
        title="New post",
        message="A new article was published",
    )
    await uow.commit()

    await uow.notifications.mark_read(notification.id, user.id)
    await uow.commit()

    assert await uow.notifications.count_unread(user.id) == 0
