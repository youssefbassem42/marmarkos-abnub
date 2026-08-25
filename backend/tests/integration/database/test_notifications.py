"""Notification persistence tests: feed visibility, per-user read state, tabs."""

import uuid

from app.core.pagination import PageParams
from app.modules.notifications.domain.enums.notification_tab import NotificationTab
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user

PARAMS = PageParams(page=1, size=50)


def _copy(suffix: str = "") -> dict[str, str]:
    return {
        "title": f"عنوان {suffix}".strip(),
        "message": f"نص الرسالة {suffix}".strip(),
        "title_en": f"Title {suffix}".strip(),
        "message_en": f"Message {suffix}".strip(),
    }


async def test_notification_creation(uow: UnitOfWork) -> None:
    user = await make_user(uow, "notified@example.com")
    await uow.commit()

    notification = await uow.notifications.create(
        user_id=user.id,
        type=NotificationType.ATTENDANCE,
        **_copy("attendance"),
        data={"session": "sunday"},
    )
    await uow.commit()

    items, read_ids, total = await uow.notifications.list_for_user(
        user.id, params=PARAMS, tab=NotificationTab.ALL
    )
    assert total == 1
    assert [n.id for n in items] == [notification.id]
    assert items[0].type is NotificationType.ATTENDANCE
    assert items[0].title == "عنوان attendance"
    assert items[0].message_en == "Message attendance"
    assert items[0].data == {"session": "sunday"}
    assert read_ids == set()


async def test_broadcast_and_per_user_delivery(uow: UnitOfWork) -> None:
    user = await make_user(uow, "bell@example.com")
    other = await make_user(uow, "other@example.com")
    await uow.commit()

    await uow.notifications.create(
        user_id=user.id,
        type=NotificationType.SYSTEM,
        **_copy("private"),
    )
    await uow.notifications.create(
        user_id=None,
        type=NotificationType.ANNOUNCEMENT,
        **_copy("broadcast"),
    )
    await uow.commit()

    items, _, total = await uow.notifications.list_for_user(
        user.id, params=PARAMS, tab=NotificationTab.ALL
    )
    assert total == 2
    assert {n.title for n in items} == {"عنوان private", "عنوان broadcast"}

    foreign_total = (
        await uow.notifications.list_for_user(other.id, params=PARAMS, tab=NotificationTab.ALL)
    )[2]
    assert foreign_total == 1

    assert await uow.notifications.count_unread(user.id) == 2


async def test_broadcast_marked_read_by_one_stays_unread_for_others(
    uow: UnitOfWork,
) -> None:
    """DEF-1 lock: read state is per user, even for broadcasts."""
    alice = await make_user(uow, "alice@example.com")
    bob = await make_user(uow, "bob@example.com")
    await uow.commit()

    broadcast = await uow.notifications.create(
        user_id=None,
        type=NotificationType.ANNOUNCEMENT,
        **_copy("shared"),
    )
    await uow.commit()

    assert await uow.notification_reads.mark_read(broadcast.id, alice.id) == 1
    await uow.commit()

    assert await uow.notifications.count_unread(alice.id) == 0
    assert await uow.notifications.count_unread(bob.id) == 1


async def test_mark_read_is_idempotent(uow: UnitOfWork) -> None:
    """BR-3: the second mark is a no-op that reports zero rows created."""
    user = await make_user(uow, "read@example.com")
    await uow.commit()

    notification = await uow.notifications.create(
        user_id=user.id,
        type=NotificationType.BLOG_POST,
        **_copy("post"),
    )
    await uow.commit()

    assert await uow.notification_reads.mark_read(notification.id, user.id) == 1
    assert await uow.notification_reads.mark_read(notification.id, user.id) == 0
    await uow.commit()

    assert await uow.notifications.count_unread(user.id) == 0


async def test_mark_all_read_covers_per_user_and_broadcast(uow: UnitOfWork) -> None:
    user = await make_user(uow, "sweep@example.com")
    await uow.commit()

    await uow.notifications.create(
        user_id=user.id, type=NotificationType.ATTENDANCE, **_copy("mine")
    )
    await uow.notifications.create(user_id=None, type=NotificationType.BLOG_POST, **_copy("blog"))
    await uow.notifications.create(
        user_id=None, type=NotificationType.ANNOUNCEMENT, **_copy("news")
    )
    await uow.commit()

    marked = await uow.notification_reads.mark_all_read(user.id)
    await uow.commit()
    assert marked == 3
    assert await uow.notifications.count_unread(user.id) == 0

    # BR-3/BR-4: a second sweep has nothing left to insert.
    assert await uow.notification_reads.mark_all_read(user.id) == 0


async def test_tab_counts_match_hand_built_fixture(uow: UnitOfWork) -> None:
    user = await make_user(uow, "tabs@example.com")
    await uow.commit()

    await uow.notifications.create(user_id=user.id, type=NotificationType.ATTENDANCE, **_copy("a1"))
    await uow.notifications.create(user_id=None, type=NotificationType.ATTENDANCE, **_copy("a2"))
    await uow.notifications.create(user_id=None, type=NotificationType.ANNOUNCEMENT, **_copy("an"))
    await uow.notifications.create(user_id=None, type=NotificationType.BLOG_POST, **_copy("bp"))
    await uow.notifications.create(user_id=None, type=NotificationType.SYSTEM, **_copy("sys"))
    await uow.commit()

    counts = await uow.notifications.tab_counts(user.id)
    assert counts == {
        NotificationTab.ALL: 5,
        NotificationTab.UNREAD: 5,
        NotificationTab.ANNOUNCEMENTS: 2,
        NotificationTab.REMINDERS: 2,
        NotificationTab.SYSTEM: 1,
    }

    reminder = await uow.notification_reads.read_ids_for(user.id, [])
    assert reminder == set()


async def test_unread_tab_and_since_filter(uow: UnitOfWork) -> None:
    from datetime import UTC, datetime, timedelta

    from app.core.time.clock import now_utc

    user = await make_user(uow, "filters@example.com")
    await uow.commit()

    old = await uow.notifications.create(
        user_id=None, type=NotificationType.ANNOUNCEMENT, **_copy("old")
    )
    fresh = await uow.notifications.create(
        user_id=None, type=NotificationType.SYSTEM, **_copy("new")
    )
    await uow.commit()

    cutoff = now_utc() - timedelta(seconds=60)
    items, read_ids, total = await uow.notifications.list_for_user(
        user.id, params=PARAMS, tab=NotificationTab.ALL, since=cutoff
    )
    assert total == 2
    assert {n.id for n in items} == {old.id, fresh.id}
    assert read_ids == set()
    assert isinstance(old.id, uuid.UUID)
    assert datetime.now(UTC) > old.created_at

    assert await uow.notification_reads.mark_read(fresh.id, user.id) == 1
    await uow.commit()
    unread_items, unread_ids, unread_total = await uow.notifications.list_for_user(
        user.id, params=PARAMS, tab=NotificationTab.UNREAD
    )
    assert unread_total == 1
    assert [n.id for n in unread_items] == [old.id]
    assert unread_ids == set()
