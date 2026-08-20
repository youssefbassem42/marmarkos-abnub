"""User, role, QR and ban persistence tests."""

import uuid

import pytest
from sqlalchemy import insert as sa_insert
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import async_session_factory
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import (
    Role,
    User,
    UserBanRecord,
    UserQrCode,
)
from app.modules.users.infrastructure.services import (
    generate_qr_payload,
    hash_qr_payload,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def test_user_creation(uow: UnitOfWork, db_session) -> None:
    await make_user(uow, "alice@example.com")
    await uow.commit()

    stored = await uow.users.get_by_email("alice@example.com")
    assert stored is not None
    assert stored.status is UserStatus.ACTIVE
    assert stored.role.name is RoleName.MEMBER
    assert stored.created_at is not None


async def test_unique_email_constraint(db_engine) -> None:
    async with db_engine.begin() as conn:
        role_id = (
            await conn.execute(select(Role.id).where(Role.name == RoleName.MEMBER))
        ).scalar_one()
        await conn.execute(
            sa_insert(User).values(
                id=uuid.uuid4(),
                email="same@example.com",
                password_hash="h",
                public_id="USR_AAAA",
                role_id=role_id,
            )
        )
    with pytest.raises(IntegrityError):
        async with db_engine.begin() as conn:
            await conn.execute(
                sa_insert(User).values(
                    id=uuid.uuid4(),
                    email="same@example.com",
                    password_hash="h",
                    public_id="USR_BBBB",
                    role_id=role_id,
                )
            )


async def test_qr_association_and_rotation(uow: UnitOfWork, db_session) -> None:
    user = await make_user(uow, "qr@example.com")

    payload1 = generate_qr_payload()
    await uow.qr_codes.create_for_user(user.id, hash_qr_payload(payload1))
    await uow.commit()

    payload2 = generate_qr_payload()
    await uow.qr_codes.create_for_user(user.id, hash_qr_payload(payload2))
    await uow.commit()

    # Rotating deactivates the previous token; the new one resolves.
    old = await uow.qr_codes.get_active_by_token_hash(hash_qr_payload(payload1))
    assert old is None
    new = await uow.qr_codes.get_active_by_token_hash(hash_qr_payload(payload2))
    assert new is not None
    assert new.user_id == user.id

    rows = list((await db_session.execute(select(UserQrCode))).scalars().all())
    assert len(rows) == 2
    assert sum(1 for row in rows if row.is_active) == 1


async def test_qr_token_is_stored_hashed_only(uow: UnitOfWork, db_session) -> None:
    user = await make_user(uow, "qrpriv@example.com")
    payload = generate_qr_payload()
    await uow.qr_codes.create_for_user(user.id, hash_qr_payload(payload))
    await uow.commit()

    stored = (await db_session.execute(select(UserQrCode))).scalar_one()
    assert stored.token_hash == hash_qr_payload(payload)
    assert stored.token_hash != payload
    assert "qrpriv@example.com" not in payload


async def test_user_ban_record_and_status(uow: UnitOfWork) -> None:
    user = await make_user(uow, "ban@example.com")
    admin = await make_user(uow, "admin@example.com")
    await uow.commit()

    async with UnitOfWork.create(async_session_factory) as second:
        record = UserBanRecord(user_id=user.id, banned_by=admin.id, reason="Spam")
        second.session.add(record)
        user_to_ban = await second.users.get_by_id(user.id)
        assert user_to_ban is not None
        user_to_ban.status = UserStatus.BANNED
        await second.commit()

    async with UnitOfWork.create(async_session_factory) as third:
        bans = list((await third.session.execute(select(UserBanRecord))).scalars().all())
        assert len(bans) == 1
        assert bans[0].reason == "Spam"
        assert bans[0].banned_by == admin.id
        stored_user = await third.users.get_by_id(user.id)
        assert stored_user is not None
        assert stored_user.status is UserStatus.BANNED
