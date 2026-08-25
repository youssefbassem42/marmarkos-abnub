"""NotificationService behaviour (BR-6, BR-8, BR-9; plan §16).

Runs against the real test database through the Unit of Work; email
delivery is captured by the global ``captured_emails`` fixture so no
socket is ever opened.
"""

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio

from app.core.database import async_session_factory
from app.core.exceptions.errors import ForbiddenError
from app.modules.notifications.application.dto.notification_dto import (
    PushNotificationRequest,
)
from app.modules.notifications.application.services.notification_service import (
    NotificationService,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


@pytest_asyncio.fixture()
async def uow() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as unit_of_work:
        yield unit_of_work


async def _make_user(
    uow: UnitOfWork,
    email: str,
    *,
    role: RoleName = RoleName.MEMBER,
    verified: bool = True,
    status: object = None,
):
    from app.modules.users.domain.enums.user_status import UserStatus
    from app.modules.users.infrastructure.persistence.models import User
    from app.modules.users.infrastructure.services import generate_public_id

    role_row = await uow.roles.get_by_name(role)
    assert role_row is not None
    user = User(
        email=email,
        password_hash="x",
        public_id=generate_public_id(),
        role=role_row,
        status=status or UserStatus.ACTIVE,
        email_verified=verified,
    )
    await uow.users.add(user)
    return user


def _push_request(**overrides: object) -> PushNotificationRequest:
    payload: dict = {
        "title_ar": "إعلان عام",
        "title_en": "General announcement",
        "message_ar": "مرحبًا بكم في الاجتماع الأسبوعي",
        "message_en": "Welcome to the weekly meeting",
    }
    payload.update(overrides)
    return PushNotificationRequest(**payload)


async def _notification_rows(uow: UnitOfWork, user_id: uuid.UUID) -> list:
    from sqlalchemy import or_, select

    from app.modules.notifications.infrastructure.persistence.models import Notification

    rows = await uow.session.execute(
        select(Notification).where(
            or_(Notification.user_id == user_id, Notification.user_id.is_(None))
        )
    )
    return list(rows.scalars().all())


async def test_push_requires_admin(uow: UnitOfWork) -> None:
    servant = await _make_user(uow, "serv@t.com", role=RoleName.SERVANT)
    service = NotificationService(uow)
    with pytest.raises(ForbiddenError):
        await service.push_announcement(actor=servant, request=_push_request())


async def test_push_creates_broadcast_and_audit_row_without_email(
    uow: UnitOfWork, captured_emails: list
) -> None:
    admin = await _make_user(uow, "admin@t.com", role=RoleName.ADMIN)
    service = NotificationService(uow)

    response = await service.push_announcement(actor=admin, request=_push_request())

    rows = [n for n in await _notification_rows(uow, admin.id) if n.id == response.notification_id]
    assert len(rows) == 1
    assert rows[0].user_id is None
    assert rows[0].title_en == "General announcement"

    from sqlalchemy import select

    from app.modules.admin.infrastructure.persistence.models import AuditLog

    audits = (
        (await uow.session.execute(select(AuditLog).where(AuditLog.action == "notification.push")))
        .scalars()
        .all()
    )
    assert len(audits) == 1
    assert str(audits[0].entity_id) == str(response.notification_id)

    assert response.emails_sent == 0
    assert response.recipients == 0
    assert captured_emails == []


async def test_push_with_email_targets_only_active_verified(
    uow: UnitOfWork, captured_emails: list
) -> None:
    admin = await _make_user(uow, "push.admin@t.com", role=RoleName.ADMIN)
    await _make_user(uow, "verified@t.com")
    await _make_user(uow, "unverified@t.com", verified=False)
    from app.modules.users.domain.enums.user_status import UserStatus

    await _make_user(uow, "suspended@t.com", status=UserStatus.SUSPENDED)
    # The admin is also ACTIVE + verified and receives the mail like anyone.
    await uow.commit()

    service = NotificationService(uow)
    response = await service.push_announcement(actor=admin, request=_push_request(send_email=True))

    recipients = {to for to, _ in captured_emails}
    assert "verified@t.com" in recipients
    assert "unverified@t.com" not in recipients
    assert "suspended@t.com" not in recipients
    assert response.emails_sent == 2  # admin + verified member
    assert response.emails_failed == 0
    assert response.recipients == 2


async def test_blog_post_consumer_creates_broadcast_with_cta(
    uow: UnitOfWork, captured_emails: list
) -> None:
    admin = await _make_user(uow, "blog.admin@t.com", role=RoleName.ADMIN)
    await _make_user(uow, "reader@t.com")
    await uow.commit()

    post_id = uuid.uuid4()
    service = NotificationService(uow)
    await service.notify_blog_post_published(
        post_id=post_id, slug="new-hope", title_ar="رجاء جديد", title_en="New Hope"
    )

    rows = [n for n in await _notification_rows(uow, admin.id) if n.type.value == "BLOG_POST"]
    assert len(rows) == 1
    assert rows[0].user_id is None
    assert rows[0].data["slug"] == "new-hope"
    assert rows[0].data["post_id"] == str(post_id)
    assert rows[0].data["cta_url"].endswith("/blog/new-hope")

    assert {content.subject for _, content in captured_emails}
    assert all("New post" in c.subject for _, c in captured_emails)
