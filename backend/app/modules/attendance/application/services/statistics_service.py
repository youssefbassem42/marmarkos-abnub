"""Service for calculating weekly meeting attendance statistics.

Two levels of analysis:

* **Per meeting** - present / absent / expected and the rate for one
  Thursday meeting.
* **Per month** - the 4 meetings of a calendar month (5 when the month
  has five Thursdays), with per-meeting breakdown and month totals.
"""

from datetime import date
from typing import TYPE_CHECKING

from app.modules.attendance.application.dto.query_dto import (
    AttendanceSummary,
    MeetingStat,
    MeetingStatisticsResponse,
    MonthlyStatisticsResponse,
)
from app.modules.attendance.application.services.absence_service import (
    AbsenceCalculationService,
)
from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meeting_index_in_month,
    meetings_in_month,
)
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class StatisticsService:
    """Service for calculating meeting and monthly attendance statistics."""

    def __init__(self, session: "AsyncSession"):
        self._session = session
        self._attendance_repo = WeeklyAttendanceRepository(session)
        self._absence_service = AbsenceCalculationService(session)

    async def calculate_meeting_statistics(
        self, meeting_date: date | None = None
    ) -> MeetingStatisticsResponse:
        """Calculate statistics for a single meeting.

        Args:
            meeting_date: Any date inside the wanted meeting week; it is
                resolved to that week's meeting. Defaults to the current
                meeting.

        Returns:
            Meeting statistics with attendance rate
        """
        meeting = current_meeting_date(meeting_date)

        present_count = await self._attendance_repo.count_by_meeting(meeting)
        expected_count = await self._absence_service.calculate_expected_count()

        summary = AttendanceSummary(
            total_present=present_count,
            total_absent=max(expected_count - present_count, 0),
            total_expected=expected_count,
            attendance_rate=_rate(present_count, expected_count),
        )

        return MeetingStatisticsResponse(
            meeting_date=meeting,
            meeting_index_in_month=meeting_index_in_month(meeting),
            summary=summary,
        )

    async def calculate_monthly_statistics(
        self, year: int | None = None, month: int | None = None
    ) -> MonthlyStatisticsResponse:
        """Calculate statistics across every meeting of a calendar month.

        Args:
            year: Calendar year (defaults to the current year)
            month: Calendar month 1-12 (defaults to the current month)

        Returns:
            Monthly statistics with a per-meeting breakdown
        """
        today = date.today()
        year = year or today.year
        month = month or today.month

        meetings = meetings_in_month(year, month)
        open_meeting = current_meeting_date(today)
        held = [meeting for meeting in meetings if meeting <= open_meeting]

        expected_per_meeting = await self._absence_service.calculate_expected_count()

        counts: dict[date, int] = {}
        user_counts: dict[str, int] = {}
        if meetings:
            counts = await self._attendance_repo.counts_by_meeting(
                meetings[0], meetings[-1]
            )
            user_counts = {
                str(user_id): count
                for user_id, count in (
                    await self._attendance_repo.counts_by_user_between(
                        meetings[0], meetings[-1]
                    )
                ).items()
            }

        meeting_stats: list[MeetingStat] = []
        for index, meeting in enumerate(meetings, start=1):
            is_held = meeting <= open_meeting
            present_count = counts.get(meeting, 0) if is_held else 0
            meeting_stats.append(
                MeetingStat(
                    meeting_date=meeting,
                    meeting_index_in_month=index,
                    present_count=present_count,
                    absent_count=(
                        max(expected_per_meeting - present_count, 0) if is_held else 0
                    ),
                    attendance_rate=(
                        _rate(present_count, expected_per_meeting) if is_held else 0.0
                    ),
                    is_held=is_held,
                )
            )

        total_attendance = sum(stat.present_count for stat in meeting_stats)
        meetings_held = len(held)

        average_attendance = (
            round(total_attendance / meetings_held, 2) if meetings_held else 0.0
        )
        attendance_rate = _rate(total_attendance, expected_per_meeting * meetings_held)

        # Per-member view, restricted to the expected (ACTIVE) population.
        expected_users = await self._absence_service.get_expected_users()
        expected_ids = {str(user.id) for user in expected_users}
        attended = {
            user_id for user_id in expected_ids if user_counts.get(user_id, 0) > 0
        }
        full_attendance = (
            {
                user_id
                for user_id in expected_ids
                if user_counts.get(user_id, 0) >= meetings_held
            }
            if meetings_held
            else set()
        )

        return MonthlyStatisticsResponse(
            year=year,
            month=month,
            total_meetings=len(meetings),
            meetings_held=meetings_held,
            expected_per_meeting=expected_per_meeting,
            meetings=meeting_stats,
            total_attendance=total_attendance,
            average_attendance=average_attendance,
            attendance_rate=attendance_rate,
            distinct_attendees=len(attended),
            full_attendance_count=len(full_attendance),
            no_attendance_count=len(expected_ids) - len(attended),
        )


def _rate(part: int, whole: int) -> float:
    """Percentage of ``part`` over ``whole``, rounded to 2 decimals."""
    if whole <= 0:
        return 0.0
    return round((part / whole) * 100, 2)
