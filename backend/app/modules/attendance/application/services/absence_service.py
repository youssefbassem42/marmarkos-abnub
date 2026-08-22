"""Service for calculating absent users for a weekly meeting.

Business rules (Part 1 §1.3):

* BR-4 - the expected population for a meeting is every user with
  ``status = ACTIVE`` whose account existed on or before the end of that
  meeting week, so a member registered yesterday is never reported
  absent for an earlier meeting.
* BR-5 - the absent list of the open meeting is provisional until the
  configured absence cutoff on the meeting day (``is_absence_final``).
* BR-3 - only PRESENT and LATE count as attended; a member holding an
  EXCUSED record is neither attended nor absent.
"""

from collections.abc import Callable
from datetime import UTC, date
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.time import local_datetime, now_local, today_local
from app.modules.attendance.application.dto.query_dto import AbsentUserDTO
from app.modules.attendance.domain.enums import ATTENDED_STATUSES
from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meeting_week_end,
)
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.ext.asyncio import AsyncSession


class AbsenceCalculationService:
    """Service to calculate absent users for one weekly meeting."""

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

    async def calculate_absent_users(
        self, meeting_date: date | None = None
    ) -> tuple[int, list[AbsentUserDTO]]:
        """Calculate absent users for one meeting.

        A user is absent when they are in the expected population and
        hold neither an attended record (PRESENT / LATE) nor an EXCUSED
        record for the meeting.

        Args:
            meeting_date: Any date inside the wanted meeting week; it is
                resolved to that week's meeting. Defaults to the current
                meeting.

        Returns:
            Tuple of (absent_count, absent_user_list)
        """
        meeting = current_meeting_date(meeting_date or self._today())

        expected_users = await self.get_expected_users(meeting)
        expected_user_ids = {user.id for user in expected_users}

        attendance_records = await self._attendance_repo.find_by_meeting(meeting)
        statuses_by_user: dict[object, set[str]] = {}
        for record in attendance_records:
            statuses_by_user.setdefault(record.user_id, set()).add(str(record.status))

        attended_values = {status.value for status in ATTENDED_STATUSES}
        attended_ids = {
            uid for uid, statuses in statuses_by_user.items() if statuses & attended_values
        }
        excused_ids = {uid for uid, s in statuses_by_user.items() if "EXCUSED" in s}

        absent_ids = expected_user_ids - attended_ids - excused_ids

        absent_users = [
            AbsentUserDTO(user_id=user.id, **self._display(user))
            for user in expected_users
            if user.id in absent_ids
        ]

        return len(absent_users), absent_users

    @staticmethod
    def _display(user: User) -> dict[str, str]:
        """Best available display fields for a user."""
        name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
        return {"name": name, "email": user.email, "role": str(user.role.name.value)}

    def _week_closed_at(self, meeting: date) -> "datetime":
        """Aware UTC instant of 23:59 local on the meeting week's end."""
        return local_datetime(meeting_week_end(meeting), "23:59").astimezone(UTC)

    async def get_expected_users(self, meeting_date: date | None = None) -> list[User]:
        """Get all active users who are expected to attend a meeting.

        Expected = ACTIVE accounts created on or before the end of that
        meeting week (BR-4). Future phases can refine this with service
        enrollment or groups.
        """
        meeting = current_meeting_date(meeting_date or self._today())
        stmt = (
            select(User)
            .options(selectinload(User.role))
            .where(
                User.status == UserStatus.ACTIVE,
                User.created_at <= self._week_closed_at(meeting),
            )
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def calculate_expected_count(self, meeting_date: date | None = None) -> int:
        """Get the count of expected users for a meeting (BR-4)."""
        meeting = current_meeting_date(meeting_date or self._today())
        stmt = (
            select(func.count())
            .select_from(User)
            .where(
                User.status == UserStatus.ACTIVE,
                User.created_at <= self._week_closed_at(meeting),
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    def is_absence_final(self, meeting_date: date | None = None) -> bool:
        """Whether the absent list of a meeting is final (BR-5).

        Final when the meeting is already over, or when it is the open
        meeting and the configured absence cutoff has passed locally.
        """
        meeting = current_meeting_date(meeting_date or self._today())
        open_meeting = current_meeting_date(self._today())

        if meeting < open_meeting:
            return True
        if meeting > open_meeting:
            return False
        return self._now() >= local_datetime(meeting, settings.MEETING_ABSENCE_CUTOFF_TIME)
