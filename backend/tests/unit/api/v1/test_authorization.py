from httpx import AsyncClient

from app.modules.users.domain.enums.role_name import RoleName
from tests.utils import (
    DEFAULT_PASSWORD,
    LOGIN_URL,
    REGISTER_URL,
    USERS_URL,
    bearer,
    create_user_direct,
    register_and_login,
)


async def test_user_cannot_list_users(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client)

    response = await client.get(USERS_URL, headers=bearer(auth["access_token"]))

    assert response.status_code == 403
    assert response.json()["detail"]["message"] == "Insufficient permissions"


async def test_admin_can_list_users(client: AsyncClient, db_engine) -> None:
    await create_user_direct(engine=db_engine, email="admin@example.com", role_name=RoleName.ADMIN)
    response = await client.post(
        REGISTER_URL,
        json={
            "email": "member@example.com",
            "password": DEFAULT_PASSWORD,
            "first_name": "Member",
            "last_name": "User",
            "phone": "+201277788899",
            "date_of_birth": "2000-01-01",
            "address": "Abnub, Asyut, Egypt",
        },
    )
    assert response.status_code == 201

    response = await client.post(
        LOGIN_URL, json={"email": "admin@example.com", "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]

    listing = await client.get(USERS_URL, headers=bearer(token))

    assert listing.status_code == 200
    emails = {user["email"] for user in listing.json()}
    assert "admin@example.com" in emails
    assert "member@example.com" in emails


async def test_list_users_rejects_unauthenticated_request(client: AsyncClient) -> None:
    response = await client.get(USERS_URL)

    assert response.status_code == 401
