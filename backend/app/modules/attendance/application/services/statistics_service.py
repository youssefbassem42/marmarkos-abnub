"""Service for calculating weekly meeting attendance statistics.

Two levels of analysis:

* **Per meeting** - present / late / attended / absent / expected and
  the rate for one Thursday meeting. PRESENT + LATE count as attended
  (BR-3) and the absence figure is flagged provisional until the cutoff
  (BR-5).
* **Per month** - the 4 meetings of a calendar month (5 when the month
  has five Thursdays), with per-meeting breakdown and month totals.
"""

from collections.abc import Callable
from datetime import date
from typing import TYPE_CHECKING

from app.core.time import now_local, today_local
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
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession


class StatisticsService:
    """Service for calculating meeting and monthly attendance statistics."""

    def __init__(
        self,
        session: "AsyncSession",
        *,
        today: Callable[[], date] = today_local,
        now: Callable[[], "datetime"] = now_local,
    ):
        self._session = session
        self._today = today
        self._now = now
        self._attendance_repo = WeeklyAttendanceRepository(session)
        self._absence_service = AbsenceCalculationService(session, today=today, now=now)

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
        meeting = current_meeting_date(meeting_date or self._today())

        counts = (await self._attendance_repo.counts_by_meeting_and_status([meeting])).get(
            meeting, {}
        )
        present_count = counts.get("PRESENT", 0)
        late_count = counts.get("LATE", 0)
        excused_count = counts.get("EXCUSED", 0)

        # BR-3: attended = present + late; the repository query is the
        # authoritative source for the attended figure.
        attended_count = await self._attendance_repo.count_attended_by_meeting(meeting)
        expected_count = await self._absence_service.calculate_expected_count(meeting)

        summary = AttendanceSummary(
            total_present=present_count,
            total_late=late_count,
            total_attended=attended_count,
            excused_count=excused_count,
            total_absent=max(expected_count - attended_count, 0),
            total_expected=expected_count,
            attendance_rate=_rate(attended_count, expected_count),
            is_final=self._absence_service.is_absence_final(meeting),
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
        today = self._today()
        year = year or today.year
        month = month or today.month

        meetings = meetings_in_month(year, month)
        open_meeting = current_meeting_date(today)
        held = [meeting for meeting in meetings if meeting <= open_meeting]

        # BR-4: the expected population is per meeting week, so each held
        # meeting gets its own expected count - computed once here and
        # reused everywhere below.
        expected_by_meeting: dict[date, int] = {
            meeting: await self._absence_service.calculate_expected_count(meeting)
            for meeting in held
        }

        status_counts = await self._attendance_repo.counts_by_meeting_and_status(meetings)
        attended_counts = await self._attendance_repo.counts_attended_by_meeting(held)
        user_counts = (
            await self._attendance_repo.counts_by_user_between(meetings[0], meetings[-1])
            if meetings
            else {}
        )

        meeting_stats: list[MeetingStat] = []
        for index, meeting in enumerate(meetings, start=1):
            is_held = meeting <= open_meeting
            counts = status_counts.get(meeting, {}) if is_held else {}
            attended_count = attended_counts.get(meeting, 0) if is_held else 0
            expected_count = expected_by_meeting.get(meeting, 0)
            meeting_stats.append(
                MeetingStat(
                    meeting_date=meeting,
                    meeting_index_in_month=index,
                    present_count=counts.get("PRESENT", 0),
                    late_count=counts.get("LATE", 0),
                    absent_count=max(expected_count - attended_count, 0),
                    attendance_rate=_rate(attended_count, expected_count),
                    is_held=is_held,
                )
            )

        meetings_held = len(held)
        total_attendance = sum(attended_counts.values())
        average_attendance = round(total_attendance / meetings_held, 2) if meetings_held else 0.0
        expected_total = sum(expected_by_meeting.values())
        attendance_rate = _rate(total_attendance, expected_total)

        # Per-member view, restricted to the current expected population.
        expected_users = await self._absence_service.get_expected_users(open_meeting)
        expected_ids = {user.id for user in expected_users}
        attended_users = {uid for uid in expected_ids if user_counts.get(uid, 0) > 0}
        full_attendance = (
            {uid for uid in expected_ids if user_counts.get(uid, 0) >= meetings_held}
            if meetings_held
            else set()
        )
        # Report field kept singular: the open meeting's expected count.
        expected_per_meeting = expected_by_meeting.get(open_meeting, 0)

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
            distinct_attendees=len(attended_users),
            full_attendance_count=len(full_attendance),
            no_attendance_count=len(expected_ids) - len(attended_users),
        )


def _rate(part: int, whole: int) -> float:
    """Percentage of ``part`` over ``whole``, rounded to 2 decimals."""
    if whole <= 0:
        return 0.0
    return round((part / whole) * 100, 2)
