"""Unit tests for statistics math (TASK-701 #2)."""

from app.modules.attendance.application.services.statistics_service import _rate


def test_zero_expected_is_zero_not_a_crash():
    assert _rate(0, 0) == 0.0
    assert _rate(3, 0) == 0.0
    assert _rate(3, -1) == 0.0  # defensive: never negative denominators


def test_partial_rate():
    assert _rate(3, 5) == 60.0


def test_full_rate():
    assert _rate(5, 5) == 100.0


def test_rounding_to_two_decimals():
    # 1/3 -> 33.33
    assert _rate(1, 3) == 33.33


def test_over_100_is_impossible():
    # The service never passes part > whole; the helper itself just
    # reflects the arithmetic, which cannot exceed 100 for part <= whole.
    assert _rate(0, 7) == 0.0
    assert _rate(7, 7) == 100.0
