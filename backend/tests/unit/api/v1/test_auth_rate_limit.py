"""Rate limits on the unauthenticated auth endpoints (SEC-007).

The contract these tests pin down:

* a **failed** sign-in is counted per IP and per account; a successful
  sign-in is never counted,
* the e-mail endpoints (register / password reset / verification resend)
  count every attempt, because every attempt costs a message,
* the answer is always 429 with a ``Retry-After`` header - never a hard
  lockout, which would be a denial-of-service vector against the members.
"""

import pytest
from httpx import AsyncClient

from app.config import settings
from tests.utils import DEFAULT_PASSWORD, LOGIN_URL, REGISTER_URL, register_user

FORGOT_URL = "/api/v1/auth/password/forgot"
RESEND_URL = "/api/v1/auth/resend-verification"


async def _failed_login(client: AsyncClient, email: str) -> int:
    response = await client.post(LOGIN_URL, json={"email": email, "password": "WrongPass123!"})
    return response.status_code


async def test_failed_logins_are_blocked_after_the_account_limit(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AUTH_LOGIN_FAILURES_PER_ACCOUNT", 3)

    for _ in range(3):
        assert await _failed_login(client, "victim@example.com") == 401

    blocked = await client.post(
        LOGIN_URL, json={"email": "victim@example.com", "password": "WrongPass123!"}
    )

    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"
    assert int(blocked.headers["Retry-After"]) > 0


async def test_successful_logins_do_not_consume_the_budget(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A whole service signing in from one address must not lock anyone out."""
    monkeypatch.setattr(settings, "AUTH_LOGIN_FAILURES_PER_ACCOUNT", 2)
    await register_user(client, email="member@example.com")

    for _ in range(5):
        response = await client.post(
            LOGIN_URL, json={"email": "member@example.com", "password": DEFAULT_PASSWORD}
        )
        assert response.status_code == 200


async def test_a_successful_login_clears_the_failures_of_that_account(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AUTH_LOGIN_FAILURES_PER_ACCOUNT", 2)
    await register_user(client, email="member@example.com")

    assert await _failed_login(client, "member@example.com") == 401
    assert await _failed_login(client, "member@example.com") == 401

    success = await client.post(
        LOGIN_URL, json={"email": "member@example.com", "password": DEFAULT_PASSWORD}
    )
    assert success.status_code == 200

    # The budget was cleared by the success: two more failures are allowed.
    assert await _failed_login(client, "member@example.com") == 401
    assert await _failed_login(client, "member@example.com") == 401


async def test_registration_is_rate_limited_per_ip(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AUTH_REGISTER_PER_IP", 2)

    first = await client.post(
        REGISTER_URL,
        json={
            "first_name": "One",
            "last_name": "Member",
            "email": "one@example.com",
            "password": DEFAULT_PASSWORD,
            "date_of_birth": "1990-01-01",
            "address": "Cairo",
            "phone": "+201000000001",
        },
    )
    assert first.status_code == 201

    second = await client.post(
        REGISTER_URL,
        json={
            "first_name": "Two",
            "last_name": "Member",
            "email": "two@example.com",
            "password": DEFAULT_PASSWORD,
            "date_of_birth": "1990-01-01",
            "address": "Cairo",
            "phone": "+201000000002",
        },
    )
    assert second.status_code == 201

    blocked = await client.post(
        REGISTER_URL,
        json={
            "first_name": "Three",
            "last_name": "Member",
            "email": "three@example.com",
            "password": DEFAULT_PASSWORD,
            "date_of_birth": "1990-01-01",
            "address": "Cairo",
            "phone": "+201000000003",
        },
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"


async def test_password_reset_is_rate_limited_per_ip(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AUTH_PASSWORD_RESET_PER_IP", 2)

    for index in range(2):
        response = await client.post(FORGOT_URL, json={"email": f"member{index}@example.com"})
        assert response.status_code == 200

    blocked = await client.post(FORGOT_URL, json={"email": "member@example.com"})
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"


async def test_verification_resend_is_rate_limited_per_ip(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AUTH_RESEND_VERIFICATION_PER_IP", 2)

    for index in range(2):
        response = await client.post(RESEND_URL, json={"email": f"member{index}@example.com"})
        assert response.status_code == 200

    blocked = await client.post(RESEND_URL, json={"email": "member@example.com"})
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"


async def test_the_limit_is_per_address_not_global(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Two addresses behind the same proxy must not share the budget."""
    monkeypatch.setattr(settings, "AUTH_LOGIN_FAILURES_PER_ACCOUNT", 1)
    monkeypatch.setattr(settings, "AUTH_LOGIN_FAILURES_PER_IP", 10)

    assert await _failed_login(client, "one@example.com") == 401
    blocked_first = await client.post(
        LOGIN_URL, json={"email": "one@example.com", "password": "WrongPass123!"}
    )
    assert blocked_first.status_code == 429

    # A different account from the same address is still allowed.
    assert await _failed_login(client, "two@example.com") == 401
