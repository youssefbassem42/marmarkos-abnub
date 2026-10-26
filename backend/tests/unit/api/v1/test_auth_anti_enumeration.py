"""The auth flows must not reveal which addresses exist (SEC-007/SEC-013).

Every endpoint below answers with the *same* status code and the *same*
body whether the address is known or not. The heavy work (the e-mail) runs
as a background job, so the response time cannot be used as an oracle
either.
"""

from httpx import AsyncClient

from app.modules.notifications.infrastructure.email.templates import BrandEmailContent
from tests.utils import DEFAULT_PASSWORD, REGISTER_URL, register_user

FORGOT_URL = "/api/v1/auth/password/forgot"
RESEND_URL = "/api/v1/auth/resend-verification"
VERIFY_URL = "/api/v1/auth/verify-email"

FORGOT_MESSAGE = "If an account exists for this email, a reset link has been sent"
RESEND_MESSAGE = "If the account exists, a verification email has been sent"
REGISTER_MESSAGE = "If this address can be registered, a verification email has been sent"


async def test_password_reset_answers_the_same_for_known_and_unknown(
    client: AsyncClient,
) -> None:
    await register_user(client, email="known@example.com")

    known = await client.post(FORGOT_URL, json={"email": "known@example.com"})
    unknown = await client.post(FORGOT_URL, json={"email": "unknown@example.com"})

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert known.json()["message"] == FORGOT_MESSAGE


async def test_verification_resend_answers_the_same_for_known_and_unknown(
    client: AsyncClient,
) -> None:
    await register_user(client, email="known@example.com")

    known = await client.post(RESEND_URL, json={"email": "known@example.com"})
    unknown = await client.post(RESEND_URL, json={"email": "unknown@example.com"})

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert known.json()["message"] == RESEND_MESSAGE


async def test_registration_answers_the_same_for_known_and_unknown(
    client: AsyncClient,
) -> None:
    await register_user(client, email="known@example.com")

    payload = {
        "email": "known@example.com",
        "password": DEFAULT_PASSWORD,
        "first_name": "Known",
        "last_name": "User",
        "phone": "+201255566677",
        "date_of_birth": "2000-01-01",
        "address": "Abnub, Asyut, Egypt",
    }
    known = await client.post(REGISTER_URL, json=payload)

    unknown_payload = {**payload, "email": "unknown@example.com", "phone": "+201255566678"}
    unknown = await client.post(REGISTER_URL, json=unknown_payload)

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert known.json()["message"] == REGISTER_MESSAGE


async def test_the_verification_link_still_reaches_a_real_account(
    client: AsyncClient, captured_emails: list[tuple[str, BrandEmailContent]]
) -> None:
    """The uniform answer must not have broken the actual flow."""
    await register_user(client, email="member@example.com")

    await client.post(RESEND_URL, json={"email": "member@example.com"})

    assert [address for address, _ in captured_emails] == ["member@example.com"]


async def test_an_invalid_verification_token_gets_the_generic_answer(
    client: AsyncClient,
) -> None:
    response = await client.post(VERIFY_URL, json={"token": "not-a-real-token"})

    assert response.status_code == 401
    assert response.json()["detail"]["message"] == (
        "This verification link is invalid or has expired"
    )
