"""API router for weekly meeting attendance management."""

from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_db_session, get_unit_of_work
from app.core.time import today_local
from app.modules.attendance.application.commands.check_in_command import CheckInCommand
from app.modules.attendance.application.commands.excuse_attendance_command import (
    ExcuseAttendanceCommand,
)
from app.modules.attendance.application.dto.check_in_dto import (
    CheckInRequest,
    CheckInResponse,
    ExcuseRequest,
    ExcuseResponse,
)
from app.modules.attendance.application.dto.query_dto import (
    AbsentUsersResponse,
    AttendanceHistoryResponse,
    MeetingAttendanceResponse,
    MeetingScheduleResponse,
    MeetingStatisticsResponse,
    MonthlyStatisticsResponse,
    MyAttendanceResponse,
)
from app.modules.attendance.application.queries.attendance_history_query import (
    AttendanceHistoryQuery,
)
from app.modules.attendance.application.queries.meeting_attendance_query import (
    MeetingAttendanceQuery,
)
from app.modules.attendance.application.queries.my_attendance_query import MyAttendanceQuery
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
from app.modules.auth.presentation.dependencies import get_current_user, require_role
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

router = APIRouter(prefix="/attendance", tags=["attendance"])

_MEETING_DATE_QUERY = Query(
    description=(
        "Any date inside the wanted meeting week; it is resolved to that "
        f"week's {MEETING_DAY_NAME} meeting. Defaults to the current meeting."
    ),
)

CurrentUser = Annotated[User, Depends(get_current_user)]
#: BR-7: every attendance management route requires ADMIN or SERVANT.
AttendanceManager = Annotated[User, Depends(require_role(RoleName.ADMIN, RoleName.SERVANT))]
DbSession = Annotated[AsyncSession, Depends(get_db_session)]
Uow = Annotated[UnitOfWork, Depends(get_unit_of_work)]
MeetingDateParam = Annotated[date | None, _MEETING_DATE_QUERY]
YearParam = Annotated[int | None, Query(ge=2000, le=2100, description="Calendar year")]
MonthParam = Annotated[int | None, Query(ge=1, le=12, description="Calendar month (1-12)")]

#: Documented on every ADMIN/SERVANT-only route (BR-7).
_RESPONSE_FORBIDDEN = {"description": "Caller is not ADMIN or SERVANT"}


@router.post(
    "/check-in",
    response_model=CheckInResponse,
    status_code=201,
    responses={
        403: _RESPONSE_FORBIDDEN,
        409: {"description": "User already recorded for this meeting"},
        422: {"description": "Invalid QR code, inactive user or meeting not open"},
    },
)
async def check_in(
    request: CheckInRequest,
    current_user: AttendanceManager,
    uow: Uow,
) -> CheckInResponse:
    """Record attendance for the current weekly meeting by scanning a QR code.

    Scanning works on any weekday: the record is attributed to the
    meeting of the current meeting week (Thursday through Wednesday).
    Attendance can never be recorded twice for the same user and meeting,
    nor for a future or already closed meeting. A scan later than the
    meeting start time plus the grace period is recorded as LATE.

    Args:
        request: Check-in request containing the QR code, an optional
            expected meeting date and the scan method
        current_user: The authenticated admin or servant
        uow: Unit of work; record, outbox event and audit row commit
            atomically

    Returns:
        Check-in response with attendance details

    Raises:
        403: If user lacks permission to record attendance
        409: If the user is already recorded for this meeting
        422: If the QR code is invalid, the user account is not active,
            or the requested meeting is not the open one
    """
    command = CheckInCommand(uow)
    return await command.execute(
        qr_code=request.qr_code,
        admin_user=current_user,
        meeting_date=request.meeting_date,
        method=request.method,
    )


@router.get(
    "/meeting",
    response_model=MeetingAttendanceResponse,
    responses={403: _RESPONSE_FORBIDDEN},
)
async def get_meeting_attendance(
    current_user: AttendanceManager,
    session: DbSession,
    meeting_date: MeetingDateParam = None,
) -> MeetingAttendanceResponse:
    """Get the attendance records of one weekly meeting.

    Args:
        meeting_date: Optional date resolved to its meeting
        current_user: The authenticated admin or servant
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
        is_open=meeting == current_meeting_date(today_local()),
        total_present=len(attendance_records),
        attendance_records=attendance_records,
    )


@router.get(
    "/meetings",
    response_model=MeetingScheduleResponse,
    responses={403: _RESPONSE_FORBIDDEN},
)
async def get_meeting_schedule(
    year: YearParam = None,
    month: MonthParam = None,
    current_user: AttendanceManager = None,  # type: ignore[assignment]
) -> MeetingScheduleResponse:
    """Get the meeting calendar of a month (4 meetings, 5 in long months).

    Args:
        year: Calendar year (defaults to the current year)
        month: Calendar month (defaults to the current month)
        current_user: The authenticated admin or servant

    Returns:
        The month's meeting dates and the meeting open for check-in
    """
    today = today_local()
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


@router.get(
    "/absent",
    response_model=AbsentUsersResponse,
    responses={403: _RESPONSE_FORBIDDEN},
)
async def get_absent_users(
    current_user: AttendanceManager,
    session: DbSession,
    meeting_date: MeetingDateParam = None,
) -> AbsentUsersResponse:
    """Get users who were expected at a meeting but did not attend.

    Expected users are ACTIVE accounts that existed on or before the end
    of that meeting week. Members holding an attended (PRESENT/LATE) or
    EXCUSED record are excluded. Until the absence cutoff on the meeting
    day, ``is_final`` is false and the list is provisional.

    Args:
        meeting_date: Optional date resolved to its meeting
        current_user: The authenticated admin or servant
        session: Database session

    Returns:
        Absent users list with count and finality flag
    """
    meeting = current_meeting_date(meeting_date or today_local())

    service = AbsenceCalculationService(session)
    absent_count, absent_users = await service.calculate_absent_users(meeting)

    return AbsentUsersResponse(
        meeting_date=meeting,
        absent_count=absent_count,
        absent_users=absent_users,
        is_final=service.is_absence_final(meeting),
    )


@router.get(
    "/statistics/meeting",
    response_model=MeetingStatisticsResponse,
    responses={403: _RESPONSE_FORBIDDEN},
)
async def get_meeting_statistics(
    current_user: AttendanceManager,
    session: DbSession,
    meeting_date: MeetingDateParam = None,
) -> MeetingStatisticsResponse:
    """Get attendance statistics for one weekly meeting.

    Returns present, late, attended, absent and expected counts plus the
    attendance rate (PRESENT + LATE count as attended).

    Args:
        meeting_date: Optional date resolved to its meeting
        current_user: The authenticated admin or servant
        session: Database session

    Returns:
        Meeting statistics with attendance summary
    """
    service = StatisticsService(session)
    return await service.calculate_meeting_statistics(meeting_date)


@router.get(
    "/statistics/monthly",
    response_model=MonthlyStatisticsResponse,
    responses={403: _RESPONSE_FORBIDDEN},
)
async def get_monthly_statistics(
    year: YearParam = None,
    month: MonthParam = None,
    current_user: AttendanceManager = None,  # type: ignore[assignment]
    session: DbSession = None,  # type: ignore[assignment]
) -> MonthlyStatisticsResponse:
    """Get monthly attendance analysis across the month's meetings.

    Returns a per-meeting breakdown for the 4 meetings of the month
    (5 when the month contains five Thursdays) plus month totals.

    Args:
        year: Calendar year (defaults to the current year)
        month: Calendar month (defaults to the current month)
        current_user: The authenticated admin or servant
        session: Database session

    Returns:
        Monthly statistics with per-meeting breakdown
    """
    service = StatisticsService(session)
    return await service.calculate_monthly_statistics(year, month)


@router.get(
    "",
    response_model=AttendanceHistoryResponse,
    responses={403: _RESPONSE_FORBIDDEN},
)
async def get_attendance_history(
    current_user: AttendanceManager,
    session: DbSession,
    start_date: Annotated[
        date | None, Query(description="Any date in the first meeting week")
    ] = None,
    end_date: Annotated[date | None, Query(description="Any date in the last meeting week")] = None,
    user_id: Annotated[UUID | None, Query(description="Filter by specific user")] = None,
    status_filter: Annotated[
        AttendanceStatus | None, Query(alias="status", description="Filter by status")
    ] = None,
    page: Annotated[int, Query(ge=1, description="1-based page number")] = 1,
    size: Annotated[
        int,
        Query(
            ge=1,
            le=settings.ATTENDANCE_HISTORY_MAX_PAGE_SIZE,
            description="Items per page",
        ),
    ] = settings.ATTENDANCE_HISTORY_PAGE_SIZE,
    sort: Annotated[
        Literal["meeting_date", "check_in_at"], Query(description="Sort column")
    ] = "meeting_date",
    order: Annotated[Literal["asc", "desc"], Query(description="Sort direction")] = "desc",
) -> AttendanceHistoryResponse:
    """Get paginated attendance history with optional filters.

    Date filters are snapped to meeting dates. With no filters, the last
    4 meetings (one month) are returned. Filtering, sorting and paging
    happen in SQL.

    Args:
        start_date: Start of the range
        end_date: End of the range
        user_id: Filter by specific user ID
        status_filter: Filter by attendance status
        current_user: The authenticated admin or servant
        session: Database session
        page: 1-based page number
        size: Page size (capped at ATTENDANCE_HISTORY_MAX_PAGE_SIZE)
        sort: Sort column
        order: Sort direction

    Returns:
        One page of attendance history with pagination metadata
    """
    query = AttendanceHistoryQuery(session)
    attendance_records, total_count = await query.execute(
        start_date=start_date,
        end_date=end_date,
        user_id=user_id,
        status=status_filter,
        page=page,
        size=size,
        sort=sort,
        order=order,
    )

    pages = -(-total_count // size) if total_count else 0
    return AttendanceHistoryResponse(
        total_count=total_count,
        attendance_records=attendance_records,
        page=page,
        size=size,
        pages=pages,
        has_next=page < pages,
    )


@router.get(
    "/me",
    response_model=MyAttendanceResponse,
    responses={401: {"description": "Not authenticated"}},
)
async def get_my_attendance(
    current_user: CurrentUser,
    session: DbSession,
    year: YearParam = None,
    month: MonthParam = None,
) -> MyAttendanceResponse:
    """Get the calling user's own attendance for a calendar month.

    Available to any authenticated member; the response contains only
    the caller's records and never an administrator's identity.

    Args:
        current_user: The authenticated caller
        session: Database session
        year: Calendar year (defaults to the current local year)
        month: Calendar month (defaults to the current local month)

    Returns:
        Month summary plus the caller's own records
    """
    query = MyAttendanceQuery(session)
    return await query.execute(current_user.id, year=year, month=month)


@router.post(
    "/{attendance_id}/excuse",
    response_model=ExcuseResponse,
    responses={
        403: {"description": "Caller is not an ADMIN"},
        404: {"description": "Attendance record not found"},
        422: {"description": "Past meetings cannot be corrected"},
    },
)
async def excuse_attendance(
    attendance_id: UUID,
    current_user: Annotated[User, Depends(require_role(RoleName.ADMIN))],
    request: ExcuseRequest,
    uow: Uow,
) -> ExcuseResponse:
    """Correct an attendance record of the open meeting to EXCUSED.

    The only permitted correction (append-only otherwise): ADMIN-only,
    open meeting only, always audited.

    Args:
        attendance_id: The attendance record to correct
        current_user: The authenticated administrator
        request: Optional reason stored in the audit log
        uow: Unit of work; correction, outbox event and audit row commit
            atomically

    Returns:
        The corrected attendance record

    Raises:
        403: If the caller is not an ADMIN
        404: If the record does not exist
        422: If the record belongs to a past meeting
    """
    command = ExcuseAttendanceCommand(uow)
    return await command.execute(
        attendance_id=attendance_id,
        admin_user=current_user,
        reason=request.reason,
    )
