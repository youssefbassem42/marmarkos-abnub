"""API behaviour of the notifications router (plan §16: BR-3, BR-6, BR-7)."""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime

import pytest_asyncio
from httpx import AsyncClient

from app.core.database import async_session_factory
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification
from app.modules.users.domain.enums.role_name import RoleName
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.utils import (
    DEFAULT_PASSWORD,
    LOGIN_URL,
    bearer,
    create_user_direct,
    register_and_login,
)

NOTIFICATIONS_URL = "/api/v1/notifications"

_PUSH_PAYLOAD = {
    "title_ar": "إعلان للأعضاء",
    "title_en": "Members announcement",
    "message_ar": "نص الرسالة الإعلامية بالعربية",
    "message_en": "The announcement body in English",
}


@pytest_asyncio.fixture()
async def uow() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as unit_of_work:
        yield unit_of_work


async def _seed_notification(
    uow: UnitOfWork,
    *,
    user_id: uuid.UUID | None,
    type_: NotificationType = NotificationType.ANNOUNCEMENT,
) -> uuid.UUID:
    notification = Notification(
        user_id=user_id,
        type=type_,
        title=f"t-{uuid.uuid4().hex[:6]}",
        message="m",
        title_en="t",
        message_en="m",
        data=None,
        created_at=datetime.now(UTC),
    )
    uow.session.add(notification)
    await uow.session.flush()
    await uow.commit()
    return notification.id


async def _login_as(client: AsyncClient, db_engine, email: str, role: RoleName) -> dict:
    await create_user_direct(db_engine, email=email, role_name=role)
    response = await client.post(LOGIN_URL, json={"email": email, "password": DEFAULT_PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()


async def test_feed_requires_authentication(client: AsyncClient) -> None:
    response = await client.get(NOTIFICATIONS_URL)
    assert response.status_code == 401


async def test_member_reads_own_feed_plus_broadcasts_only(
    client: AsyncClient, uow: UnitOfWork
) -> None:
    auth, user = await register_and_login(client, email="feed@t.com")
    member_id = uuid.UUID(user["id"])
    other_member = await register_and_login(client, email="elsewhere@t.com")

    own_id = await _seed_notification(uow, user_id=member_id)
    broadcast_id = await _seed_notification(uow, user_id=None)
    await _seed_notification(uow, user_id=uuid.UUID(other_member[1]["id"]))

    response = await client.get(NOTIFICATIONS_URL, headers=bearer(auth["access_token"]))
    assert response.status_code == 200
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {str(own_id), str(broadcast_id)}
    assert body["total"] == 2


async def test_push_is_forbidden_for_member_and_servant(client: AsyncClient, db_engine) -> None:
    member_auth, _ = await register_and_login(client, email="plain@t.com")
    servant_auth = await _login_as(client, db_engine, "servant@t.com", RoleName.SERVANT)

    for auth in (member_auth, servant_auth):
        response = await client.post(
            f"{NOTIFICATIONS_URL}/push", json=_PUSH_PAYLOAD, headers=bearer(auth["access_token"])
        )
        assert response.status_code == 403


async def test_admin_can_push_broadcast(client: AsyncClient, db_engine) -> None:
    admin = await _login_as(client, db_engine, "pusher@t.com", RoleName.ADMIN)

    response = await client.post(
        f"{NOTIFICATIONS_URL}/push",
        json=_PUSH_PAYLOAD,
        headers=bearer(admin["access_token"]),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["emails_sent"] == 0  # send_email defaults to false
    assert body["recipients"] == 0

    feed = await client.get(NOTIFICATIONS_URL, headers=bearer(admin["access_token"]))
    types = {item["type"] for item in feed.json()["items"]}
    assert "ANNOUNCEMENT" in types


async def test_reminders_tab_returns_only_attendance(client: AsyncClient, uow: UnitOfWork) -> None:
    auth, user = await register_and_login(client, email="tabs@t.com")
    headers = bearer(auth["access_token"])
    member_id = uuid.UUID(user["id"])
    await _seed_notification(uow, user_id=member_id, type_=NotificationType.ATTENDANCE)
    await _seed_notification(uow, user_id=member_id, type_=NotificationType.SYSTEM)

    response = await client.get(f"{NOTIFICATIONS_URL}?tab=reminders", headers=headers)
    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    assert {item["type"] for item in items} == {"ATTENDANCE"}

    unknown_tab = await client.get(f"{NOTIFICATIONS_URL}?tab=nonsense", headers=headers)
    assert unknown_tab.status_code == 422


async def test_size_above_max_is_rejected(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client, email="size@t.com")
    response = await client.get(
        f"{NOTIFICATIONS_URL}?size=1000", headers=bearer(auth["access_token"])
    )
    assert response.status_code == 422


async def test_mark_read_is_idempotent_and_hides_foreign_rows(
    client: AsyncClient, uow: UnitOfWork
) -> None:
    auth, user = await register_and_login(client, email="read@t.com")
    headers = bearer(auth["access_token"])

    own = await _seed_notification(uow, user_id=uuid.UUID(user["id"]))
    first = await client.post(f"{NOTIFICATIONS_URL}/{own}/read", headers=headers)
    second = await client.post(f"{NOTIFICATIONS_URL}/{own}/read", headers=headers)
    assert first.status_code == 200 and first.json()["marked"] == 1
    assert second.status_code == 200 and second.json()["marked"] == 0

    stranger = await register_and_login(client, email="owner@t.com")
    foreign = await _seed_notification(uow, user_id=uuid.UUID(stranger[1]["id"]))
    stolen = await client.post(f"{NOTIFICATIONS_URL}/{foreign}/read", headers=headers)
    assert stolen.status_code == 404

    missing = await client.post(f"{NOTIFICATIONS_URL}/{uuid.uuid4()}/read", headers=headers)
    assert missing.status_code == 404


async def test_read_all_covers_visible_notifications(client: AsyncClient, uow: UnitOfWork) -> None:
    auth, user = await register_and_login(client, email="sweep@t.com")
    headers = bearer(auth["access_token"])

    await _seed_notification(uow, user_id=uuid.UUID(user["id"]))
    await _seed_notification(uow, user_id=None)

    before = await client.get(f"{NOTIFICATIONS_URL}/summary", headers=headers)
    assert before.status_code == 200
    assert before.json()["unread_count"] == 2

    marked = await client.post(f"{NOTIFICATIONS_URL}/read-all", headers=headers)
    assert marked.status_code == 200
    assert marked.json()["marked"] == 2

    after = await client.get(f"{NOTIFICATIONS_URL}/summary", headers=headers)
    assert after.json()["unread_count"] == 0
