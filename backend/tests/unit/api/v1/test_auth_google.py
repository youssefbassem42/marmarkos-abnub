from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.modules.auth.infrastructure.services.google_tokens import GoogleIdentity
from app.modules.users.domain.enums.user_status import UserStatus
from tests.utils import GOOGLE_CALLBACK_URL, GOOGLE_LOGIN_URL, LOGIN_URL, create_user_direct

IDENTITY = GoogleIdentity(
    sub="google-sub-123",
    email="googler@example.com",
    first_name="Google",
    last_name="User",
    picture="https://lh3.googleusercontent.com/avatar.jpg",
)


@pytest.fixture(autouse=True)
def google_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr("app.config.settings.GOOGLE_CLIENT_SECRET", "test-secret")
    monkeypatch.setattr("app.config.settings.FRONTEND_URL", "https://app.example.com")


@pytest.fixture
def patch_exchange(monkeypatch: pytest.MonkeyPatch):
    """Patch the code exchange where the router imported it."""

    def _patch(identity: GoogleIdentity | None = None) -> AsyncMock:
        mock = AsyncMock(return_value=identity or IDENTITY)
        monkeypatch.setattr("app.modules.auth.presentation.router.exchange_google_code", mock)
        return mock

    return _patch


async def _start_flow(client: AsyncClient) -> str:
    """Hit /google/login and return the issued state cookie value."""
    response = await client.get(GOOGLE_LOGIN_URL, follow_redirects=False)
    assert response.status_code == 303, response.text
    cookie_header = response.headers["set-cookie"]
    assert "google_oauth_state=" in cookie_header
    state_cookie = cookie_header.split(";")[0]
    assert state_cookie.startswith("google_oauth_state=")
    return state_cookie.split("=", 1)[1]


async def test_login_start_redirects_to_google(client: AsyncClient) -> None:
    response = await client.get(GOOGLE_LOGIN_URL, follow_redirects=False)

    assert response.status_code == 303
    location = response.headers["location"]
    assert location.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "client_id=test-client-id" in location
    assert "response_type=code" in location
    assert "scope=openid+email+profile" in location or "scope=openid%20email%20profile" in location
    assert "state=" in location


async def test_callback_provisions_new_member_and_redirects(
    client: AsyncClient, db_engine, patch_exchange
) -> None:
    patch_exchange()
    state = await _start_flow(client)
    callback = f"{GOOGLE_CALLBACK_URL}?code=abc123&state={state}"

    response = await client.get(callback, follow_redirects=False)

    assert response.status_code == 303
    location = response.headers["location"]
    assert location.startswith("https://app.example.com/google/callback#")
    assert "access_token=" in location

    # The access token from the fragment works and belongs to a new member.
    token = location.split("access_token=")[1].split("&")[0]
    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "googler@example.com"
    assert body["first_name"] == "Google"
    assert body["avatar"] == IDENTITY.picture
    assert body["has_password"] is False


async def test_callback_links_existing_account(client: AsyncClient, patch_exchange) -> None:
    user = await register_user_via_api(client)
    patch_exchange(GoogleIdentity(IDENTITY.sub, user["email"], None, None, None))

    state = await _start_flow(client)
    response = await client.get(
        f"{GOOGLE_CALLBACK_URL}?code=abc123&state={state}", follow_redirects=False
    )

    assert response.status_code == 303
    token = response.headers["location"].split("access_token=")[1].split("&")[0]
    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == user["email"]
    # The pre-existing profile wins over the Google claims.
    assert me.json()["first_name"] == "Existing"


async def test_callback_rejects_forged_state(client: AsyncClient, patch_exchange) -> None:
    mock = patch_exchange()
    mock.assert_not_called()

    response = await client.get(
        f"{GOOGLE_CALLBACK_URL}?code=abc123&state=forged", follow_redirects=False
    )

    assert response.status_code == 303
    assert response.headers["location"].endswith("#error=invalid_state")


async def test_callback_rejects_inactive_account(
    client: AsyncClient, db_engine, patch_exchange
) -> None:
    await create_user_direct(
        engine=db_engine,
        email="inactive@example.com",
        status=UserStatus.INACTIVE,
    )
    patch_exchange(GoogleIdentity(IDENTITY.sub, "inactive@example.com", None, None, None))

    state = await _start_flow(client)
    response = await client.get(
        f"{GOOGLE_CALLBACK_URL}?code=abc123&state={state}", follow_redirects=False
    )

    assert response.status_code == 303
    assert response.headers["location"].endswith("#error=sign_in_failed")


async def test_callback_surfaces_google_errors(client: AsyncClient) -> None:
    response = await client.get(
        f"{GOOGLE_CALLBACK_URL}?error=access_denied", follow_redirects=False
    )

    assert response.status_code == 303
    assert response.headers["location"].endswith("#error=access_denied")


async def test_google_disabled_redirects_with_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.config.settings.GOOGLE_CLIENT_ID", None)
    monkeypatch.setattr("app.config.settings.GOOGLE_CLIENT_SECRET", None)

    response = await client.get(GOOGLE_LOGIN_URL, follow_redirects=False)

    assert response.status_code == 303
    assert response.headers["location"].endswith("#error=not_configured")


async def test_password_login_still_works(client: AsyncClient, db_engine) -> None:
    user = await register_user_via_api(client)
    response = await client.post(
        LOGIN_URL, json={"email": user["email"], "password": "StrongPass123!"}
    )
    assert response.status_code == 200


async def register_user_via_api(client: AsyncClient) -> dict:
    import uuid

    from tests.utils import REGISTER_URL

    email = f"existing-{uuid.uuid4().hex[:8]}@example.com"
    response = await client.post(
        REGISTER_URL,
        json={
            "email": email,
            "password": "StrongPass123!",
            "first_name": "Existing",
            "last_name": "Member",
            "phone": f"+2010{uuid.uuid4().int % 10**8:08d}",
            "date_of_birth": "1999-01-01",
            "address": "Abnub, Asyut, Egypt",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
