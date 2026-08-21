from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.modules.auth.infrastructure.services.google_tokens import GoogleIdentity
from tests.utils import GOOGLE_URL, LOGIN_URL, ME_URL, REFRESH_URL, bearer, register_user

PROFILE_FIELDS = {
    "first_name": "Updated",
    "last_name": "Name",
    "phone": "+201112223334",
    "date_of_birth": "1999-05-05",
    "address": "New address, Abnub",
}


async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    auth, _ = await register_and_login(client)
    return bearer(auth["access_token"])


async def register_and_login(client: AsyncClient, email: str = "profile@example.com"):
    from tests.utils import LOGIN_URL

    user = await register_user(client, email=email)
    response = await client.post(
        LOGIN_URL, json={"email": email, "password": "StrongPass123!"}
    )
    assert response.status_code == 200
    return response.json(), user


@pytest.fixture(autouse=True)
def google_client_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.GOOGLE_CLIENT_ID", "test-client-id")


async def test_get_me_returns_all_profile_fields(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client)

    response = await client.get(ME_URL, headers=bearer(auth["access_token"]))

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "profile@example.com"
    assert body["date_of_birth"] == "2000-01-01"
    assert body["address"]
    assert body["has_password"] is True


async def test_update_me_changes_all_editable_fields(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client)

    response = await client.patch(
        ME_URL, json=PROFILE_FIELDS, headers=bearer(auth["access_token"])
    )

    assert response.status_code == 200
    body = response.json()
    for key, value in PROFILE_FIELDS.items():
        assert body[key] == value


async def test_update_me_rejects_taken_phone(client: AsyncClient) -> None:
    await register_user(client, email="other@example.com", phone="+201119998887")
    auth, _ = await register_and_login(client)

    response = await client.patch(
        ME_URL,
        json={"phone": "+201119998887"},
        headers=bearer(auth["access_token"]),
    )

    assert response.status_code == 409


async def test_update_me_keeps_own_phone(client: AsyncClient) -> None:
    auth, user = await register_and_login(client)

    response = await client.patch(
        ME_URL,
        json={"phone": user["phone"]},
        headers=bearer(auth["access_token"]),
    )

    assert response.status_code == 200


async def test_change_password_requires_current(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client)
    headers = bearer(auth["access_token"])

    response = await client.post(
        f"{ME_URL}/password",
        json={"new_password": "NewStrong123!"},
        headers=headers,
    )
    assert response.status_code == 401

    wrong = await client.post(
        f"{ME_URL}/password",
        json={"current_password": "WrongPass123!", "new_password": "NewStrong123!"},
        headers=headers,
    )
    assert wrong.status_code == 401

    ok = await client.post(
        f"{ME_URL}/password",
        json={"current_password": "StrongPass123!", "new_password": "NewStrong123!"},
        headers=headers,
    )
    assert ok.status_code == 200
    assert ok.json()["has_password"] is True


async def test_change_password_revokes_old_refresh_tokens(client: AsyncClient) -> None:
    await register_user(client, email="profile@example.com")

    first = await client.post(
        LOGIN_URL,
        json={"email": "profile@example.com", "password": "StrongPass123!"},
    )
    assert first.status_code == 200
    set_cookie = first.headers["set-cookie"]
    refresh_cookie = set_cookie.split(";", 1)[0]  # "refresh_token=..."

    second = await client.post(
        LOGIN_URL,
        json={"email": "profile@example.com", "password": "StrongPass123!"},
    )
    assert second.status_code == 200

    response = await client.post(
        f"{ME_URL}/password",
        json={
            "current_password": "StrongPass123!",
            "new_password": "NewStrong123!",
        },
        headers=bearer(second.json()["access_token"]),
    )
    assert response.status_code == 200

    # The first session's refresh token was revoked by the password change.
    refreshed = await client.post(
        REFRESH_URL, headers={"Cookie": refresh_cookie}
    )
    assert refreshed.status_code == 401


async def test_google_provisioned_user_can_set_password_without_current(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.modules.auth.application.services.auth_service.verify_google_id_token",
        AsyncMock(
            return_value=GoogleIdentity(
                sub="sub-1",
                email="google-only@example.com",
                first_name="Goo",
                last_name="Gle",
                picture=None,
            )
        ),
    )
    created = await client.post(GOOGLE_URL, json={"credential": "x" * 40})
    assert created.status_code == 200
    assert created.json()["user"]["has_password"] is False

    headers = bearer(created.json()["access_token"])
    response = await client.post(
        f"{ME_URL}/password",
        json={"new_password": "BrandNew123!"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["has_password"] is True


async def test_avatar_upload_sets_url_when_configured(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client)
    headers = bearer(auth["access_token"])

    with patch(
        "app.modules.users.presentation.router.upload_image",
        new=AsyncMock(return_value="https://res.cloudinary.com/demo/avatar.jpg"),
    ):
        response = await client.post(
            f"{ME_URL}/avatar",
            files={"file": ("me.png", b"fake-image-bytes", "image/png")},
            headers=headers,
        )

    assert response.status_code == 200, response.text
    assert (
        response.json()["avatar"] == "https://res.cloudinary.com/demo/avatar.jpg"
    )


async def test_avatar_upload_rejected_without_cloudinary(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client)
    headers = bearer(auth["access_token"])

    response = await client.post(
        f"{ME_URL}/avatar",
        files={"file": ("me.png", b"fake-image-bytes", "image/png")},
        headers=headers,
    )

    assert response.status_code == 403


async def test_registration_requires_full_data(client: AsyncClient) -> None:
    from tests.utils import REGISTER_URL

    response = await client.post(
        REGISTER_URL,
        json={"email": "incomplete@example.com", "password": "StrongPass123!"},
    )

    assert response.status_code == 422
