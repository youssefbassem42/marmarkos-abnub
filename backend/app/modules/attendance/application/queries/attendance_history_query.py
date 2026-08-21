"""Query service for meeting attendance history with filters."""

from datetime import date, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select

from app.modules.attendance.application.dto.check_in_dto import AttendanceDTO
from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.attendance.domain.meeting_schedule import (
    MEETING_INTERVAL_DAYS,
    current_meeting_date,
    meeting_index_in_month,
)
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)
from app.modules.users.infrastructure.persistence.models import User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

#: Meetings returned when the caller passes no date filter (one month).
DEFAULT_HISTORY_MEETINGS = 4


class AttendanceHistoryQuery:
    """Query service for retrieving meeting attendance history with filters."""

    def __init__(self, session: "AsyncSession"):
        self._session = session
        self._attendance_repo = WeeklyAttendanceRepository(session)

    async def execute(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        user_id: UUID | None = None,
        status: AttendanceStatus | None = None,
    ) -> list[AttendanceDTO]:
        """Get attendance history with optional filters.

        Args:
            start_date: Any date in the first meeting week to include
            end_date: Any date in the last meeting week to include
            user_id: Filter by specific user
            status: Filter by attendance status

        Returns:
            List of attendance DTOs matching the filters
        """
        # Date filters are snapped to meeting dates so callers can pass
        # any calendar day without silently dropping records.
        start_meeting = current_meeting_date(start_date) if start_date else None
        end_meeting = current_meeting_date(end_date) if end_date else None

        if user_id is not None:
            attendance_records = await self._attendance_repo.find_by_user(user_id)

            if start_meeting or end_meeting:
                attendance_records = [
                    rec
                    for rec in attendance_records
                    if (start_meeting is None or rec.meeting_date >= start_meeting)
                    and (end_meeting is None or rec.meeting_date <= end_meeting)
                ]
        elif start_meeting and end_meeting:
            attendance_records = await self._attendance_repo.find_by_meeting_range(
                start_meeting, end_meeting
            )
        elif start_meeting or end_meeting:
            single_meeting = start_meeting or end_meeting
            assert single_meeting is not None
            attendance_records = await self._attendance_repo.find_by_meeting(single_meeting)
        else:
            # No filters: the last DEFAULT_HISTORY_MEETINGS meetings.
            end_meeting = current_meeting_date()
            start_meeting = end_meeting - timedelta(
                days=MEETING_INTERVAL_DAYS * (DEFAULT_HISTORY_MEETINGS - 1)
            )
            attendance_records = await self._attendance_repo.find_by_meeting_range(
                start_meeting, end_meeting
            )

        if status is not None:
            attendance_records = [rec for rec in attendance_records if rec.status == status]

        if not attendance_records:
            return []

        users = await self._load_users({rec.user_id for rec in attendance_records})

        result = []
        for attendance in attendance_records:
            user = users.get(attendance.user_id)
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
                    meeting_index_in_month=meeting_index_in_month(attendance.meeting_date),
                    check_in_at=attendance.check_in_at,
                    status=attendance.status.value,
                )
            )

        return result

    async def _load_users(self, user_ids: set[UUID]) -> dict[UUID, User]:
        """Fetch every referenced user in one query (avoids N+1 lookups)."""
        stmt = select(User).where(User.id.in_(user_ids))
        result = await self._session.execute(stmt)
        return {user.id: user for user in result.scalars().all()}
