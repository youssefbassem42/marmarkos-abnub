"""Attendance status enumeration."""

from enum import StrEnum


class AttendanceStatus(StrEnum):
    """The status of an attendance record.
    
    PRESENT: User has successfully checked in
    ABSENT: User is marked as absent for the day
    EXCUSED: User has a valid excuse for absence
    """
    
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    EXCUSED = "EXCUSED"
