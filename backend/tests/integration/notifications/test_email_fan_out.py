"""BR-8: inline email fan-out targets ACTIVE + verified users only."""

import uuid
from collections.abc import AsyncIterator

import pytest_asyncio

from app.core.database import async_session_factory
from app.modules.notifications.application.copy import NotificationCopy
from app.modules.notifications.application.services.notification_service import (
    NotificationService,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.services import generate_public_id
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

_COPY = NotificationCopy(
    title_ar="إعلان",
    title_en="Announcement",
    message_ar="نص",
    message_en="Body",
)


@pytest_asyncio.fixture()
async def uow() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as unit_of_work:
        yield unit_of_work


async def _member(
    uow: UnitOfWork,
    email: str,
    *,
    verified: bool = True,
    status: UserStatus = UserStatus.ACTIVE,
) -> uuid.UUID:
    role = await uow.roles.get_by_name(RoleName.MEMBER)
    assert role is not None
    user = User(
        email=email,
        password_hash="x",
        public_id=generate_public_id(),
        role=role,
        status=status,
        email_verified=verified,
    )
    await uow.users.add(user)
    return user.id


async def test_fan_out_reaches_only_active_verified_users(
    uow: UnitOfWork, captured_emails: list
) -> None:
    await _member(uow, "fan.a@t.com")
    await _member(uow, "fan.b@t.com")
    await _member(uow, "fan.unverified@t.com", verified=False)
    await _member(uow, "fan.banned@t.com", status=UserStatus.BANNED)
    await uow.commit()

    service = NotificationService(uow)
    sent, failed = await service.email_fan_out(copy=_COPY, cta_url=None)

    assert (sent, failed) == (2, 0)
    recipients = {to for to, _ in captured_emails}
    assert recipients == {"fan.a@t.com", "fan.b@t.com"}


async def test_fan_out_counts_failures_without_raising(uow: UnitOfWork, monkeypatch) -> None:
    from app.modules.notifications.infrastructure.email.service import EmailService

    async def _always_fail(self: EmailService, *, to_email: str, content) -> bool:
        return False

    monkeypatch.setattr(EmailService, "send", _always_fail)
    await _member(uow, "fan.fail@t.com")
    await uow.commit()

    service = NotificationService(uow)
    sent, failed = await service.email_fan_out(copy=_COPY, cta_url="/x")

    assert (sent, failed) == (0, 1)
