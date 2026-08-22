"""Attendance status enumeration."""

from enum import StrEnum


class AttendanceStatus(StrEnum):
    """The status of an attendance record.

    PRESENT: User checked in on time (at or before start + grace, BR-2)
    LATE:   User checked in after the late grace period (BR-2); still
            counts as attended (BR-3)
    ABSENT: User is marked as absent for the meeting
    EXCUSED: User has a valid excuse for absence
    """

    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"
    EXCUSED = "EXCUSED"


#: Statuses that count as attended: a late member is never counted as
#: absent and never deflates the attendance rate (BR-3).
ATTENDED_STATUSES: frozenset[AttendanceStatus] = frozenset(
    {AttendanceStatus.PRESENT, AttendanceStatus.LATE}
)
