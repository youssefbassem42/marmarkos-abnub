"""The attendance status - now a shared contract (ARCH-001).

The definition lives in ``app/shared/contracts/attendance.py`` because
the notifications module speaks it too. This module keeps the old
import path working; the object is the same one.
"""

from app.shared.contracts.attendance import ATTENDED_STATUSES, AttendanceStatus

__all__ = ["ATTENDED_STATUSES", "AttendanceStatus"]
