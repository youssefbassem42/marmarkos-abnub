"""The members can be deleted, even with a session (the E2E found it).

The refresh tokens of a member are deleted by the database
(``ondelete="CASCADE"``). SQLAlchemy, however, nullifies the foreign key
of the children before it deletes the parent - and ``user_id`` of a
refresh token is **not nullable**: the delete raised an IntegrityError
and the caller saw a 500.

The relationships that the database cascades must say so
(``passive_deletes=True``), otherwise the ORM fights the schema.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.modules.auth.infrastructure.persistence.models import RefreshToken
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

from .conftest import make_user


@pytest.mark.asyncio
async def test_a_member_with_a_session_can_be_deleted(uow: UnitOfWork) -> None:
    user = await make_user(uow, "delete-with-session@example.com")
    await uow.commit()

    token = RefreshToken(
        user_id=user.id,
        token_hash="v2:" + uuid.uuid4().hex,
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    uow.session.add(token)
    await uow.session.flush()

    await uow.session.delete(user)
    await uow.commit()

    remaining = list(
        await uow.session.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id))
    )
    assert remaining == [], "the tokens of a deleted member must go with it"
