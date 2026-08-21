"""API router for weekly meeting attendance management."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.modules.attendance.application.commands.check_in_command import CheckInCommand
from app.modules.attendance.application.dto.check_in_dto import (
    CheckInRequest,
    CheckInResponse,
)
from app.modules.attendance.application.dto.query_dto import (
    AbsentUsersResponse,
    AttendanceHistoryResponse,
    MeetingAttendanceResponse,
    MeetingScheduleResponse,
    MeetingStatisticsResponse,
    MonthlyStatisticsResponse,
)
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
from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.attendance.domain.meeting_schedule import (
    MEETING_DAY_NAME,
    current_meeting_date,
    meeting_index_in_month,
    meetings_in_month,
)
from app.modules.auth.presentation.dependencies import get_current_user
from app.modules.users.infrastructure.persistence.models import User

router = APIRouter(prefix="/attendance", tags=["attendance"])

_MEETING_DATE_QUERY = Query(
    description=(
        "Any date inside the wanted meeting week; it is resolved to that "
        f"week's {MEETING_DAY_NAME} meeting. Defaults to the current meeting."
    ),
)

CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db_session)]
MeetingDateParam = Annotated[date | None, _MEETING_DATE_QUERY]
YearParam = Annotated[int | None, Query(ge=2000, le=2100, description="Calendar year")]
MonthParam = Annotated[int | None, Query(ge=1, le=12, description="Calendar month (1-12)")]


@router.post("/check-in", response_model=CheckInResponse, status_code=201)
async def check_in(
    request: CheckInRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> CheckInResponse:
    """Record attendance for the current weekly meeting by scanning a QR code.

    Scanning works on any weekday: the record is attributed to the
    meeting of the current meeting week (Thursday through Wednesday).
    Attendance can never be recorded twice for the same user and meeting,
    nor for a future or already closed meeting.

    Args:
        request: Check-in request containing the QR code and an optional
            expected meeting date
        current_user: The authenticated admin user
        session: Database session

    Returns:
        Check-in response with attendance details

    Raises:
        403: If user lacks permission to record attendance
        409: If the user is already recorded for this meeting
        422: If the QR code is invalid, the user account is not active,
            or the requested meeting is not the open one
    """
    command = CheckInCommand(session)
    return await command.execute(
        qr_code=request.qr_code,
        admin_user=current_user,
        meeting_date=request.meeting_date,
    )


@router.get("/meeting", response_model=MeetingAttendanceResponse)
async def get_meeting_attendance(
    meeting_date: MeetingDateParam,
    current_user: CurrentUser,
    session: DbSession,
) -> MeetingAttendanceResponse:
    """Get the attendance records of one weekly meeting.

    Args:
        meeting_date: Optional date resolved to its meeting
        current_user: The authenticated user
        session: Database session

    Returns:
        The meeting's attendance records, ordered by check-in time
    """
    query = MeetingAttendanceQuery(session)
    meeting = query.resolve_meeting(meeting_date)
    attendance_records = await query.execute(meeting)

    return MeetingAttendanceResponse(
        meeting_date=meeting,
        meeting_index_in_month=meeting_index_in_month(meeting),
        is_open=meeting == current_meeting_date(),
        total_present=len(attendance_records),
        attendance_records=attendance_records,
    )


@router.get("/meetings", response_model=MeetingScheduleResponse)
async def get_meeting_schedule(
    year: YearParam,
    month: MonthParam,
    current_user: CurrentUser,
) -> MeetingScheduleResponse:
    """Get the meeting calendar of a month (4 meetings, 5 in long months).

    Args:
        year: Calendar year (defaults to the current year)
        month: Calendar month (defaults to the current month)
        current_user: The authenticated user

    Returns:
        The month's meeting dates and the meeting open for check-in
    """
    today = date.today()
    year = year or today.year
    month = month or today.month
    meetings = meetings_in_month(year, month)

    return MeetingScheduleResponse(
        year=year,
        month=month,
        meeting_day=MEETING_DAY_NAME,
        total_meetings=len(meetings),
        meetings=meetings,
        open_meeting_date=current_meeting_date(today),
    )


@router.get("/absent", response_model=AbsentUsersResponse)
async def get_absent_users(
    meeting_date: MeetingDateParam,
    current_user: CurrentUser,
    session: DbSession,
) -> AbsentUsersResponse:
    """Get users who were expected at a meeting but did not check in.

    Args:
        meeting_date: Optional date resolved to its meeting
        current_user: The authenticated user
        session: Database session

    Returns:
        Absent users list with count
    """
    meeting = current_meeting_date(meeting_date)

    service = AbsenceCalculationService(session)
    absent_count, absent_users = await service.calculate_absent_users(meeting)

    return AbsentUsersResponse(
        meeting_date=meeting,
        absent_count=absent_count,
        absent_users=absent_users,
    )


@router.get("/statistics/meeting", response_model=MeetingStatisticsResponse)
async def get_meeting_statistics(
    meeting_date: MeetingDateParam,
    current_user: CurrentUser,
    session: DbSession,
) -> MeetingStatisticsResponse:
    """Get attendance statistics for one weekly meeting.

    Returns present, absent, expected counts and the attendance rate.

    Args:
        meeting_date: Optional date resolved to its meeting
        current_user: The authenticated user
        session: Database session

    Returns:
        Meeting statistics with attendance summary
    """
    service = StatisticsService(session)
    return await service.calculate_meeting_statistics(meeting_date)


@router.get("/statistics/monthly", response_model=MonthlyStatisticsResponse)
async def get_monthly_statistics(
    year: YearParam,
    month: MonthParam,
    current_user: CurrentUser,
    session: DbSession,
) -> MonthlyStatisticsResponse:
    """Get monthly attendance analysis across the month's meetings.

    Returns a per-meeting breakdown for the 4 meetings of the month
    (5 when the month contains five Thursdays) plus month totals.

    Args:
        year: Calendar year (defaults to the current year)
        month: Calendar month (defaults to the current month)
        current_user: The authenticated user
        session: Database session

    Returns:
        Monthly statistics with per-meeting breakdown
    """
    service = StatisticsService(session)
    return await service.calculate_monthly_statistics(year, month)


@router.get("", response_model=AttendanceHistoryResponse)
async def get_attendance_history(
    start_date: Annotated[date | None, Query(description="Any date in the first meeting week")],
    end_date: Annotated[date | None, Query(description="Any date in the last meeting week")],
    user_id: Annotated[UUID | None, Query(description="Filter by specific user")],
    status: Annotated[AttendanceStatus | None, Query(description="Filter by attendance status")],
    current_user: CurrentUser,
    session: DbSession,
) -> AttendanceHistoryResponse:
    """Get meeting attendance history with optional filters.

    Date filters are snapped to meeting dates. With no filters, the last
    4 meetings (one month) are returned.

    Args:
        start_date: Start of the range
        end_date: End of the range
        user_id: Filter by specific user ID
        status: Filter by attendance status
        current_user: The authenticated user
        session: Database session

    Returns:
        Attendance history with total count
    """
    query = AttendanceHistoryQuery(session)
    attendance_records = await query.execute(
        start_date=start_date,
        end_date=end_date,
        user_id=user_id,
        status=status,
    )

    return AttendanceHistoryResponse(
        total_count=len(attendance_records),
        attendance_records=attendance_records,
    )
