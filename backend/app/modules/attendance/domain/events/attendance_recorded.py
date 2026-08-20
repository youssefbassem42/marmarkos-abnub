"""Domain events for the attendance module."""

import uuid
from dataclasses import dataclass
from datetime import date
from typing import ClassVar

from app.shared.domain.events import DomainEvent


@dataclass(frozen=True, slots=True)
class AttendanceRecorded(DomainEvent):
    event_type: ClassVar[str] = "attendance.recorded"
    aggregate_type: ClassVar[str] = "attendance_record"

    session_id: uuid.UUID
    attendance_date: date
    method: str
    scanned_by: uuid.UUID | None = None
