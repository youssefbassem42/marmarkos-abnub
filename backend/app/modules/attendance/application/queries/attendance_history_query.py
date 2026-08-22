"""Query service for meeting attendance history with filters.

Filtering, sorting and pagination all happen in SQL
(``WeeklyAttendanceRepository.search``); this query only snaps calendar
dates to meeting dates, applies the "no filters -> last 4 meetings"
default, and maps rows to DTOs from eagerly loaded relations.
"""

from datetime import date, timedelta
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from app.core.time import today_local
from app.modules.attendance.application.dto.check_in_dto import AttendanceDTO
from app.modules.attendance.application.queries.meeting_attendance_query import display_name
from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.attendance.domain.meeting_schedule import (
    MEETING_INTERVAL_DAYS,
    current_meeting_date,
    meeting_dates_between,
    meeting_index_in_month,
)
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

#: Meetings returned when the caller passes no date filter (one month).
DEFAULT_HISTORY_MEETINGS = 4

SortColumn = Literal["meeting_date", "check_in_at"]
SortOrder = Literal["asc", "desc"]


class AttendanceHistoryQuery:
    """Query service for retrieving meeting attendance history with filters."""

    def __init__(self, session: "AsyncSession"):
        self._session = session
        self._attendance_repo = WeeklyAttendanceRepository(session)

    async def execute(
        self,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        user_id: UUID | None = None,
        status: AttendanceStatus | None = None,
        page: int = 1,
        size: int = 20,
        sort: SortColumn = "meeting_date",
        order: SortOrder = "desc",
    ) -> tuple[list[AttendanceDTO], int]:
        """Get one page of attendance history with optional filters.

        Date filters are snapped to meeting dates so callers can pass
        any calendar day without silently dropping records. With no
        filters at all, the last ``DEFAULT_HISTORY_MEETINGS`` meetings
        are searched.

        Returns:
            Tuple of (page of attendance DTOs, total matching records)
        """
        # Date filters are snapped to meeting dates so callers can pass
        # any calendar day without silently dropping records.
        today = today_local()
        start_meeting = current_meeting_date(start_date) if start_date else None
        end_meeting = current_meeting_date(end_date) if end_date else None

        if start_meeting is None and end_meeting is None and user_id is None and status is None:
            # No filters: the last DEFAULT_HISTORY_MEETINGS meetings.
            open_meeting = current_meeting_date(today)
            window_start = open_meeting - timedelta(
                days=MEETING_INTERVAL_DAYS * DEFAULT_HISTORY_MEETINGS
            )
            meetings = meeting_dates_between(window_start, open_meeting)
            start_meeting = meetings[-DEFAULT_HISTORY_MEETINGS]
            end_meeting = open_meeting

        offset = (page - 1) * size
        rows = await self._attendance_repo.search(
            start=start_meeting,
            end=end_meeting,
            user_id=user_id,
            status=status,
            limit=size,
            offset=offset,
            sort=sort,
            descending=(order == "desc"),
        )
        total = await self._attendance_repo.count_search(
            start=start_meeting, end=end_meeting, user_id=user_id, status=status
        )

        result = []
        for attendance, user, recorder in rows:
            if user is None:
                continue

            result.append(
                AttendanceDTO(
                    id=attendance.id,
                    user_id=attendance.user_id,
                    user_name=display_name(user),
                    meeting_date=attendance.meeting_date,
                    meeting_index_in_month=meeting_index_in_month(attendance.meeting_date),
                    check_in_at=attendance.check_in_at,
                    status=str(attendance.status.value),
                    method=str(attendance.method.value),
                    recorded_by=attendance.recorded_by,
                    recorded_by_name=(display_name(recorder) if recorder is not None else ""),
                )
            )

        return result, total
