"""Domain events for the attendance module."""

import uuid
from dataclasses import dataclass
from datetime import date
from typing import ClassVar

from app.shared.domain.events import DomainEvent


@dataclass(frozen=True, slots=True)
class AttendanceRecorded(DomainEvent):
    """A weekly meeting attendance record was written (BR-8)."""

    event_type: ClassVar[str] = "attendance.recorded"
    aggregate_type: ClassVar[str] = "attendance_record"

    user_id: uuid.UUID
    meeting_date: date
    status: str
    method: str
    recorded_by: uuid.UUID


@dataclass(frozen=True, slots=True)
class AttendanceExcused(DomainEvent):
    """An attendance record was corrected to EXCUSED (BR-6)."""

    event_type: ClassVar[str] = "attendance.excused"
    aggregate_type: ClassVar[str] = "attendance_record"

    user_id: uuid.UUID
    meeting_date: date
    previous_status: str
    reason: str | None
    excused_by: uuid.UUID
