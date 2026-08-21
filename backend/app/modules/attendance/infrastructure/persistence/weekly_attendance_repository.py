"""Repository implementation for weekly meeting attendance records."""

import uuid
from datetime import date

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.attendance.domain.entities import Attendance
from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.attendance.infrastructure.persistence.weekly_models import (
    WeeklyAttendanceRecord,
)
from app.modules.users.infrastructure.persistence.models import User


class WeeklyAttendanceRepository:
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
            status=attendance.status.value,
            recorded_by=attendance.recorded_by,
            created_at=attendance.created_at,
            updated_at=attendance.updated_at,
        )
        self._session.add(db_record)
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

    async def find_by_meeting_range(
        self, start_date: date, end_date: date
    ) -> list[Attendance]:
        """Retrieve attendance records for every meeting in a date range."""
        stmt = (
            select(WeeklyAttendanceRecord)
            .where(
                and_(
                    WeeklyAttendanceRecord.meeting_date >= start_date,
                    WeeklyAttendanceRecord.meeting_date <= end_date,
                )
            )
            .order_by(
                WeeklyAttendanceRecord.meeting_date, WeeklyAttendanceRecord.check_in_at
            )
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

    async def find_users_by_meeting(self, meeting_date: date) -> list[tuple[Attendance, User]]:
        """Attendance records for a meeting together with their user.

        Eager-loads the user relationship so callers do not issue one
        query per record when building DTOs.
        """
        stmt = (
            select(WeeklyAttendanceRecord)
            .options(selectinload(WeeklyAttendanceRecord.user))
            .where(WeeklyAttendanceRecord.meeting_date == meeting_date)
            .order_by(WeeklyAttendanceRecord.check_in_at)
        )
        result = await self._session.execute(stmt)
        return [(self._to_domain(record), record.user) for record in result.scalars().all()]

    async def count_by_meeting(self, meeting_date: date) -> int:
        """Count attendance records for a single meeting."""
        stmt = select(func.count(WeeklyAttendanceRecord.id)).where(
            WeeklyAttendanceRecord.meeting_date == meeting_date
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

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

    async def counts_by_meeting(
        self, start_date: date, end_date: date
    ) -> dict[date, int]:
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
        """How many meetings a user attended within a date range."""
        stmt = select(func.count(WeeklyAttendanceRecord.id)).where(
            and_(
                WeeklyAttendanceRecord.user_id == user_id,
                WeeklyAttendanceRecord.meeting_date >= start_date,
                WeeklyAttendanceRecord.meeting_date <= end_date,
            )
        )
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def count_distinct_attendees_between(
        self, start_date: date, end_date: date
    ) -> int:
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
        """Meetings attended per user within a range, as one grouped query."""
        stmt = (
            select(
                WeeklyAttendanceRecord.user_id,
                func.count(WeeklyAttendanceRecord.id),
            )
            .where(
                and_(
                    WeeklyAttendanceRecord.meeting_date >= start_date,
                    WeeklyAttendanceRecord.meeting_date <= end_date,
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
        )
