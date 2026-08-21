"""Integration tests for meeting attendance queries, absence and statistics."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.attendance.application.queries.attendance_history_query import (
    AttendanceHistoryQuery,
)
from app.modules.attendance.application.queries.meeting_attendance_query import (
    MeetingAttendanceQuery,
)
from app.modules.attendance.application.services.absence_service import (
    AbsenceCalculationService,
)
from app.modules.attendance.application.services.statistics_service import (
    StatisticsService,
)
from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meetings_in_month,
    previous_meeting_date,
)
from app.modules.attendance.infrastructure.persistence.weekly_models import (
    WeeklyAttendanceRecord,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from tests.integration.attendance.conftest import create_user

OPEN_MEETING = current_meeting_date()
PREVIOUS_MEETING = previous_meeting_date(OPEN_MEETING)


@pytest.fixture
async def test_users(db_session: AsyncSession) -> list[User]:
    """Five ACTIVE members (the expected population)."""
    users = []
    for index in range(5):
        users.append(
            await create_user(
                db_session,
                email=f"user{index}@test.com",
                role_name=RoleName.MEMBER,
                first_name=f"User{index}",
            )
        )
    return users


@pytest.fixture
async def attendance_records(db_session: AsyncSession, test_users: list[User]) -> None:
    """Users 0-2 attend the open meeting; users 0-1 also attended the previous one."""
    recorder_id = test_users[0].id

    for user in test_users[:3]:
        db_session.add(
            WeeklyAttendanceRecord(
                id=uuid.uuid4(),
                user_id=user.id,
                meeting_date=OPEN_MEETING,
                check_in_at=datetime.now(),
                status="PRESENT",
                recorded_by=recorder_id,
            )
        )

    for user in test_users[:2]:
        db_session.add(
            WeeklyAttendanceRecord(
                id=uuid.uuid4(),
                user_id=user.id,
                meeting_date=PREVIOUS_MEETING,
                check_in_at=datetime.now() - timedelta(days=7),
                status="PRESENT",
                recorded_by=recorder_id,
            )
        )

    await db_session.commit()


@pytest.mark.asyncio
async def test_meeting_query_defaults_to_the_open_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = MeetingAttendanceQuery(db_session)
    results = await query.execute()

    assert len(results) == 3
    assert all(record.meeting_date == OPEN_MEETING for record in results)
    assert all(record.status == "PRESENT" for record in results)


@pytest.mark.asyncio
async def test_meeting_query_snaps_any_weekday_to_its_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    """A Saturday inside the meeting week resolves to that Thursday."""
    query = MeetingAttendanceQuery(db_session)
    results = await query.execute(OPEN_MEETING + timedelta(days=2))

    assert len(results) == 3
    assert all(record.meeting_date == OPEN_MEETING for record in results)


@pytest.mark.asyncio
async def test_meeting_query_for_the_previous_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = MeetingAttendanceQuery(db_session)
    results = await query.execute(PREVIOUS_MEETING)

    assert len(results) == 2
    assert all(record.meeting_date == PREVIOUS_MEETING for record in results)


@pytest.mark.asyncio
async def test_absence_calculation_for_the_open_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    service = AbsenceCalculationService(db_session)
    absent_count, absent_users = await service.calculate_absent_users(OPEN_MEETING)

    assert absent_count == 2
    absent_ids = {uuid.UUID(user["user_id"]) for user in absent_users}
    assert absent_ids == {test_users[3].id, test_users[4].id}


@pytest.mark.asyncio
async def test_absence_calculation_defaults_to_the_open_meeting(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    service = AbsenceCalculationService(db_session)
    absent_count, _ = await service.calculate_absent_users()

    assert absent_count == 2


@pytest.mark.asyncio
async def test_meeting_statistics(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    service = StatisticsService(db_session)
    stats = await service.calculate_meeting_statistics()

    assert stats.meeting_date == OPEN_MEETING
    assert stats.meeting_index_in_month >= 1
    assert stats.summary.total_present == 3
    assert stats.summary.total_absent == 2
    assert stats.summary.total_expected == 5
    assert stats.summary.attendance_rate == 60.0  # 3/5 * 100


@pytest.mark.asyncio
async def test_monthly_statistics(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    service = StatisticsService(db_session)
    stats = await service.calculate_monthly_statistics(OPEN_MEETING.year, OPEN_MEETING.month)

    month_meetings = meetings_in_month(OPEN_MEETING.year, OPEN_MEETING.month)
    held = [meeting for meeting in month_meetings if meeting <= OPEN_MEETING]

    assert stats.total_meetings == len(month_meetings)
    assert stats.total_meetings in (4, 5)
    assert stats.meetings_held == len(held)
    assert stats.expected_per_meeting == 5

    by_date = {stat.meeting_date: stat for stat in stats.meetings}
    assert by_date[OPEN_MEETING].present_count == 3
    assert by_date[OPEN_MEETING].absent_count == 2
    assert by_date[OPEN_MEETING].attendance_rate == 60.0
    assert by_date[OPEN_MEETING].is_held is True

    # Future meetings of the month are listed but empty.
    for stat in stats.meetings:
        assert stat.is_held is (stat.meeting_date <= OPEN_MEETING)
        if not stat.is_held:
            assert stat.present_count == 0
            assert stat.absent_count == 0

    # The previous meeting only counts when it falls in the same month.
    attended_per_user = {user.id: 0 for user in test_users}
    for user in test_users[:3]:
        attended_per_user[user.id] += 1
    if PREVIOUS_MEETING in by_date:
        assert by_date[PREVIOUS_MEETING].present_count == 2
        for user in test_users[:2]:
            attended_per_user[user.id] += 1

    expected_total = sum(attended_per_user.values())
    assert stats.total_attendance == expected_total
    assert stats.average_attendance == round(expected_total / len(held), 2)
    assert stats.attendance_rate == round(expected_total * 100 / (5 * len(held)), 2)

    assert stats.distinct_attendees == 3
    assert stats.no_attendance_count == 2
    assert stats.full_attendance_count == sum(
        1 for count in attended_per_user.values() if count >= len(held)
    )


@pytest.mark.asyncio
async def test_history_defaults_to_the_last_four_meetings(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = AttendanceHistoryQuery(db_session)
    results = await query.execute()

    assert len(results) == 5  # 3 at the open meeting + 2 at the previous one


@pytest.mark.asyncio
async def test_history_filtered_by_user(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = AttendanceHistoryQuery(db_session)
    results = await query.execute(user_id=test_users[0].id)

    assert len(results) == 2
    assert {record.meeting_date for record in results} == {OPEN_MEETING, PREVIOUS_MEETING}


@pytest.mark.asyncio
async def test_history_filtered_by_meeting_range(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    query = AttendanceHistoryQuery(db_session)
    results = await query.execute(start_date=PREVIOUS_MEETING, end_date=PREVIOUS_MEETING)

    assert len(results) == 2


@pytest.mark.asyncio
async def test_history_snaps_calendar_dates_to_meetings(
    db_session: AsyncSession, test_users: list[User], attendance_records: None
):
    """Passing a Friday must not silently drop that week's records."""
    friday = OPEN_MEETING + timedelta(days=1)
    query = AttendanceHistoryQuery(db_session)
    results = await query.execute(start_date=friday, end_date=friday)

    assert len(results) == 3


@pytest.mark.asyncio
async def test_expected_count(db_session: AsyncSession, test_users: list[User]):
    service = AbsenceCalculationService(db_session)

    assert await service.calculate_expected_count() == 5
