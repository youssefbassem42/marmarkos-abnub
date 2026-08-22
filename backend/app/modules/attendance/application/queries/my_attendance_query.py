"""Query service for the calling member's own attendance (US-012)."""

from typing import TYPE_CHECKING
from uuid import UUID

from app.core.time import today_local
from app.modules.attendance.application.dto.query_dto import (
    MyAttendanceRecord,
    MyAttendanceResponse,
)
from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meeting_index_in_month,
    meetings_in_month,
    month_bounds,
)
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


def _rate(part: int, whole: int) -> float:
    """Percentage of ``part`` over ``whole``, rounded to 2 decimals."""
    if whole <= 0:
        return 0.0
    return round((part / whole) * 100, 2)


class MyAttendanceQuery:
    """Query service returning a member's own attendance for one month.

    Members may read their own attendance only; the response never
    includes other members' data nor admin identity fields.
    """

    def __init__(self, session: "AsyncSession"):
        self._session = session
        self._attendance_repo = WeeklyAttendanceRepository(session)

    async def execute(
        self,
        user_id: UUID,
        year: int | None = None,
        month: int | None = None,
    ) -> MyAttendanceResponse:
        """Get the member's attendance for a calendar month.

        Args:
            user_id: The calling user's id
            year: Calendar year (defaults to the current local year)
            month: Calendar month 1-12 (defaults to the current local month)

        Returns:
            Month summary plus the member's own records
        """
        today = today_local()
        year = year or today.year
        month = month or today.month

        meetings = meetings_in_month(year, month)
        open_meeting = current_meeting_date(today)
        held_count = sum(1 for meeting in meetings if meeting <= open_meeting)

        month_start, month_end = month_bounds(year, month)
        records = await self._attendance_repo.find_by_user_between(user_id, month_start, month_end)
        attended_count = sum(1 for record in records if record.is_attended)

        return MyAttendanceResponse(
            year=year,
            month=month,
            total_meetings=len(meetings),
            meetings_held=held_count,
            attended_count=attended_count,
            attendance_rate=_rate(attended_count, held_count),
            records=[
                MyAttendanceRecord(
                    meeting_date=record.meeting_date,
                    meeting_index_in_month=meeting_index_in_month(record.meeting_date),
                    check_in_at=record.check_in_at,
                    status=str(record.status.value),
                )
                for record in records
            ],
        )
