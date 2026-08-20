from datetime import timedelta
from uuid import UUID

from httpx import AsyncClient

from app.modules.auth.infrastructure.security import jwt_service
from tests.utils import (
    LOGOUT_URL,
    ME_URL,
    REFRESH_URL,
    bearer,
    login,
    register_user,
)


async def test_protected_endpoint_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.get(ME_URL)

    assert response.status_code == 401


async def test_protected_endpoint_rejects_invalid_token(client: AsyncClient) -> None:
    response = await client.get(ME_URL, headers=bearer("not-a-real-token"))

    assert response.status_code == 401


async def test_protected_endpoint_rejects_expired_token(client: AsyncClient) -> None:
    user = await register_user(client)
    expired = jwt_service.create_access_token(UUID(user["id"]), expires_delta=timedelta(minutes=-1))

    response = await client.get(ME_URL, headers=bearer(expired))

    assert response.status_code == 401
    assert response.json()["detail"]["message"] == "Invalid or expired token"


async def test_refresh_rotates_refresh_token(client: AsyncClient) -> None:
    await register_user(client)
    await login(client)
    old_token = client.cookies.get("refresh_token")
    assert old_token

    response = await client.post(REFRESH_URL)

    assert response.status_code == 200
    assert response.json()["access_token"]
    new_token = client.cookies.get("refresh_token")
    assert new_token and new_token != old_token

    reuse = await client.post(REFRESH_URL, cookies={"refresh_token": old_token})
    assert reuse.status_code == 401


async def test_refresh_rejects_missing_cookie(client: AsyncClient) -> None:
    response = await client.post(REFRESH_URL)

    assert response.status_code == 401


async def test_logout_revokes_refresh_token(client: AsyncClient) -> None:
    await register_user(client)
    await login(client)
    token = client.cookies.get("refresh_token")
    assert token

    response = await client.post(LOGOUT_URL)

    assert response.status_code == 200
    assert client.cookies.get("refresh_token") is None

    reuse = await client.post(REFRESH_URL, cookies={"refresh_token": token})
    assert reuse.status_code == 401


async def test_logout_does_not_require_access_token(client: AsyncClient) -> None:
    await register_user(client)
    await login(client)

    response = await client.post(LOGOUT_URL)

    assert response.status_code == 200
