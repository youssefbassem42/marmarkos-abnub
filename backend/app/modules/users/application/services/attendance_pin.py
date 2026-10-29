"""The member-chosen attendance PIN (offline check-in fallback).

A PIN is five digits, chosen freely by the member in their profile and
stored only as a peppered SHA-256 hash. The hash is *deterministic* on
purpose: the check-in screen submits nothing but the PIN, so the server
must be able to look the account up by the typed value. Global
uniqueness of the stored hash is what makes that lookup unambiguous.

The pepper is taken from ``settings.ATTENDANCE_PIN_PEPPER`` when set,
giving it an independent rotation lifecycle from JWT tokens.  When
the dedicated pepper is empty (legacy / unset deployments) the system
falls back to a derivative of ``settings.JWT_SECRET`` to preserve
backwards compatibility — but the fallback emits a warning, and
deployments should set ``ATTENDANCE_PIN_PEPPER`` explicitly.

**The rotation of the pepper (SEC-006).** A deployment that adopts a
dedicated pepper for the first time stores a hash the members have never
seen. The hashes written by the legacy scheme (a derivative of
``JWT_SECRET``) are therefore still in the table. This module keeps the
old scheme **readable**: ``attendance_pin_hash_candidates`` returns the
hashes a typed PIN may be stored under (the current one and the legacy
one), and the check-in re-hashes the member's PIN with the current pepper
the first time he uses it. The members keep their PINs, the stored hashes
migrate by themselves, and the pepper becomes independent of the JWT
secret without a migration script and without a member action.
"""

import hashlib
import logging
import re

from app.config import settings
from app.core.exceptions.errors import ValidationError

logger = logging.getLogger(__name__)

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


def _peppered_hash(raw_pepper: str, pin: str) -> str:
    """The hash of a PIN under one pepper material (the shape of both schemes)."""
    pepper = hashlib.sha256(f"attendance-pin:{raw_pepper}".encode()).hexdigest()
    return hashlib.sha256(f"{pepper}:{pin}".encode()).hexdigest()


def legacy_pepper_material() -> str:
    """The pepper material of the legacy scheme: a derivative of the JWT secret.

    The legacy deployment had no dedicated pepper, so the hashes in the
    table were computed with this material. It is recomputed from the
    running configuration on every call, which is what lets a deployment
    recognise the old hashes without a migration script.
    """
    return hashlib.sha256(f"attendance-pin:{settings.JWT_SECRET}".encode()).hexdigest()


def hash_attendance_pin(pin: str) -> str:
    """Deterministic peppered hash used for storage and lookup.

    The pepper is taken from ``settings.ATTENDANCE_PIN_PEPPER`` when set,
    giving it an independent rotation lifecycle from JWT tokens.  When
    the dedicated pepper is empty (legacy / unset deployments) the system
    falls back to a derivative of ``settings.JWT_SECRET`` to preserve
    backwards compatibility — but the fallback emits a warning, and
    deployments should set ``ATTENDANCE_PIN_PEPPER`` explicitly.
    """
    validate_pin_format(pin)
    raw_pepper = settings.ATTENDANCE_PIN_PEPPER.strip()
    if not raw_pepper:
        logger.warning(
            "ATTENDANCE_PIN_PEPPER is not set; falling back to a JWT_SECRET derivative. "
            "Set a dedicated ATTENDANCE_PIN_PEPPER so PIN hashes survive JWT rotation."
        )
        raw_pepper = legacy_pepper_material()
    return _peppered_hash(raw_pepper, pin)


def legacy_hash_attendance_pin(pin: str) -> str:
    """The hash the legacy scheme (no dedicated pepper) would have written.

    It is the hash of every PIN that was stored before the deployment
    adopted a dedicated pepper. It is only ever used to **recognise** a
    member and to re-hash his PIN with the current pepper.
    """
    validate_pin_format(pin)
    return _peppered_hash(legacy_pepper_material(), pin)


def attendance_pin_hash_candidates(pin: str) -> list[str]:
    """Every hash a typed PIN may be stored under, the current one first.

    The list has one entry when the deployment still uses the legacy
    scheme (no dedicated pepper) and two entries after the adoption: the
    current hash and the legacy one. The lookup uses all of them, so a
    member whose PIN was hashed by the old scheme is still found — and the
    caller re-hashes it, which migrates the stored hash by itself.
    """
    validate_pin_format(pin)
    current = hash_attendance_pin(pin)
    legacy = legacy_hash_attendance_pin(pin)
    if current == legacy:
        return [current]
    return [current, legacy]
