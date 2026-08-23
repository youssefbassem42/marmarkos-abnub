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

    with MonkeyPatch().context() as mp:
        mp.setattr(settings, "JWT_SECRET", "other-secret")
        assert hash_attendance_pin("42424") != _baseline_hash


def test_hash_is_hex_sha256_length():
    digest = hash_attendance_pin("42424")
    assert len(digest) == 64
    int(digest, 16)
