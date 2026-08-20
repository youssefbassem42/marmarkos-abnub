"""SQLAlchemy ORM models for the attendance module.

Attendance is immutable: a scan record is never edited after creation.
``attendance_date`` is a denormalized copy of the session date so weekly
and monthly analytics queries never need to join ``service_sessions``.
"""

import uuid
from datetime import date, datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.attendance.domain.enums.attendance import (
    AttendanceMethod,
    ServiceType,
)
from app.shared.infrastructure.persistence.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.modules.users.infrastructure.persistence.models import User


class ServiceSession(UUIDPrimaryKeyMixin, Base):
    """A church service or meeting users can attend (e.g. Sunday service).

    Separate from attendance records so multiple sessions per day and
    different service types (youth meeting, camp, conference) are
    supported without schema changes.
    """

    __tablename__ = "service_sessions"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time(timezone=False))
    end_time: Mapped[time | None] = mapped_column(Time(timezone=False))
    service_type: Mapped[ServiceType] = mapped_column(
        SAEnum(ServiceType, name="service_type", native_enum=False, length=40),
        default=ServiceType.SUNDAY_SERVICE,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="session")


class AttendanceRecord(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        # A user cannot be recorded twice for the same session.
        Index("uq_attendance_user_session", "user_id", "session_id", unique=True),
        # Absence analytics: "users with no attendance since week N".
        Index("ix_attendance_user_date", "user_id", "attendance_date"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_sessions.id", ondelete="CASCADE"), nullable=False
    )
    # Denormalized copy of session.date for cheap analytics.
    attendance_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    scanned_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    method: Mapped[AttendanceMethod] = mapped_column(
        SAEnum(AttendanceMethod, name="attendance_method", native_enum=False, length=20),
        default=AttendanceMethod.QR_SCAN,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="attendance_records", foreign_keys=[user_id])
    session: Mapped[ServiceSession] = relationship(back_populates="attendance_records")
    scanner: Mapped["User | None"] = relationship(foreign_keys=[scanned_by])
