"""The shared vocabulary of the members.

Every module needs to know the role and the status of a member, and the
``users`` module imports two other modules itself. The enumerations
therefore live in the shared kernel (ARCH-002): the concrete ORM model
stays inside the ``users`` module.
"""

from enum import StrEnum


class RoleName(StrEnum):
    MEMBER = "MEMBER"
    SERVANT = "SERVANT"
    ADMIN = "ADMIN"


class UserStatus(StrEnum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    BANNED = "BANNED"
    INACTIVE = "INACTIVE"
