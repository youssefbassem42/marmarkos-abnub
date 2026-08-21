"""Service for calculating absent users for a weekly meeting."""

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.modules.attendance.domain.meeting_schedule import current_meeting_date
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class AbsenceCalculationService:
    """Service to calculate absent users for a weekly meeting.

    Business logic:
    - Expected users = all ACTIVE users in the system
    - Present users = users recorded for that meeting
    - Absent users = Expected - Present

    Note: For Phase 2, we use simple logic. Later phases can introduce
    service groups, classes, or enrollment to refine expected population.
    """

    def __init__(self, session: "AsyncSession"):
        self._session = session
        self._attendance_repo = WeeklyAttendanceRepository(session)

    async def calculate_absent_users(
        self, meeting_date: date | None = None
    ) -> tuple[int, list[dict[str, str]]]:
        """Calculate absent users for one meeting.

        Args:
            meeting_date: Any date inside the wanted meeting week; it is
                resolved to that week's meeting. Defaults to the current
                meeting.

        Returns:
            Tuple of (absent_count, absent_user_list)
        """
        meeting = current_meeting_date(meeting_date)

        # Get all active users (expected population)
        expected_users = await self.get_expected_users()
        expected_user_ids = {user.id for user in expected_users}

        # Get present users
        attendance_records = await self._attendance_repo.find_by_meeting(meeting)
        present_user_ids = {record.user_id for record in attendance_records}

        # Calculate absent user IDs
        absent_user_ids = expected_user_ids - present_user_ids

        # Build absent user list with details
        absent_users = []
        for user in expected_users:
            if user.id in absent_user_ids:
                user_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
                if not user_name:
                    user_name = user.email

                absent_users.append(
                    {
                        "user_id": str(user.id),
                        "name": user_name,
                        "email": user.email,
                        "role": user.role.name.value,
                    }
                )

        return len(absent_users), absent_users

    async def get_expected_users(self) -> list[User]:
        """Get all active users who are expected to attend.

        For Phase 2, this is simply all ACTIVE users.
        Future phases can filter by service enrollment, groups, etc.
        """
        stmt = select(User).where(User.status == UserStatus.ACTIVE)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def calculate_expected_count(self) -> int:
        """Get the count of expected users."""
        users = await self.get_expected_users()
        return len(users)
