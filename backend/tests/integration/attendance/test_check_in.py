"""Integration tests for the weekly meeting check-in flow."""

import hashlib
import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions.errors import ConflictError, ForbiddenError, ValidationError
from app.core.time import local_datetime, today_local
from app.modules.attendance.application.commands.check_in_command import CheckInCommand
from app.modules.attendance.domain.meeting_schedule import (
    MEETING_INTERVAL_DAYS,
    current_meeting_date,
)
from app.modules.attendance.infrastructure.persistence.weekly_models import (
    WeeklyAttendanceRecord,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User, UserQrCode
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.attendance.conftest import create_user


def _on_time_now() -> datetime:
    """A clock pinned just before the meeting start + grace threshold."""
    meeting = current_meeting_date(today_local())
    return local_datetime(meeting, settings.MEETING_START_TIME) - timedelta(minutes=30)


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user for testing."""
    return await create_user(
        db_session,
        email="admin@test.com",
        role_name=RoleName.ADMIN,
        first_name="Admin",
        last_name="User",
    )


@pytest.fixture
async def member_user(db_session: AsyncSession) -> User:
    """Create a member user for testing."""
    return await create_user(
        db_session,
        email="member@test.com",
        role_name=RoleName.MEMBER,
        first_name="John",
        last_name="Doe",
    )


@pytest.fixture
async def member_with_qr(db_session: AsyncSession, member_user: User) -> tuple[User, str]:
    """Create a member with QR code."""
    qr_token = "test_qr_token_123"
    token_hash = hashlib.sha256(qr_token.encode()).hexdigest()

    qr_code = UserQrCode(
        id=uuid.uuid4(),
        user_id=member_user.id,
        token_hash=token_hash,
        is_active=True,
    )
    db_session.add(qr_code)
    await db_session.commit()

    return member_user, qr_token


@pytest.mark.asyncio
async def test_check_in_records_the_current_meeting(
    db_session: AsyncSession, admin_user: User, member_with_qr: tuple[User, str]
):
    """A scan on any weekday is attributed to the current meeting."""
    member_user, qr_token = member_with_qr
    open_meeting = current_meeting_date(today_local())

    command = CheckInCommand(UnitOfWork(db_session), now=_on_time_now)
    result = await command.execute(qr_token, admin_user)

    assert result.success is True
    assert result.message == "Attendance recorded successfully"
    assert result.attendance.user_id == member_user.id
    assert result.attendance.user_name == "John Doe"
    assert result.attendance.status == "PRESENT"
    assert result.attendance.meeting_date == open_meeting
    assert result.attendance.meeting_date.weekday() == 3  # Thursday
    assert 1 <= result.attendance.meeting_index_in_month <= 5
    assert result.attendance.method == "QR_SCAN"
    assert result.attendance.recorded_by == admin_user.id
    assert result.attendance.recorded_by_name == "Admin User"

    # Verify record in database
    stmt = select(WeeklyAttendanceRecord).where(WeeklyAttendanceRecord.user_id == member_user.id)
    db_result = await db_session.execute(stmt)
    record = db_result.scalar_one()

    assert record.user_id == member_user.id
    assert record.recorded_by == admin_user.id
    assert record.status == "PRESENT"
    assert record.method == "QR_SCAN"
    assert record.meeting_date == open_meeting
    assert record.check_in_at.tzinfo is not None  # BR-1: aware UTC storage


@pytest.mark.asyncio
async def test_explicit_open_meeting_date_is_accepted(
    db_session: AsyncSession, admin_user: User, member_with_qr: tuple[User, str]
):
    """Passing the open meeting explicitly records the same meeting."""
    _, qr_token = member_with_qr
    open_meeting = current_meeting_date(today_local())

    command = CheckInCommand(UnitOfWork(db_session))
    result = await command.execute(qr_token, admin_user, meeting_date=open_meeting)

    assert result.attendance.meeting_date == open_meeting


@pytest.mark.asyncio
async def test_duplicate_check_in_raises_conflict(
    db_session: AsyncSession, admin_user: User, member_with_qr: tuple[User, str]
):
    """Attendance cannot be taken twice for the same user and meeting."""
    _, qr_token = member_with_qr

    command = CheckInCommand(UnitOfWork(db_session))

    await command.execute(qr_token, admin_user)

    with pytest.raises(ConflictError) as exc_info:
        await command.execute(qr_token, admin_user)

    assert "already recorded" in str(exc_info.value)
    assert current_meeting_date(today_local()).isoformat() in str(exc_info.value)


@pytest.mark.asyncio
async def test_duplicate_check_in_leaves_a_single_record(
    db_session: AsyncSession, admin_user: User, member_with_qr: tuple[User, str]
):
    """A rejected duplicate must not create a second row."""
    member_user, qr_token = member_with_qr

    command = CheckInCommand(UnitOfWork(db_session))
    await command.execute(qr_token, admin_user)

    with pytest.raises(ConflictError):
        await command.execute(qr_token, admin_user)

    stmt = select(WeeklyAttendanceRecord).where(WeeklyAttendanceRecord.user_id == member_user.id)
    records = (await db_session.execute(stmt)).scalars().all()
    assert len(records) == 1


@pytest.mark.asyncio
async def test_future_meeting_is_rejected(
    db_session: AsyncSession, admin_user: User, member_with_qr: tuple[User, str]
):
    """Attendance cannot be taken for a meeting that has not happened."""
    _, qr_token = member_with_qr
    next_meeting = current_meeting_date(today_local()) + timedelta(days=MEETING_INTERVAL_DAYS)

    command = CheckInCommand(UnitOfWork(db_session))

    with pytest.raises(ValidationError) as exc_info:
        await command.execute(qr_token, admin_user, meeting_date=next_meeting)

    assert "has not been held yet" in str(exc_info.value)


@pytest.mark.asyncio
async def test_past_meeting_is_rejected(
    db_session: AsyncSession, admin_user: User, member_with_qr: tuple[User, str]
):
    """Attendance cannot be back-dated to a closed meeting."""
    _, qr_token = member_with_qr
    previous_meeting = current_meeting_date(today_local()) - timedelta(days=MEETING_INTERVAL_DAYS)

    command = CheckInCommand(UnitOfWork(db_session))

    with pytest.raises(ValidationError) as exc_info:
        await command.execute(qr_token, admin_user, meeting_date=previous_meeting)

    assert "closed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_non_meeting_date_is_rejected(
    db_session: AsyncSession, admin_user: User, member_with_qr: tuple[User, str]
):
    """Only Thursdays are meeting dates."""
    _, qr_token = member_with_qr
    not_a_meeting = current_meeting_date(today_local()) + timedelta(days=1)  # Friday

    command = CheckInCommand(UnitOfWork(db_session))

    with pytest.raises(ValidationError) as exc_info:
        await command.execute(qr_token, admin_user, meeting_date=not_a_meeting)

    assert "not a meeting date" in str(exc_info.value)


@pytest.mark.asyncio
async def test_invalid_qr_raises_validation_error(db_session: AsyncSession, admin_user: User):
    """Test that invalid QR code raises ValidationError."""
    command = CheckInCommand(UnitOfWork(db_session))

    with pytest.raises(ValidationError) as exc_info:
        await command.execute("invalid_qr_token", admin_user)

    assert "Invalid or inactive QR code" in str(exc_info.value)


@pytest.mark.asyncio
async def test_member_cannot_check_in_others(
    db_session: AsyncSession, member_user: User, member_with_qr: tuple[User, str]
):
    """Test that members cannot record attendance (only admin/servant can)."""
    _, qr_token = member_with_qr

    command = CheckInCommand(UnitOfWork(db_session))

    with pytest.raises(ForbiddenError) as exc_info:
        await command.execute(qr_token, member_user)

    assert "do not have permission" in str(exc_info.value)


@pytest.mark.asyncio
async def test_inactive_user_qr_raises_validation_error(
    db_session: AsyncSession, admin_user: User, member_with_qr: tuple[User, str]
):
    """Test that QR code of inactive user raises ValidationError."""
    member_user, qr_token = member_with_qr

    # Suspend the member user
    member_user.status = UserStatus.SUSPENDED
    await db_session.commit()

    command = CheckInCommand(UnitOfWork(db_session))

    with pytest.raises(ValidationError) as exc_info:
        await command.execute(qr_token, admin_user)

    assert "suspended" in str(exc_info.value).lower()
