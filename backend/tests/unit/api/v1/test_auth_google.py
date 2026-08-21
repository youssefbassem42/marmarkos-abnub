from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.core.exceptions import UnauthorizedError
from app.modules.auth.infrastructure.services.google_tokens import GoogleIdentity
from app.modules.users.domain.enums.user_status import UserStatus
from tests.utils import GOOGLE_URL, LOGIN_URL, REGISTER_URL, create_user_direct

IDENTITY = GoogleIdentity(
    sub="google-sub-123",
    email="googler@example.com",
    first_name="Google",
    last_name="User",
    picture="https://lh3.googleusercontent.com/avatar.jpg",
)


@pytest.fixture(autouse=True)
def google_client_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """Enable Google sign-in for every test in this module."""
    monkeypatch.setattr("app.config.settings.GOOGLE_CLIENT_ID", "test-client-id")


@pytest.fixture
def patch_verify(monkeypatch: pytest.MonkeyPatch):
    """Patch ID-token verification inside the auth service module."""

    def _patch(identity: GoogleIdentity | None = None) -> AsyncMock:
        mock = AsyncMock(return_value=identity or IDENTITY)
        monkeypatch.setattr(
            "app.modules.auth.application.services.auth_service.verify_google_id_token", mock
        )
        return mock

    return _patch


async def _register(client: AsyncClient, email: str) -> None:
    response = await client.post(
        REGISTER_URL,
        json={
            "email": email,
            "password": "StrongPass123!",
            "first_name": "Existing",
            "last_name": "Member",
            "phone": "+20112223334",
            "date_of_birth": "1999-01-01",
            "address": "Abnub, Asyut, Egypt",
        },
    )
    assert response.status_code == 201, response.text


async def test_google_login_provisions_new_member(
    client: AsyncClient, db_engine, patch_verify
) -> None:
    patch_verify()
    response = await client.post(GOOGLE_URL, json={"credential": "x" * 40})

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == "googler@example.com"
    assert body["user"]["first_name"] == "Google"
    assert body["user"]["avatar"] == IDENTITY.picture
    assert "refresh_token=" in response.headers["set-cookie"]


async def test_google_login_links_existing_account(
    client: AsyncClient, db_engine, patch_verify
) -> None:
    await _register(client, "existing@example.com")
    patch_verify(GoogleIdentity(IDENTITY.sub, "existing@example.com", None, None, None))

    response = await client.post(GOOGLE_URL, json={"credential": "x" * 40})

    assert response.status_code == 200
    user = response.json()["user"]
    assert user["email"] == "existing@example.com"
    # The pre-existing profile wins over the Google claims.
    assert user["first_name"] == "Existing"


async def test_google_login_rejects_inactive_account(
    client: AsyncClient, db_engine, patch_verify
) -> None:
    await create_user_direct(
        engine=db_engine,
        email="inactive@example.com",
        status=UserStatus.INACTIVE,
    )
    patch_verify(GoogleIdentity(IDENTITY.sub, "inactive@example.com", None, None, None))

    response = await client.post(GOOGLE_URL, json={"credential": "x" * 40})

    assert response.status_code == 403


async def test_google_login_rejects_invalid_credential(client: AsyncClient, patch_verify) -> None:
    mock = patch_verify()
    mock.side_effect = UnauthorizedError("Invalid or expired Google credential")

    response = await client.post(GOOGLE_URL, json={"credential": "x" * 40})

    assert response.status_code == 401


async def test_google_login_disabled_without_client_id(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.config.settings.GOOGLE_CLIENT_ID", None)

    response = await client.post(GOOGLE_URL, json={"credential": "x" * 40})

    assert response.status_code == 403


async def test_login_still_works_after_google_changes(client: AsyncClient, db_engine) -> None:
    await _register(client, "password-user@example.com")
    response = await client.post(
        LOGIN_URL,
        json={"email": "password-user@example.com", "password": "StrongPass123!"},
    )
    assert response.status_code == 200
