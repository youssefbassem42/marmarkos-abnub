"""Query service for retrieving a weekly meeting's attendance."""

from datetime import date
from typing import TYPE_CHECKING

from app.modules.attendance.application.dto.check_in_dto import AttendanceDTO
from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meeting_index_in_month,
)
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class MeetingAttendanceQuery:
    """Query service for the attendance records of one weekly meeting."""

    def __init__(self, session: "AsyncSession"):
        self._session = session
        self._attendance_repo = WeeklyAttendanceRepository(session)

    async def execute(self, meeting_date: date | None = None) -> list[AttendanceDTO]:
        """Get attendance records for a meeting.

        Args:
            meeting_date: Any date inside the wanted meeting week; it is
                resolved to that week's meeting. Defaults to the meeting
                of the current week.

        Returns:
            List of attendance DTOs ordered by check-in time
        """
        meeting = self.resolve_meeting(meeting_date)
        index = meeting_index_in_month(meeting)

        records = await self._attendance_repo.find_users_by_meeting(meeting)

        result: list[AttendanceDTO] = []
        for attendance, user in records:
            if user is None:
                continue

            user_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            if not user_name:
                user_name = user.email

            result.append(
                AttendanceDTO(
                    id=attendance.id,
                    user_id=attendance.user_id,
                    user_name=user_name,
                    meeting_date=attendance.meeting_date,
                    meeting_index_in_month=index,
                    check_in_at=attendance.check_in_at,
                    status=attendance.status.value,
                )
            )

        return result

    @staticmethod
    def resolve_meeting(meeting_date: date | None = None) -> date:
        """Resolve any date (or ``None``) to the meeting it belongs to."""
        return current_meeting_date(meeting_date)
