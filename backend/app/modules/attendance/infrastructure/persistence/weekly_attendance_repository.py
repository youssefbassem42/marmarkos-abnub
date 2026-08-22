"""Repository implementation for weekly meeting attendance records.

Implements
:class:`app.modules.attendance.domain.interfaces.WeeklyAttendanceRepositoryProtocol`
via explicit inheritance, so mypy fails when the two drift apart.
"""

import uuid
from datetime import date
from typing import Any, Literal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.attendance.domain.entities import Attendance
from app.modules.attendance.domain.enums import (
    ATTENDED_STATUSES,
    AttendanceMethod,
    AttendanceStatus,
)
from app.modules.attendance.domain.interfaces import WeeklyAttendanceRepositoryProtocol
from app.modules.attendance.infrastructure.persistence.weekly_models import (
    WeeklyAttendanceRecord,
)
from app.modules.users.infrastructure.persistence.models import User


class WeeklyAttendanceRepository(WeeklyAttendanceRepositoryProtocol):
    """SQLAlchemy implementation of the weekly attendance repository.

    Every lookup is keyed by ``meeting_date`` (the Thursday of a meeting
    week), never by an arbitrary calendar day.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, attendance: Attendance) -> Attendance:
        """Persist a new attendance record."""
        db_record = WeeklyAttendanceRecord(
            id=attendance.id,
            user_id=attendance.user_id,
            meeting_date=attendance.meeting_date,
            check_in_at=attendance.check_in_at,
            status=attendance.status,
            method=attendance.method,
            recorded_by=attendance.recorded_by,
            created_at=attendance.created_at,
            updated_at=attendance.updated_at,
        )
        self._session.add(db_record)
        await self._session.flush()
        return attendance

    async def update(self, attendance: Attendance) -> Attendance:
        """Persist changes to an existing record (status corrections).

        Sprint 2 permits exactly one correction: marking a record of the
        open meeting as EXCUSED (BR-6). ``meeting_date``,
        ``check_in_at``, ``user_id`` and ``recorded_by`` are immutable.
        """
        db_record = await self._session.get(WeeklyAttendanceRecord, attendance.id)
        if db_record is None:
            return attendance

        db_record.status = attendance.status
        await self._session.flush()
        return attendance

    async def get_by_id(self, attendance_id: uuid.UUID) -> Attendance | None:
        """Retrieve by primary key."""
        stmt = select(WeeklyAttendanceRecord).where(WeeklyAttendanceRecord.id == attendance_id)
        result = await self._session.execute(stmt)
        db_record = result.scalar_one_or_none()

        if db_record is None:
            return None

        return self._to_domain(db_record)

    async def find_by_user_and_meeting(
        self, user_id: uuid.UUID, meeting_date: date
    ) -> Attendance | None:
        """Check if attendance already exists for user at the given meeting."""
        stmt = select(WeeklyAttendanceRecord).where(
            and_(
                WeeklyAttendanceRecord.user_id == user_id,
                WeeklyAttendanceRecord.meeting_date == meeting_date,
            )
        )
        result = await self._session.execute(stmt)
        db_record = result.scalar_one_or_none()

        if db_record is None:
            return None

        return self._to_domain(db_record)

    async def find_by_meeting(self, meeting_date: date) -> list[Attendance]:
        """Retrieve all attendance records for a single meeting."""
        stmt = (
            select(WeeklyAttendanceRecord)
            .where(WeeklyAttendanceRecord.meeting_date == meeting_date)
            .order_by(WeeklyAttendanceRecord.check_in_at)
        )
        result = await self._session.execute(stmt)
        db_records = result.scalars().all()

        return [self._to_domain(record) for record in db_records]

    async def find_by_meeting_range(self, start_date: date, end_date: date) -> list[Attendance]:
        """Retrieve attendance records for every meeting in a date range."""
        stmt = (
            select(WeeklyAttendanceRecord)
            .where(
                and_(
                    WeeklyAttendanceRecord.meeting_date >= start_date,
                    WeeklyAttendanceRecord.meeting_date <= end_date,
                )
            )
            .order_by(WeeklyAttendanceRecord.meeting_date, WeeklyAttendanceRecord.check_in_at)
        )
        result = await self._session.execute(stmt)
        db_records = result.scalars().all()

        return [self._to_domain(record) for record in db_records]

    async def find_by_user(self, user_id: uuid.UUID) -> list[Attendance]:
        """Retrieve all attendance records for a specific user."""
        stmt = (
            select(WeeklyAttendanceRecord)
            .where(WeeklyAttendanceRecord.user_id == user_id)
            .order_by(WeeklyAttendanceRecord.meeting_date.desc())
        )
        result = await self._session.execute(stmt)
        db_records = result.scalars().all()

        return [self._to_domain(record) for record in db_records]

    async def find_by_user_between(
        self, user_id: uuid.UUID, start_date: date, end_date: date
    ) -> list[Attendance]:
        """A user's records whose meeting falls inside a date range (SQL)."""
        stmt = (
            select(WeeklyAttendanceRecord)
            .where(
                and_(
                    WeeklyAttendanceRecord.user_id == user_id,
                    WeeklyAttendanceRecord.meeting_date >= start_date,
                    WeeklyAttendanceRecord.meeting_date <= end_date,
                )
            )
            .order_by(WeeklyAttendanceRecord.meeting_date.desc())
        )
        result = await self._session.execute(stmt)
        return [self._to_domain(record) for record in result.scalars().all()]

    @staticmethod
    def _search_filters(
        *,
        start: date | None,
        end: date | None,
        user_id: uuid.UUID | None,
        status: AttendanceStatus | None,
    ) -> list[Any]:
        """Conditional WHERE clauses shared by search and count_search."""
        filters = []
        if start is not None:
            filters.append(WeeklyAttendanceRecord.meeting_date >= start)
        if end is not None:
            filters.append(WeeklyAttendanceRecord.meeting_date <= end)
        if user_id is not None:
            filters.append(WeeklyAttendanceRecord.user_id == user_id)
        if status is not None:
            filters.append(WeeklyAttendanceRecord.status == status)
        return filters

    async def search(
        self,
        *,
        start: date | None = None,
        end: date | None = None,
        user_id: uuid.UUID | None = None,
        status: AttendanceStatus | None = None,
        limit: int = 20,
        offset: int = 0,
        sort: Literal["meeting_date", "check_in_at"] = "meeting_date",
        descending: bool = True,
    ) -> list[tuple[Attendance, User | None, User | None]]:
        """Filtered, paginated, SQL-sorted attendance history.

        All filtering and ordering happens in the database; the page
        boundary is made stable by always appending ``id`` to the sort
        key. ``user`` and ``recorder`` are eager-loaded so DTO mapping
        never triggers lazy loads.
        """
        order_column = (
            WeeklyAttendanceRecord.check_in_at
            if sort == "check_in_at"
            else WeeklyAttendanceRecord.meeting_date
        )
        stmt = (
            select(WeeklyAttendanceRecord)
            .options(
                selectinload(WeeklyAttendanceRecord.user),
                selectinload(WeeklyAttendanceRecord.recorder),
            )
            .where(*self._search_filters(start=start, end=end, user_id=user_id, status=status))
            .order_by(
                order_column.desc() if descending else order_column.asc(),
                WeeklyAttendanceRecord.id.desc() if descending else WeeklyAttendanceRecord.id.asc(),
            )
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)

        return [
            (self._to_domain(record), record.user, record.recorder)
            for record in result.scalars().all()
        ]

    async def count_search(
        self,
        *,
        start: date | None = None,
        end: date | None = None,
        user_id: uuid.UUID | None = None,
        status: AttendanceStatus | None = None,
    ) -> int:
        """Total records matching the history filters (no pagination)."""
        stmt = select(func.count(WeeklyAttendanceRecord.id)).where(
            *self._search_filters(start=start, end=end, user_id=user_id, status=status)
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def find_users_by_meeting(
        self, meeting_date: date
    ) -> list[tuple[Attendance, User | None, User | None]]:
        """Attendance records for a meeting with their user and recorder.

        Eager-loads both relationships so callers do not issue one query
        per record when building DTOs.
        """
        stmt = (
            select(WeeklyAttendanceRecord)
            .options(
                selectinload(WeeklyAttendanceRecord.user),
                selectinload(WeeklyAttendanceRecord.recorder),
            )
            .where(WeeklyAttendanceRecord.meeting_date == meeting_date)
            .order_by(WeeklyAttendanceRecord.check_in_at)
        )
        result = await self._session.execute(stmt)
        return [
            (self._to_domain(record), record.user, record.recorder)
            for record in result.scalars().all()
        ]

    async def count_by_meeting(self, meeting_date: date) -> int:
        """Count attendance records for a single meeting."""
        stmt = select(func.count(WeeklyAttendanceRecord.id)).where(
            WeeklyAttendanceRecord.meeting_date == meeting_date
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def count_attended_by_meeting(self, meeting_date: date) -> int:
        """Count records that count as attended (PRESENT + LATE, BR-3)."""
        stmt = select(func.count(WeeklyAttendanceRecord.id)).where(
            and_(
                WeeklyAttendanceRecord.meeting_date == meeting_date,
                WeeklyAttendanceRecord.status.in_(ATTENDED_STATUSES),
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def counts_attended_by_meeting(self, dates: list[date]) -> dict[date, int]:
        """Attended (PRESENT + LATE) record count per meeting, one query.

        Meetings without records are simply missing from the mapping.
        """
        if not dates:
            return {}
        stmt = (
            select(WeeklyAttendanceRecord.meeting_date, func.count(WeeklyAttendanceRecord.id))
            .where(
                and_(
                    WeeklyAttendanceRecord.meeting_date.in_(dates),
                    WeeklyAttendanceRecord.status.in_(ATTENDED_STATUSES),
                )
            )
            .group_by(WeeklyAttendanceRecord.meeting_date)
        )
        result = await self._session.execute(stmt)
        return {row[0]: int(row[1]) for row in result.all()}

    async def counts_by_meeting_and_status(self, dates: list[date]) -> dict[date, dict[str, int]]:
        """Record count per meeting per status value, as one grouped query.

        Returns ``{meeting_date: {"PRESENT": n, "LATE": n, ...}}``; a
        status with no rows for a meeting is absent from the inner dict.
        """
        if not dates:
            return {}
        stmt = (
            select(
                WeeklyAttendanceRecord.meeting_date,
                WeeklyAttendanceRecord.status,
                func.count(WeeklyAttendanceRecord.id),
            )
            .where(WeeklyAttendanceRecord.meeting_date.in_(dates))
            .group_by(WeeklyAttendanceRecord.meeting_date, WeeklyAttendanceRecord.status)
        )
        result = await self._session.execute(stmt)
        grouped: dict[date, dict[str, int]] = {}
        for meeting, status_value, count in result.all():
            grouped.setdefault(meeting, {})[str(status_value)] = int(count)
        return grouped

    async def count_by_meeting_and_status(
        self, meeting_date: date, status: AttendanceStatus
    ) -> int:
        """Count attendance records for a meeting filtered by status."""
        stmt = select(func.count(WeeklyAttendanceRecord.id)).where(
            and_(
                WeeklyAttendanceRecord.meeting_date == meeting_date,
                WeeklyAttendanceRecord.status == status.value,
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def counts_by_meeting(self, start_date: date, end_date: date) -> dict[date, int]:
        """Attendance count per meeting in a range, as one grouped query.

        Used by the monthly analysis so a month of meetings costs a
        single round trip instead of one query per meeting.
        """
        stmt = (
            select(
                WeeklyAttendanceRecord.meeting_date,
                func.count(WeeklyAttendanceRecord.id),
            )
            .where(
                and_(
                    WeeklyAttendanceRecord.meeting_date >= start_date,
                    WeeklyAttendanceRecord.meeting_date <= end_date,
                )
            )
            .group_by(WeeklyAttendanceRecord.meeting_date)
            .order_by(WeeklyAttendanceRecord.meeting_date)
        )
        result = await self._session.execute(stmt)
        return {row[0]: int(row[1]) for row in result.all()}

    async def count_by_user_between(
        self, user_id: uuid.UUID, start_date: date, end_date: date
    ) -> int:
        """How many meetings a user attended within a date range.

        Only attended statuses (PRESENT / LATE) count (BR-3).
        """
        stmt = select(func.count(WeeklyAttendanceRecord.id)).where(
            and_(
                WeeklyAttendanceRecord.user_id == user_id,
                WeeklyAttendanceRecord.meeting_date >= start_date,
                WeeklyAttendanceRecord.meeting_date <= end_date,
                WeeklyAttendanceRecord.status.in_(ATTENDED_STATUSES),
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def count_distinct_attendees_between(self, start_date: date, end_date: date) -> int:
        """Number of distinct users who attended at least one meeting."""
        stmt = select(func.count(func.distinct(WeeklyAttendanceRecord.user_id))).where(
            and_(
                WeeklyAttendanceRecord.meeting_date >= start_date,
                WeeklyAttendanceRecord.meeting_date <= end_date,
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def counts_by_user_between(
        self, start_date: date, end_date: date
    ) -> dict[uuid.UUID, int]:
        """Meetings attended per user within a range, as one grouped query.

        Only attended statuses (PRESENT / LATE) count (BR-3).
        """
        stmt = (
            select(
                WeeklyAttendanceRecord.user_id,
                func.count(WeeklyAttendanceRecord.id),
            )
            .where(
                and_(
                    WeeklyAttendanceRecord.meeting_date >= start_date,
                    WeeklyAttendanceRecord.meeting_date <= end_date,
                    WeeklyAttendanceRecord.status.in_(ATTENDED_STATUSES),
                )
            )
            .group_by(WeeklyAttendanceRecord.user_id)
        )
        result = await self._session.execute(stmt)
        return {row[0]: int(row[1]) for row in result.all()}

    def _to_domain(self, db_record: WeeklyAttendanceRecord) -> Attendance:
        """Convert database model to domain entity."""
        return Attendance(
            id=db_record.id,
            user_id=db_record.user_id,
            meeting_date=db_record.meeting_date,
            check_in_at=db_record.check_in_at,
            status=AttendanceStatus(db_record.status),
            recorded_by=db_record.recorded_by,
            created_at=db_record.created_at,
            updated_at=db_record.updated_at,
            method=AttendanceMethod(db_record.method),
        )
