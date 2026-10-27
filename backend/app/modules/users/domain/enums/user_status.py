"""The status of a member - now a shared contract (ARCH-002).

The definition lives in ``app/shared/contracts/users.py`` because every
module needs it. This module keeps the old import path working; the
object is the same one.
"""

from app.shared.contracts.users import UserStatus

__all__ = ["UserStatus"]
