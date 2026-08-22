"""Legacy service-session attendance repository.

LEGACY / FROZEN (decision D-8): this repository serves the legacy
``service_sessions`` / ``attendance_records`` tables. No Phase 2
endpoint uses it and it must not be extended, migrated, or dropped
during Sprint 2; a Phase 3 decision will retire or repurpose it.
Live attendance lives in ``weekly_attendance_repository``.
"""

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.attendance.domain.meeting_schedule import (
    current_meeting_date,
    meeting_dates_between,
    meetings_in_month,
)
from app.modules.attendance.infrastructure.persistence.models import AttendanceRecord


class AttendanceRepository:
    """Attendance records + analytics derived from plain SQL queries.

    The service meets once a week (Thursday), so analytics aggregate per
    *meeting* and per *month of meetings* (4, sometimes 5) instead of per
    calendar day.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, record: AttendanceRecord) -> None:
        self._session.add(record)
        await self._session.flush()

    async def get_for_user_session(
        self, user_id: uuid.UUID, session_id: uuid.UUID
    ) -> AttendanceRecord | None:
        result = await self._session.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.user_id == user_id,
                AttendanceRecord.session_id == session_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_between(self, start: date, end: date) -> list[AttendanceRecord]:
        result = await self._session.execute(
            select(AttendanceRecord)
            .options(selectinload(AttendanceRecord.user))
            .where(
                AttendanceRecord.attendance_date >= start, AttendanceRecord.attendance_date <= end
            )
            .order_by(AttendanceRecord.scanned_at)
        )
        return list(result.scalars().all())

    async def count_between(self, start: date, end: date) -> int:
        result = await self._session.execute(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.attendance_date >= start,
                AttendanceRecord.attendance_date <= end,
            )
        )
        return int(result.scalar_one())

    async def count_for_meeting(self, meeting_date: date) -> int:
        """Records attached to a single meeting date."""
        return await self.count_between(meeting_date, meeting_date)

    async def count_current_meeting(self, today: date | None = None) -> int:
        """Records for the meeting of the current meeting week."""
        # Legacy module (frozen by decision D-8): falls back to the server
        # clock exactly as it did before the platform clock existed.
        return await self.count_for_meeting(current_meeting_date(today or date.today()))

    async def count_for_meetings(self, meetings: list[date]) -> int:
        """Records across an explicit set of meeting dates."""
        if not meetings:
            return 0
        result = await self._session.execute(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.attendance_date.in_(meetings)
            )
        )
        return int(result.scalar_one())

    async def count_month_meetings(self, today: date | None = None) -> int:
        """Records across every meeting of ``today``'s month held so far."""
        reference = today or date.today()
        open_meeting = current_meeting_date(reference)
        meetings = [
            meeting
            for meeting in meetings_in_month(reference.year, reference.month)
            if meeting <= open_meeting
        ]
        return await self.count_for_meetings(meetings)

    async def count_total(self) -> int:
        result = await self._session.execute(select(func.count(AttendanceRecord.id)))
        return int(result.scalar_one())

    async def attendance_percentage_between(self, start: date, end: date) -> float | None:
        """Distinct attendees / active users within a window, as a percentage."""
        from app.modules.users.domain.enums.user_status import UserStatus
        from app.modules.users.infrastructure.persistence.models import User

        attendees = (
            select(func.count(func.distinct(AttendanceRecord.user_id)))
            .where(
                AttendanceRecord.attendance_date >= start,
                AttendanceRecord.attendance_date <= end,
            )
            .scalar_subquery()
        )
        active_users = (
            select(func.count(User.id)).where(User.status == UserStatus.ACTIVE).scalar_subquery()
        )
        result = await self._session.execute(select(attendees, active_users))
        attended, active = result.one()
        if not active:
            return None
        return float(round(attended * 100.0 / active, 2))

    async def absent_users_since(self, cutoff: date) -> list[uuid.UUID]:
        """Active users with NO attendance record on/after ``cutoff``."""
        from app.modules.users.domain.enums.user_status import UserStatus
        from app.modules.users.infrastructure.persistence.models import User

        attended = select(AttendanceRecord.user_id).where(
            AttendanceRecord.attendance_date >= cutoff
        )
        result = await self._session.execute(
            select(User.id).where(User.status == UserStatus.ACTIVE, User.id.not_in(attended))
        )
        return list(result.scalars().all())

    async def meeting_trend(self, start: date, end: date) -> list[tuple[date, int]]:
        """Attendance per meeting between ``start`` and ``end``.

        Every meeting in the range is reported, including meetings with
        no attendance (count ``0``), so charts keep a stable x-axis.
        """
        result = await self._session.execute(
            select(AttendanceRecord.attendance_date, func.count(AttendanceRecord.id))
            .where(
                AttendanceRecord.attendance_date >= start, AttendanceRecord.attendance_date <= end
            )
            .group_by(AttendanceRecord.attendance_date)
            .order_by(AttendanceRecord.attendance_date)
        )
        counts = {row[0]: int(row[1]) for row in result.all()}
        return [(meeting, counts.get(meeting, 0)) for meeting in meeting_dates_between(start, end)]
