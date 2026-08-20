"""Refresh-token persistence tests (hashed storage, revocation, metadata)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.database import async_session_factory
from app.modules.auth.infrastructure.persistence.models import RefreshToken
from app.modules.auth.infrastructure.security import hash_refresh_token
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def test_refresh_token_persistence(uow: UnitOfWork, db_session) -> None:
    user = await make_user(uow, "token@example.com")
    await uow.commit()

    raw = "opaque-refresh-token-value"
    async with UnitOfWork.create(async_session_factory) as second:
        await second.refresh_tokens.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_refresh_token(raw),
                expires_at=datetime.now(UTC) + timedelta(days=30),
                user_agent="pytest",
                ip_address="127.0.0.1",
            )
        )
        await second.commit()

    stored = (await db_session.execute(select(RefreshToken))).scalar_one()
    assert stored.token_hash == hash_refresh_token(raw)
    assert stored.token_hash != raw
    assert stored.user_agent == "pytest"
    assert stored.ip_address == "127.0.0.1"
    assert stored.revoked_at is None


async def test_refresh_token_revocation(uow: UnitOfWork) -> None:
    user = await make_user(uow, "revoke@example.com")
    await uow.commit()

    async with UnitOfWork.create(async_session_factory) as second:
        token = RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token("raw-token"),
            expires_at=datetime.now(UTC) + timedelta(days=30),
        )
        await second.refresh_tokens.add(token)
        await second.commit()

    async with UnitOfWork.create(async_session_factory) as third:
        stored = await third.refresh_tokens.get_by_hash(hash_refresh_token("raw-token"))
        assert stored is not None
        await third.refresh_tokens.revoke(stored, datetime.now(UTC))
        await third.commit()

    async with UnitOfWork.create(async_session_factory) as fourth:
        revoked = await fourth.refresh_tokens.get_by_hash(hash_refresh_token("raw-token"))
        assert revoked is not None
        assert revoked.revoked_at is not None


async def test_revoke_all_for_user(uow: UnitOfWork) -> None:
    user = await make_user(uow, "revokeall@example.com")
    await uow.commit()

    async with UnitOfWork.create(async_session_factory) as second:
        for i in range(3):
            await second.refresh_tokens.add(
                RefreshToken(
                    user_id=user.id,
                    token_hash=hash_refresh_token(f"token-{i}"),
                    expires_at=datetime.now(UTC) + timedelta(days=30),
                )
            )
        await second.commit()

    async with UnitOfWork.create(async_session_factory) as third:
        await third.refresh_tokens.revoke_all_for_user(user.id, datetime.now(UTC))
        await third.commit()

    async with UnitOfWork.create(async_session_factory) as fourth:
        rows = list((await fourth.session.execute(select(RefreshToken))).scalars().all())
        assert all(row.revoked_at is not None for row in rows)
