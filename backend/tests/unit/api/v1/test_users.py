from httpx import AsyncClient

from tests.utils import ME_URL, QR_URL, bearer, register_and_login


async def test_get_me_returns_own_profile(client: AsyncClient) -> None:
    auth, user = await register_and_login(client, email="profile@example.com")

    response = await client.get(ME_URL, headers=bearer(auth["access_token"]))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user["id"]
    assert body["email"] == "profile@example.com"
    assert body["role"] == user["role"]
    assert body["public_id"] == user["public_id"]


async def test_get_me_excludes_sensitive_fields(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client)

    response = await client.get(ME_URL, headers=bearer(auth["access_token"]))

    body = response.json()
    for field in ("password", "password_hash", "refresh_token", "token_hash"):
        assert field not in body


async def test_get_me_rejects_unauthenticated_request(client: AsyncClient) -> None:
    response = await client.get(ME_URL)

    assert response.status_code == 401


async def test_qr_returns_svg(client: AsyncClient) -> None:
    auth, _ = await register_and_login(client)

    response = await client.get(QR_URL, headers=bearer(auth["access_token"]))

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/svg+xml"
    assert b"<svg" in response.content


async def test_qr_rejects_unauthenticated_request(client: AsyncClient) -> None:
    response = await client.get(QR_URL)

    assert response.status_code == 401


async def test_qr_is_unique_per_user_and_rotates(client: AsyncClient, db_engine) -> None:
    from sqlalchemy import select

    from app.modules.users.infrastructure.persistence.models import UserQrCode

    auth1, _ = await register_and_login(client, email="qr1@example.com")
    auth2, _ = await register_and_login(client, email="qr2@example.com")

    qr1 = await client.get(QR_URL, headers=bearer(auth1["access_token"]))
    qr2 = await client.get(QR_URL, headers=bearer(auth2["access_token"]))

    assert qr1.content != qr2.content

    rotated = await client.get(QR_URL, headers=bearer(auth1["access_token"]))
    assert rotated.content != qr1.content

    async with db_engine.connect() as conn:
        rows = list((await conn.execute(select(UserQrCode.user_id, UserQrCode.is_active))).all())
    active_per_user: dict = {}
    for user_id, is_active in rows:
        active_per_user[user_id] = active_per_user.get(user_id, 0) + (1 if is_active else 0)
    assert set(active_per_user.values()) == {1}


async def test_qr_payload_is_not_personal(client: AsyncClient, db_engine) -> None:
    from sqlalchemy import select

    from app.modules.users.infrastructure.persistence.models import UserQrCode

    auth, user = await register_and_login(client, email="qrprivacy@example.com")

    response = await client.get(QR_URL, headers=bearer(auth["access_token"]))

    assert response.status_code == 200
    async with db_engine.connect() as conn:
        hashes = list((await conn.execute(select(UserQrCode.token_hash))).scalars())

    assert all("@" not in h and h != user["public_id"] for h in hashes)
