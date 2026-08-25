"""API behaviour of the anonymous-messages router (BR-11/13/15, D-9/D-22)."""

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.database import async_session_factory
from app.modules.anonymous_messages.presentation.router import (
    _PER_IP_HOURLY,
    _PER_USER_DAILY,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.utils import (
    DEFAULT_PASSWORD,
    LOGIN_URL,
    bearer,
    create_user_direct,
    register_and_login,
)

ANONYMOUS_URL = "/api/v1/anonymous-messages"

_VALID = {
    "message": "Please keep our family in your prayers this week.",
}


class FakeTelegram:
    def __init__(self) -> None:
        self.ok = True
        self.sent: list[str] = []

    async def send_message(self, text: str) -> str | None:
        if not self.ok:
            raise RuntimeError("simulated outage")
        self.sent.append(text)
        return "9001"


_FAKE_TELEGRAM = FakeTelegram()


@pytest.fixture(autouse=True)
def telegram_stub(monkeypatch: pytest.MonkeyPatch) -> FakeTelegram:
    """Patch the service seam so no real HTTP can ever happen."""
    _FAKE_TELEGRAM.ok = True
    _FAKE_TELEGRAM.sent.clear()
    monkeypatch.setattr(
        "app.modules.anonymous_messages.application.services.anonymous_message_service"
        ".get_telegram_client",
        lambda: _FAKE_TELEGRAM,
    )
    return _FAKE_TELEGRAM


@pytest.fixture(autouse=True)
def reset_rate_limiters() -> None:
    """Singletons are process-wide; isolate every test's window state."""
    _PER_IP_HOURLY._hits.clear()
    _PER_USER_DAILY._hits.clear()


async def _login_as(client: AsyncClient, db_engine, email: str, role: RoleName) -> dict:
    await create_user_direct(db_engine, email=email, role_name=role)
    response = await client.post(LOGIN_URL, json={"email": email, "password": DEFAULT_PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()


async def test_submit_works_without_a_token(client: AsyncClient) -> None:
    response = await client.post(ANONYMOUS_URL, json=_VALID)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["delivered"] is True
    assert body["status"] == "SENT"
    assert len(_FAKE_TELEGRAM.sent) == 1


async def test_submit_with_token_stores_no_account_linkage(
    client: AsyncClient, db_engine, uow: UnitOfWork
) -> None:
    auth, _ = await register_and_login(client, email="signed.in@t.com")
    headers = bearer(auth["access_token"])

    payload = {**_VALID, "sender_name": "Anonymous Coward", "sender_phone": "+201000000000"}
    response = await client.post(ANONYMOUS_URL, json=payload, headers=headers)
    assert response.status_code == 201

    from sqlalchemy import select

    from app.modules.anonymous_messages.infrastructure.persistence.models import AnonymousMessage

    rows = (await uow.session.execute(select(AnonymousMessage))).scalars().all()
    assert len(rows) == 1
    stored = rows[0]
    # BR-11: nothing derived from the authenticated account may be stored.
    assert stored.sender_name == "Anonymous Coward"  # self-declared only
    assert stored.sender_phone == "+201000000000"
    assert getattr(stored, "user_id", None) is None
    assert getattr(stored, "author_id", None) is None


async def test_ninth_character_message_is_422(client: AsyncClient) -> None:
    response = await client.post(ANONYMOUS_URL, json={"message": "123456789"})
    assert response.status_code == 422


async def test_browser_payload_with_explicit_nulls_is_accepted(
    client: AsyncClient, uow: UnitOfWork
) -> None:
    """Regression: the exact body the form sends when both fields are untouched.

    react-hook-form serialises empty optional inputs as ``null``/``""``
    rather than omitting the keys. That used to reach Pydantic's length
    validator with ``None`` and raise a TypeError — a 500 in production
    while every test here passed, because they all omitted the keys.
    """
    for payload in (
        {**_VALID, "sender_name": None, "sender_phone": None},
        {**_VALID, "sender_name": "", "sender_phone": ""},
    ):
        response = await client.post(ANONYMOUS_URL, json=payload)

        assert response.status_code == 201, response.text
        assert response.json()["status"] == "SENT"

    from sqlalchemy import select

    from app.modules.anonymous_messages.infrastructure.persistence.models import AnonymousMessage

    rows = (await uow.session.execute(select(AnonymousMessage))).scalars().all()
    assert len(rows) == 2
    # A blank input is stored as NULL, never as an empty string.
    assert all(row.sender_name is None and row.sender_phone is None for row in rows)


async def test_sixth_submission_within_the_hour_is_429(client: AsyncClient) -> None:
    for _ in range(5):
        ok = await client.post(ANONYMOUS_URL, json=_VALID)
        assert ok.status_code == 201
    blocked = await client.post(ANONYMOUS_URL, json=_VALID)

    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"
    assert "Retry-After" in blocked.headers
    # Nothing was persisted for the blocked attempt.
    assert len(_FAKE_TELEGRAM.sent) == 5


async def test_member_cannot_list_messages(client: AsyncClient, db_engine) -> None:
    auth = await _login_as(client, db_engine, "lister.member@t.com", RoleName.MEMBER)
    response = await client.get(ANONYMOUS_URL, headers=bearer(auth["access_token"]))
    assert response.status_code == 403


async def test_admin_lists_and_retries_failed_row(client: AsyncClient, db_engine) -> None:
    admin = await _login_as(client, db_engine, "list.admin@t.com", RoleName.ADMIN)
    headers = bearer(admin["access_token"])

    # A delivery that fails but still stores safely (BR-13).
    _FAKE_TELEGRAM.ok = False
    failed = await client.post(ANONYMOUS_URL, json=_VALID)
    assert failed.status_code == 201
    assert failed.json()["delivered"] is False
    assert failed.json()["status"] == "FAILED"
    _FAKE_TELEGRAM.ok = True

    listing = await client.get(f"{ANONYMOUS_URL}?status=FAILED", headers=headers)
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert len(items) == 1
    target = items[0]
    assert target["attempts"] == 1
    assert target["failure_reason"]

    retried = await client.post(f"{ANONYMOUS_URL}/{target['id']}/retry", headers=headers)
    assert retried.status_code == 200, retried.text
    body = retried.json()
    assert body["telegram_status"] == "SENT"
    assert body["attempts"] == 2

    from sqlalchemy import select

    from app.modules.admin.infrastructure.persistence.models import AuditLog

    async with async_session_factory() as session:
        audits = (
            (
                await session.execute(
                    select(AuditLog).where(AuditLog.action == "anonymous_message.retry")
                )
            )
            .scalars()
            .all()
        )
    assert len(audits) == 1


async def test_retry_on_sent_row_is_conflict(client: AsyncClient, db_engine) -> None:
    admin = await _login_as(client, db_engine, "conflict.admin@t.com", RoleName.ADMIN)
    headers = bearer(admin["access_token"])

    ok = await client.post(ANONYMOUS_URL, json=_VALID)
    assert ok.json()["status"] == "SENT"

    response = await client.post(f"{ANONYMOUS_URL}/{ok.json()['id']}/retry", headers=headers)
    assert response.status_code == 409


async def test_retry_unknown_row_is_404(client: AsyncClient, db_engine) -> None:
    admin = await _login_as(client, db_engine, "ghost.admin@t.com", RoleName.ADMIN)
    response = await client.post(
        f"{ANONYMOUS_URL}/{uuid.uuid4()}/retry", headers=bearer(admin["access_token"])
    )
    assert response.status_code == 404


@pytest_asyncio.fixture()
async def uow() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as unit_of_work:
        yield unit_of_work
