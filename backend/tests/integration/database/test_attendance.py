"""Attendance creation, duplicate prevention and analytics tests."""

from datetime import date, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.database import async_session_factory
from app.core.time import today_local
from app.modules.attendance.domain.enums.attendance import (
    AttendanceMethod,
    ServiceType,
)
from app.modules.attendance.domain.meeting_schedule import current_meeting_date
from app.modules.attendance.infrastructure.persistence.models import (
    AttendanceRecord,
    ServiceSession,
)
from app.modules.users.domain.enums.user_status import UserStatus
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def make_session(
    uow: UnitOfWork,
    *,
    name: str = "Weekly Youth Meeting",
    date_: date | None = None,
) -> ServiceSession:
    session = ServiceSession(
        name=name,
        date=date_ or current_meeting_date(today_local()),
        service_type=ServiceType.YOUTH_MEETING,
        is_active=True,
    )
    await uow.service_sessions.add(session)
    return session


async def test_attendance_creation(uow: UnitOfWork) -> None:
    member = await make_user(uow, "attendee@example.com")
    scanner = await make_user(uow, "scanner@example.com")
    session = await make_session(uow)
    await uow.commit()

    record = AttendanceRecord(
        user_id=member.id,
        session_id=session.id,
        attendance_date=session.date,
        scanned_by=scanner.id,
        method=AttendanceMethod.QR_SCAN,
    )
    await uow.attendance.add(record)
    await uow.commit()

    stored = await uow.attendance.get_for_user_session(member.id, session.id)
    assert stored is not None
    assert stored.method is AttendanceMethod.QR_SCAN
    assert stored.scanned_at is not None


async def test_duplicate_attendance_prevented(uow: UnitOfWork) -> None:
    member = await make_user(uow, "twice@example.com")
    session = await make_session(uow)
    await uow.commit()

    await uow.attendance.add(
        AttendanceRecord(user_id=member.id, session_id=session.id, attendance_date=session.date)
    )
    await uow.commit()

    with pytest.raises(IntegrityError):
        async with UnitOfWork.create(async_session_factory) as second:
            await second.attendance.add(
                AttendanceRecord(
                    user_id=member.id,
                    session_id=session.id,
                    attendance_date=session.date,
                    method=AttendanceMethod.MANUAL,
                )
            )
            await second.commit()


async def test_multiple_sessions_same_meeting_date_allowed(uow: UnitOfWork) -> None:
    """Different sessions on the same meeting date are distinct attendance events."""
    member = await make_user(uow, "multi@example.com")
    meeting = current_meeting_date(today_local())
    morning = await make_session(uow, name="Morning Service", date_=meeting)
    evening = await make_session(uow, name="Evening Service", date_=meeting)
    await uow.commit()

    await uow.attendance.add(
        AttendanceRecord(user_id=member.id, session_id=morning.id, attendance_date=meeting)
    )
    await uow.attendance.add(
        AttendanceRecord(user_id=member.id, session_id=evening.id, attendance_date=meeting)
    )
    await uow.commit()

    assert await uow.attendance.count_current_meeting() == 2


async def test_attendance_counts_and_percentage(uow: UnitOfWork) -> None:
    meeting = current_meeting_date(today_local())
    active_member = await make_user(uow, "stats-active@example.com")
    await make_user(uow, "stats-other@example.com")
    session = await make_session(uow, date_=meeting)
    await uow.commit()

    await uow.attendance.add(
        AttendanceRecord(user_id=active_member.id, session_id=session.id, attendance_date=meeting)
    )
    await uow.commit()

    assert await uow.attendance.count_total() == 1
    assert await uow.attendance.count_current_meeting() == 1
    assert await uow.attendance.count_for_meeting(meeting) == 1
    assert await uow.attendance.count_for_meetings([meeting]) == 1
    assert await uow.attendance.count_month_meetings(meeting) >= 1
    assert await uow.attendance.count_between(meeting, meeting) == 1

    percentage = await uow.attendance.attendance_percentage_between(meeting, meeting)
    assert percentage is not None
    assert percentage == 50.0  # 1 of 2 active users attended

    trend = await uow.attendance.meeting_trend(meeting, meeting)
    assert trend == [(meeting, 1)]


async def test_absent_users_detection(uow: UnitOfWork) -> None:
    meeting = current_meeting_date(today_local())
    present = await make_user(uow, "present@example.com")
    absent = await make_user(uow, "absent@example.com")
    inactive = await make_user(uow, "inactive@example.com")
    session = await make_session(uow, date_=meeting)
    await uow.commit()

    async with UnitOfWork.create(async_session_factory) as second:
        user = await second.users.get_by_id(inactive.id)
        assert user is not None
        user.status = UserStatus.INACTIVE
        await second.commit()

    await uow.attendance.add(
        AttendanceRecord(user_id=present.id, session_id=session.id, attendance_date=meeting)
    )
    await uow.commit()

    cutoff = meeting - timedelta(weeks=1)
    absent_ids = await uow.attendance.absent_users_since(cutoff)
    assert present.id not in absent_ids
    assert absent.id in absent_ids
    assert inactive.id not in absent_ids  # status-based: inactive users are excluded


async def test_manual_attendance_method(uow: UnitOfWork) -> None:
    member = await make_user(uow, "manual@example.com")
    session = await make_session(uow)
    await uow.commit()

    record = AttendanceRecord(
        user_id=member.id,
        session_id=session.id,
        attendance_date=session.date,
        method=AttendanceMethod.MANUAL,
        notes="Walked in without QR",
    )
    await uow.attendance.add(record)
    await uow.commit()

    stored = await uow.attendance.get_for_user_session(member.id, session.id)
    assert stored is not None
    assert stored.method is AttendanceMethod.MANUAL
    assert stored.notes == "Walked in without QR"
