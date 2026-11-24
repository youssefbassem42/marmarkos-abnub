from httpx import AsyncClient

from tests.utils import ME_URL, QR_REGENERATE_URL, QR_URL, bearer, register_and_login


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


async def test_qr_is_unique_per_user(client: AsyncClient, db_engine) -> None:
    from sqlalchemy import select

    from app.modules.users.infrastructure.persistence.models import UserQrCode

    auth1, _ = await register_and_login(client, email="qr1@example.com")
    auth2, _ = await register_and_login(client, email="qr2@example.com")

    qr1 = await client.get(QR_URL, headers=bearer(auth1["access_token"]))
    qr2 = await client.get(QR_URL, headers=bearer(auth2["access_token"]))

    assert qr1.content != qr2.content

    async with db_engine.connect() as conn:
        rows = list((await conn.execute(select(UserQrCode.user_id, UserQrCode.is_active))).all())
    active_per_user: dict = {}
    for user_id, is_active in rows:
        active_per_user[user_id] = active_per_user.get(user_id, 0) + (1 if is_active else 0)
    assert set(active_per_user.values()) == {1}


async def test_qr_does_not_change_from_one_visit_to_the_next(
    client: AsyncClient,
) -> None:
    """BR-83: the member saves the code once and shows it offline.

    The code of a member does not change when the page is opened again,
    when the browser is refreshed or when he signs in again: the answer
    is the same SVG every time.
    """
    auth, _ = await register_and_login(client, email="qr-stable@example.com")
    headers = bearer(auth["access_token"])

    first = await client.get(QR_URL, headers=headers)
    second = await client.get(QR_URL, headers=headers)
    third = await client.get(QR_URL, headers=headers)

    assert first.status_code == 200
    assert first.content == second.content
    assert second.content == third.content


async def test_the_member_changes_his_qr_only_when_he_asks(client: AsyncClient, db_engine) -> None:
    """BR-84: the explicit route replaces the code and retires the old one."""
    from sqlalchemy import select

    from app.modules.users.infrastructure.persistence.models import UserQrCode

    auth, _ = await register_and_login(client, email="qr-change@example.com")
    headers = bearer(auth["access_token"])

    before = await client.get(QR_URL, headers=headers)
    changed = await client.post(QR_REGENERATE_URL, headers=headers)
    after = await client.get(QR_URL, headers=headers)

    assert changed.status_code == 200
    assert b"<svg" in changed.content
    # The new code is the one that is shown from now on.
    assert changed.content == after.content
    assert changed.content != before.content

    # The old code is retired: exactly one active code per member.
    async with db_engine.connect() as conn:
        rows = list(
            (
                await conn.execute(
                    select(UserQrCode.user_id, UserQrCode.is_active, UserQrCode.payload)
                )
            ).all()
        )
    active = [row for row in rows if row[1]]
    assert len(active) == 1
    assert active[0][2] is not None


async def test_the_old_qr_is_refused_by_the_check_in_after_the_change(
    client: AsyncClient, db_engine
) -> None:
    """The copy the member saved stops working the moment he changes it.

    The scan is the act of a **servant** (BR-7): the token of the scan is
    the one of the servant, and the code that is scanned is the copy the
    member saved.
    """
    from sqlalchemy import select

    from app.modules.users.domain.enums.role_name import RoleName
    from app.modules.users.infrastructure.persistence.models import UserQrCode
    from tests.utils import DEFAULT_PASSWORD, create_user_direct, login

    auth, _ = await register_and_login(client, email="qr-old@example.com")
    headers = bearer(auth["access_token"])

    await client.get(QR_URL, headers=headers)
    async with db_engine.connect() as conn:
        old_payload = (
            await conn.execute(select(UserQrCode.payload).where(UserQrCode.is_active.is_(True)))
        ).scalar_one()

    await client.post(QR_REGENERATE_URL, headers=headers)

    # The servant scans the copy the member saved before the change.
    await create_user_direct(
        db_engine, email="qr-scan-servant@example.com", role_name=RoleName.SERVANT
    )
    servant = await login(client, email="qr-scan-servant@example.com", password=DEFAULT_PASSWORD)

    response = await client.post(
        "/api/v1/attendance/check-in",
        json={"qr_code": old_payload},
        headers=bearer(servant["access_token"]),
    )

    assert response.status_code in (400, 422)


async def test_qr_payload_is_not_personal(client: AsyncClient, db_engine) -> None:
    from sqlalchemy import select

    from app.modules.users.infrastructure.persistence.models import UserQrCode

    auth, user = await register_and_login(client, email="qrprivacy@example.com")

    response = await client.get(QR_URL, headers=bearer(auth["access_token"]))

    assert response.status_code == 200
    async with db_engine.connect() as conn:
        hashes = list((await conn.execute(select(UserQrCode.token_hash))).scalars())

    assert all("@" not in h and h != user["public_id"] for h in hashes)
