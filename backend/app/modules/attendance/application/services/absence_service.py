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
from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meeting_week_end,
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

    async def calculate_absent_users(
        self,
        meeting_date: date | None = None,
        *,
        limit: int | None = None,
        offset: int = 0,
    ) -> tuple[int, list[AbsentUserDTO]]:
        """Calculate absent users for one meeting entirely in SQL.

        A user is absent when they are in the expected population and
        hold neither an attended record (PRESENT / LATE) nor an EXCUSED
        record for the meeting.

        The subquery approach (NOT IN) pushes all set-subtraction work to
        the database, avoiding full-table Python-side filtering. Pagination
        is applied at the SQL level so the result set is bounded even when
        the membership is large.

        Args:
            meeting_date: Any date inside the wanted meeting week; it is
                resolved to that week's meeting. Defaults to the current
                meeting.
            limit: Optional maximum number of rows to return (server-side
                pagination). ``None`` returns everyone.
            offset: Number of rows to skip (used with ``limit``).

        Returns:
            Tuple of (absent_count, absent_user_list)
        """
        from app.modules.attendance.infrastructure.persistence.weekly_models import (
            WeeklyAttendanceRecord,
        )

        meeting = current_meeting_date(meeting_date or self._today())
        week_closed = self._week_closed_at(meeting)

        # Sub-select: user IDs that already have any attendance record for
        # this meeting (PRESENT, LATE, or EXCUSED all exclude from absent).
        accounted_subq = (
            select(WeeklyAttendanceRecord.user_id)
            .where(WeeklyAttendanceRecord.meeting_date == meeting)
            .distinct()
            .scalar_subquery()
        )

        # Base filter: active members whose accounts existed by end of week.
        base_where = (
            User.status == UserStatus.ACTIVE,
            User.created_at <= week_closed,
            User.id.not_in(accounted_subq),
        )

        # Count query (no ORDER BY / LIMIT for correctness).
        count_stmt = (
            select(func.count())
            .select_from(User)
            .where(*base_where)
        )
        absent_count = int((await self._session.execute(count_stmt)).scalar_one())

        # Paginated data query.
        data_stmt = (
            select(User)
            .options(selectinload(User.role))
            .where(*base_where)
            .order_by(User.first_name.asc(), User.last_name.asc())
        )
        if limit is not None:
            data_stmt = data_stmt.limit(limit).offset(offset)

        result = await self._session.execute(data_stmt)
        absent_users = [
            AbsentUserDTO(user_id=user.id, **self._display(user))
            for user in result.scalars().all()
        ]

        return absent_count, absent_users

    @staticmethod
    def _display(user: User) -> dict[str, str]:
        """Best available display fields for a user."""
        name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
        return {"name": name, "email": user.email, "role": str(user.role.name.value)}

    def _week_closed_at(self, meeting: date) -> "datetime":
        """Aware UTC instant of midnight at the start of the day *after*
        the meeting week's last day (i.e. the week closes at 00:00 of the
        following day, not at 23:59 on the last day).

        Using the exclusive upper-bound avoids a one-minute gap at the end
        of each week where newly registered members would be missed.
        """
        from datetime import timedelta

        next_day = meeting_week_end(meeting) + timedelta(days=1)
        return local_datetime(next_day, "00:00").astimezone(UTC)

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
