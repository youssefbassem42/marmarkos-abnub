"""The keyed token hashes and the dual-read window (SEC-005).

* a token issued now is stored as ``v2:<hmac-sha256>`` - the hash is
  keyed with the server-side secret, so a leaked database is not enough
  to verify a guess,
* a token issued *before* the migration (plain SHA-256) is still
  accepted, and the session it belongs to is replaced by a v2 one.
"""

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import settings
from app.core.database import async_session_factory
from app.modules.auth.infrastructure.persistence.models import RefreshToken
from app.modules.auth.infrastructure.security import (
    generate_refresh_token,
    hash_refresh_token,
    hash_refresh_token_legacy,
)
from app.modules.auth.infrastructure.security.refresh_tokens import V2_PREFIX
from tests.utils import DEFAULT_PASSWORD, LOGIN_URL, create_user_direct

REFRESH_URL = "/api/v1/auth/refresh"


async def test_a_new_session_is_stored_with_the_keyed_hash(
    client: AsyncClient, db_engine: AsyncEngine
) -> None:
    user_id = await create_user_direct(db_engine, email="hashed@example.com")

    await client.post(LOGIN_URL, json={"email": "hashed@example.com", "password": DEFAULT_PASSWORD})

    async with async_session_factory() as session:
        stored = (
            (
                await session.execute(
                    select(RefreshToken.token_hash).where(RefreshToken.user_id == user_id)
                )
            )
            .scalars()
            .all()
        )

    assert len(stored) == 1
    assert stored[0].startswith(V2_PREFIX)
    # The stored value is not a plain SHA-256 of the raw token.
    raw = client.cookies.get("refresh_token")
    assert raw is not None
    assert stored[0] != hash_refresh_token_legacy(raw)


async def test_the_legacy_hash_is_still_accepted(
    client: AsyncClient, db_engine: AsyncEngine
) -> None:
    """A session issued before the migration keeps working (dual read)."""
    user_id = await create_user_direct(db_engine, email="legacy@example.com")
    raw = generate_refresh_token()

    async with async_session_factory() as session:
        session.add(
            RefreshToken(
                id=uuid.uuid4(),
                user_id=user_id,
                token_hash=hash_refresh_token_legacy(raw),
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
        await session.commit()

    client.cookies.set("refresh_token", raw)
    refreshed = await client.post(REFRESH_URL)

    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]

    # The legacy session was revoked and replaced by a v2 one.
    async with async_session_factory() as session:
        rows = (
            (await session.execute(select(RefreshToken).where(RefreshToken.user_id == user_id)))
            .scalars()
            .all()
        )
    assert len(rows) == 2
    assert any(row.token_hash.startswith(V2_PREFIX) for row in rows)
    assert any(row.revoked_at is not None for row in rows)


async def test_an_unknown_token_is_still_rejected(client: AsyncClient) -> None:
    client.cookies.set("refresh_token", generate_refresh_token())

    response = await client.post(REFRESH_URL)

    assert response.status_code == 401


def test_the_keyed_hash_depends_on_the_server_secret(monkeypatch) -> None:
    token = "a-token"
    first = hash_refresh_token(token)

    monkeypatch.setattr(settings, "JWT_REFRESH_SECRET", "another-secret")
    second = hash_refresh_token(token)

    assert first != second
    assert first.startswith(V2_PREFIX)
    assert second.startswith(V2_PREFIX)
