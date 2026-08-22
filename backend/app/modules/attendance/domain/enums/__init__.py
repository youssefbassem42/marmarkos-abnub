"""Attendance domain enumerations."""

from app.modules.attendance.domain.enums.attendance import AttendanceMethod, ServiceType
from app.modules.attendance.domain.enums.attendance_status import (
    ATTENDED_STATUSES,
    AttendanceStatus,
)

__all__ = ["ATTENDED_STATUSES", "AttendanceMethod", "AttendanceStatus", "ServiceType"]
