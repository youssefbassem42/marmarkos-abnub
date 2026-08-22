"""Two simultaneous scans of one badge produce exactly one record."""

import asyncio
import hashlib
import uuid as uuid_module
from datetime import timedelta

import pytest
from sqlalchemy import insert, text

from app.config import settings
from app.core.database import async_session_factory
from app.core.exceptions.errors import ConflictError
from app.core.time import local_datetime, today_local
from app.modules.attendance.application.commands.check_in_command import CheckInCommand
from app.modules.attendance.domain.meeting_schedule import current_meeting_date
from app.modules.users.infrastructure.persistence.models import UserQrCode
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.attendance.conftest import create_user
from app.modules.users.domain.enums.role_name import RoleName


@pytest.mark.asyncio
async def test_concurrent_double_scan_writes_one_record(db_engine) -> None:
    """asyncio.gather on two independent sessions -> one 201, one 409."""
    session_a = async_session_factory()
    session_b = async_session_factory()
    seed = async_session_factory()

    try:
        admin = await create_user(
            seed, email="race.admin@test.com", role_name=RoleName.ADMIN, first_name="Race"
        )
        member = await create_user(
            seed,
            email="race.member@test.com",
            role_name=RoleName.MEMBER,
            first_name="Race",
            last_name="Member",
        )

        token = "race-token-1"
        await seed.execute(
            insert(UserQrCode).values(
                id=uuid_module.uuid4(),
                user_id=member.id,
                token_hash=hashlib.sha256(token.encode()).hexdigest(),
                is_active=True,
            )
        )
        await seed.commit()

        open_meeting = current_meeting_date(today_local())
        on_time = local_datetime(open_meeting, settings.MEETING_START_TIME) - timedelta(
            minutes=30
        )

        command_a = CheckInCommand(UnitOfWork(session_a), now=lambda: on_time)
        command_b = CheckInCommand(UnitOfWork(session_b), now=lambda: on_time)

        results = await asyncio.gather(
            command_a.execute(token, admin),
            command_b.execute(token, admin),
            return_exceptions=True,
        )

        successes = [r for r in results if not isinstance(r, BaseException)]
        conflicts = [r for r in results if isinstance(r, ConflictError)]
        unexpected = [
            r for r in results if isinstance(r, BaseException) and not isinstance(r, ConflictError)
        ]

        assert len(successes) == 1
        assert len(conflicts) == 1
        assert unexpected == []

    finally:
        for session in (session_a, session_b, seed):
            await session.close()

    # Exactly one row survived the race.
    async with db_engine.connect() as conn:
        count = (
            await conn.execute(text("select count(*) from weekly_attendance_records"))
        ).scalar_one()
    assert count == 1
