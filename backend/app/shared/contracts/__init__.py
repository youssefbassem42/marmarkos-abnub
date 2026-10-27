"""The vocabulary that more than one module speaks (ARCH-001/002).

Two modules that import each other cannot be tested, extracted or
replaced on their own. Most of the time the reason is a handful of
enumerations that both sides need: the status of an attendance record,
the lifecycle of a quiz attempt, the role of a member.

Those enumerations live here now. The modules keep their old import
paths - the files under ``app/modules/*/domain/enums/`` re-export the
names - so no call site had to change and the identity of every
enumeration is unchanged (``AttendanceStatus.PRESENT`` is still the
same object everywhere).
"""

from app.shared.contracts.attendance import ATTENDED_STATUSES, AttendanceStatus
from app.shared.contracts.quiz import AttemptStatus, QuizStatus
from app.shared.contracts.users import RoleName, UserStatus

__all__ = [
    "ATTENDED_STATUSES",
    "AttemptStatus",
    "AttendanceStatus",
    "QuizStatus",
    "RoleName",
    "UserStatus",
]
