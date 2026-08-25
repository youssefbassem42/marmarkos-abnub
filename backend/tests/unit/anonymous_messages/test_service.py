"""AnonymousMessageService: BR-13/BR-14 semantics against the real DB."""

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.database import async_session_factory
from app.core.exceptions.errors import ConflictError, NotFoundError
from app.modules.admin.infrastructure.persistence.models import AuditLog
from app.modules.anonymous_messages.application.dto.anonymous_message_dto import (
    AnonymousMessageCreateRequest,
)
from app.modules.anonymous_messages.application.services.anonymous_message_service import (
    AnonymousMessageService,
)
from app.modules.anonymous_messages.infrastructure.telegram import TelegramClientError
from app.modules.users.domain.enums.role_name import RoleName
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


class StubTelegram:
    """Deterministic stand-in at the service's client seam."""

    def __init__(self, *, outcome: str = "ok") -> None:
        self.outcome = outcome
        self.calls: list[str] = []

    async def send_message(self, text: str) -> str | None:
        self.calls.append(text)
        if self.outcome == "timeout":
            raise TelegramClientError("timed out")
        if self.outcome == "reject":
            raise TelegramClientError("chat not found")
        return "777"


def _service(uow: UnitOfWork, telegram: StubTelegram) -> AnonymousMessageService:
    return AnonymousMessageService(uow, telegram=telegram)  # type: ignore[arg-type]


@pytest_asyncio.fixture()
async def uow() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as unit_of_work:
        yield unit_of_work


async def _admin(uow: UnitOfWork, email: str):
    from app.modules.users.infrastructure.persistence.models import User
    from app.modules.users.infrastructure.services import generate_public_id

    role = await uow.roles.get_by_name(RoleName.ADMIN)
    assert role is not None
    user = User(
        email=email,
        password_hash="x",
        public_id=generate_public_id(),
        role=role,
    )
    await uow.users.add(user)
    return user


def _payload(
    message: str = "Please keep our family in your prayers",
) -> AnonymousMessageCreateRequest:
    return AnonymousMessageCreateRequest(message=message)


async def test_successful_submit_persists_then_delivers(uow: UnitOfWork) -> None:
    telegram = StubTelegram()
    service = _service(uow, telegram)

    response = await service.submit(_payload())

    assert response.delivered is True
    assert response.status == "SENT"
    stored = await uow.anonymous_messages.get_by_id(response.id)
    assert stored is not None
    assert stored.telegram_status.value == "SENT"
    assert stored.attempts == 1
    assert len(telegram.calls) == 1
    assert "Please keep our family" in telegram.calls[0]


async def test_delivery_failure_still_returns_stored_message(uow: UnitOfWork) -> None:
    """BR-13: a Telegram outage never loses the row nor fails the call."""
    telegram = StubTelegram(outcome="timeout")
    service = _service(uow, telegram)

    response = await service.submit(_payload())

    assert response.delivered is False
    assert response.status == "FAILED"
    stored = await uow.anonymous_messages.get_by_id(response.id)
    assert stored is not None
    assert stored.failure_reason == "timed out"
    assert stored.message.startswith("Please keep")


async def test_retry_requires_failed_row_and_audits(uow: UnitOfWork) -> None:
    admin = await _admin(uow, "retry.admin@t.com")
    telegram = StubTelegram(outcome="timeout")
    service = _service(uow, telegram)
    submitted = await service.submit(_payload())
    assert submitted.delivered is False

    # Flip the stub: the same admin retries and it now works.
    working = StubTelegram()
    retried_service = _service(uow, working)

    done = await retried_service.retry(message_id=submitted.id, actor=admin)
    assert done.telegram_status == "SENT"
    assert done.attempts == 2
    assert len(working.calls) == 1

    audits = (
        (
            await uow.session.execute(
                select(AuditLog).where(AuditLog.action == "anonymous_message.retry")
            )
        )
        .scalars()
        .all()
    )
    assert len(audits) == 1
    # BR-14: audit metadata must not carry the message body.
    assert (audits[0].details or {}).get("message") is None


async def test_retry_rejects_sent_row(uow: UnitOfWork) -> None:
    admin = await _admin(uow, "sent.retry@t.com")
    service = _service(uow, StubTelegram())
    submitted = await service.submit(_payload())
    assert submitted.delivered is True

    with pytest.raises(ConflictError):
        await service.retry(message_id=submitted.id, actor=admin)


async def test_retry_unknown_row_is_404(uow: UnitOfWork) -> None:
    admin = await _admin(uow, "missing.retry@t.com")
    service = _service(uow, StubTelegram())
    with pytest.raises(NotFoundError):
        await service.retry(message_id=uuid.uuid4(), actor=admin)
