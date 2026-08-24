"""Domain enums for the auth module."""

from enum import Enum


class AuthTokenPurpose(str, Enum):
    """What a single-use ``auth_tokens`` row was issued for.

    Both purposes share one table because the lifecycle is identical:
    issue → email link → consume (or expire). Keeping them together makes
    "invalidate every pending link for this user" one query per purpose.
    """

    EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
    PASSWORD_RESET = "PASSWORD_RESET"
