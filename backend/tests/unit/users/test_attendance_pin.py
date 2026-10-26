"""Unit tests for the attendance PIN hashing helper."""

import pytest
from _pytest.monkeypatch import MonkeyPatch

from app.config import settings
from app.core.exceptions.errors import ValidationError
from app.modules.users.application.services.attendance_pin import (
    hash_attendance_pin,
    validate_pin_format,
)


@pytest.fixture(autouse=True)
def _stable_secret(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "JWT_SECRET", "test-secret")
    monkeypatch.setattr(settings, "ATTENDANCE_PIN_PEPPER", "test-attendance-pepper")


def test_five_digits_are_accepted():
    validate_pin_format("00000")
    validate_pin_format("98765")


@pytest.mark.parametrize("bad", ["1234", "123456", "12a45", "", "12 45", "١٢٣٤٥"])
def test_malformed_pins_are_rejected(bad: str):
    with pytest.raises(ValidationError):
        validate_pin_format(bad)


@pytest.fixture()
def _baseline_hash() -> str:
    return hash_attendance_pin("42424")


def test_hash_is_deterministic_and_peppered(_baseline_hash: str):
    assert _baseline_hash == hash_attendance_pin("42424")
    assert _baseline_hash != hash_attendance_pin("42425")

    # The dedicated pepper drives the hash: changing it invalidates every PIN.
    with MonkeyPatch().context() as mp:
        mp.setattr(settings, "ATTENDANCE_PIN_PEPPER", "other-pepper")
        assert hash_attendance_pin("42424") != _baseline_hash


def test_dedicated_pepper_decouples_the_pin_from_the_jwt_secret(_baseline_hash: str):
    """Rotating JWT_SECRET must not invalidate the members' attendance PINs."""
    with MonkeyPatch().context() as mp:
        mp.setattr(settings, "JWT_SECRET", "rotated-jwt-secret")
        assert hash_attendance_pin("42424") == _baseline_hash


def test_legacy_fallback_pepper_follows_the_jwt_secret(monkeypatch: MonkeyPatch):
    """Without a dedicated pepper the legacy fallback is derived from JWT_SECRET."""
    monkeypatch.setattr(settings, "ATTENDANCE_PIN_PEPPER", "")
    legacy = hash_attendance_pin("42424")
    monkeypatch.setattr(settings, "JWT_SECRET", "rotated-jwt-secret")
    assert hash_attendance_pin("42424") != legacy


def test_hash_is_hex_sha256_length():
    digest = hash_attendance_pin("42424")
    assert len(digest) == 64
    int(digest, 16)
