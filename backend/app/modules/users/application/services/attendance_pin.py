"""The member-chosen attendance PIN (offline check-in fallback).

A PIN is five digits, chosen freely by the member in their profile and
stored only as a peppered SHA-256 hash. The hash is *deterministic* on
purpose: the check-in screen submits nothing but the PIN, so the server
must be able to look the account up by the typed value. Global
uniqueness of the stored hash is what makes that lookup unambiguous.

The pepper is derived from the existing JWT secret so no additional
environment variable is needed; a database leak alone therefore cannot
be replayed against other systems where members reuse PINs.
"""

import hashlib
import re

from app.config import settings
from app.core.exceptions.errors import ValidationError

PIN_LENGTH = 5
PIN_PATTERN = re.compile(rf"^[0-9]{{{PIN_LENGTH}}}$")

PIN_TAKEN_MESSAGE = "This PIN is already used by another member. Please choose a different one."
PIN_UNKNOWN_MESSAGE = "No member is registered with this PIN"


def validate_pin_format(pin: str) -> None:
    """Reject anything that is not exactly five digits.

    Raises:
        ValidationError: If ``pin`` is not ``NNNNN``.
    """
    if not PIN_PATTERN.fullmatch(pin):
        raise ValidationError(f"The attendance PIN must be exactly {PIN_LENGTH} digits")


def hash_attendance_pin(pin: str) -> str:
    """Deterministic peppered hash used for storage and lookup."""
    validate_pin_format(pin)
    pepper = hashlib.sha256(f"attendance-pin:{settings.JWT_SECRET}".encode()).hexdigest()
    return hashlib.sha256(f"{pepper}:{pin}".encode()).hexdigest()
