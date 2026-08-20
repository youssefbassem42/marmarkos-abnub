from httpx import AsyncClient

from app.modules.users.domain.enums.user_status import UserStatus
from tests.utils import DEFAULT_PASSWORD, LOGIN_URL, create_user_direct, register_user


async def test_login_success_returns_tokens_and_cookie(client: AsyncClient, db_engine) -> None:
    await register_user(client, email="login@example.com")

    response = await client.post(
        LOGIN_URL, json={"email": "login@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 1800
    assert body["user"]["email"] == "login@example.com"

    set_cookie = response.headers["set-cookie"]
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/api/v1/auth" in set_cookie
    assert "SameSite=lax" in set_cookie


async def test_login_rejects_invalid_password(client: AsyncClient) -> None:
    await register_user(client, email="wrongpass@example.com")

    response = await client.post(
        LOGIN_URL, json={"email": "wrongpass@example.com", "password": "WrongPass123!"}
    )

    assert response.status_code == 401
    assert response.json()["detail"]["message"] == "Invalid credentials"


async def test_login_rejects_nonexistent_user_with_same_error(client: AsyncClient) -> None:
    response = await client.post(
        LOGIN_URL, json={"email": "nobody@example.com", "password": "WrongPass123!"}
    )

    assert response.status_code == 401
    assert response.json()["detail"]["message"] == "Invalid credentials"


async def test_login_rejects_inactive_account(client: AsyncClient, db_engine) -> None:
    await create_user_direct(
        engine=db_engine,
        email="inactive@example.com",
        status=UserStatus.INACTIVE,
    )

    response = await client.post(
        LOGIN_URL, json={"email": "inactive@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 403
    assert response.json()["detail"]["message"] == "Account is not active"
