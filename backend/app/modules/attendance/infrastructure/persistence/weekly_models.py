"""SQLAlchemy model for weekly meeting attendance.

Attendance is recorded per weekly meeting (Thursday), not per calendar
day: one row per user per meeting. Service sessions and classes will be
integrated in later phases.
"""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.attendance.domain.enums import AttendanceMethod, AttendanceStatus
from app.shared.infrastructure.persistence.base import Base, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.modules.users.infrastructure.persistence.models import User


class WeeklyAttendanceRecord(UUIDPrimaryKeyMixin, Base):
    """Attendance record for one user at one weekly meeting.

    Business rules enforced:
    - One record per user per meeting (unique constraint on
      user_id + meeting_date), so attendance can never be taken twice
    - ``meeting_date`` always holds the meeting day (Thursday), while
      ``check_in_at`` holds the real scan timestamp
    - ``status`` is PRESENT or LATE for attended scans (LATE = after the
      late grace period), ABSENT / EXCUSED are correction states; both
      CHECK constraints below mirror the domain enums
    - Immutable after creation (attendance is never edited, only marked)
    - Records which admin performed the scan for audit purposes
    """

    __tablename__ = "weekly_attendance_records"
    __table_args__ = (
        Index("uq_weekly_attendance_user_meeting", "user_id", "meeting_date", unique=True),
        Index("ix_weekly_attendance_user_id", "user_id"),
        Index("ix_weekly_attendance_meeting_date", "meeting_date"),
        Index("ix_weekly_attendance_status", "status"),
        Index("ix_weekly_attendance_meeting_check_in", "meeting_date", "check_in_at"),
        CheckConstraint(
            "status IN ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED')",
            name="ck_weekly_attendance_status",
        ),
        CheckConstraint(
            "method IN ('QR_SCAN', 'MANUAL')",
            name="ck_weekly_attendance_method",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    meeting_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AttendanceStatus] = mapped_column(
        SAEnum(AttendanceStatus, name="attendance_status", native_enum=False, length=20),
        nullable=False,
        default=AttendanceStatus.PRESENT,
    )
    method: Mapped[AttendanceMethod] = mapped_column(
        SAEnum(AttendanceMethod, name="attendance_method", native_enum=False, length=20),
        nullable=False,
        default=AttendanceMethod.QR_SCAN,
    )
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(
        foreign_keys=[user_id], back_populates="weekly_attendance_records"
    )
    recorder: Mapped["User"] = relationship(foreign_keys=[recorded_by])
