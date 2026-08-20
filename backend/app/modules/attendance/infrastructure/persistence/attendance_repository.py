import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.attendance.infrastructure.persistence.models import AttendanceRecord


class AttendanceRepository:
    """Attendance records + analytics derived from plain SQL queries."""

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

    async def count_today(self) -> int:
        return await self.count_between(date.today(), date.today())

    async def count_this_week(self, today: date) -> int:
        monday = today - timedelta(days=today.weekday())
        return await self.count_between(monday, today)

    async def count_this_month(self, today: date) -> int:
        first = today.replace(day=1)
        return await self.count_between(first, today)

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

    async def daily_trend(self, start: date, end: date) -> list[tuple[date, int]]:
        result = await self._session.execute(
            select(AttendanceRecord.attendance_date, func.count(AttendanceRecord.id))
            .where(
                AttendanceRecord.attendance_date >= start, AttendanceRecord.attendance_date <= end
            )
            .group_by(AttendanceRecord.attendance_date)
            .order_by(AttendanceRecord.attendance_date)
        )
        return [(row[0], int(row[1])) for row in result.all()]
