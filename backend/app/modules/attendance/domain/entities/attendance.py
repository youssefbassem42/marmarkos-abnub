"""Attendance domain entity."""

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime

from app.modules.attendance.domain.enums import (
    ATTENDED_STATUSES,
    AttendanceMethod,
    AttendanceStatus,
)
from app.modules.attendance.domain.meeting_schedule import (
    is_meeting_date,
    meeting_index_in_month,
)


@dataclass
class Attendance:
    """Domain entity representing a user's attendance at a weekly meeting.

    Business Rules:
    - Attendance is per weekly meeting (Thursday), not per calendar day
    - A user can only have one attendance record per meeting
    - Attendance is recorded by an authorized administrator
    - Once created, an attendance record captures the moment of check-in
    - ``meeting_date`` is separate from ``check_in_at`` so a scan made
      later in the meeting week still reports against the right meeting
    - ``method`` records how the check-in was captured (QR scan or
      manual code entry)
    """

    id: uuid.UUID
    user_id: uuid.UUID
    meeting_date: date
    check_in_at: datetime
    status: AttendanceStatus
    recorded_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    method: AttendanceMethod = field(default=AttendanceMethod.QR_SCAN)

    @property
    def is_present(self) -> bool:
        """Check if the user is marked as present."""
        return self.status == AttendanceStatus.PRESENT

    @property
    def is_late(self) -> bool:
        """Check if the user checked in after the late grace period."""
        return self.status == AttendanceStatus.LATE

    @property
    def is_attended(self) -> bool:
        """Check if the record counts as attended (present or late, BR-3)."""
        return self.status in ATTENDED_STATUSES

    @property
    def is_absent(self) -> bool:
        """Check if the user is marked as absent."""
        return self.status == AttendanceStatus.ABSENT

    @property
    def is_excused(self) -> bool:
        """Check if the absence is excused."""
        return self.status == AttendanceStatus.EXCUSED

    @property
    def is_on_meeting_day(self) -> bool:
        """Whether ``meeting_date`` falls on the weekly meeting day."""
        return is_meeting_date(self.meeting_date)

    @property
    def meeting_index_in_month(self) -> int:
        """1-based position of this meeting within its month (1..5)."""
        return meeting_index_in_month(self.meeting_date)
