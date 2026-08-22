"""Unit tests for the platform clock (TASK-701 #4)."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.core.time import clock


def test_platform_timezone_defaults_to_cairo():
    assert str(clock.platform_timezone()) == "Africa/Cairo"


def test_now_utc_is_aware():
    now = clock.now_utc()
    assert now.tzinfo is UTC


def test_now_local_matches_platform_zone():
    cairo = ZoneInfo("Africa/Cairo")
    local = clock.now_local()
    assert local.utcoffset() == datetime.now(cairo).utcoffset()


def test_today_local_follows_local_calendar():
    # 23:30 Cairo on a Wednesday is already Thursday 00:30+ in UTC? No —
    # Cairo is UTC+3 in 2026 (DST), so 23:30 Cairo is 20:30 UTC the same
    # day. The boundary that matters: just after local midnight, the
    # local date must roll over even though UTC has not.
    fake_local = datetime(2026, 8, 27, 0, 30, tzinfo=ZoneInfo("Africa/Cairo"))
    fake_utc = fake_local.astimezone(UTC)
    assert fake_utc.date() == date(2026, 8, 26)  # still Tuesday/Wednesday in UTC

    original = clock.now_utc
    try:
        clock.now_utc = lambda: fake_utc  # type: ignore[assignment]
        assert clock.today_local() == date(2026, 8, 27)
    finally:
        clock.now_utc = original  # type: ignore[assignment]


def test_to_local_converts_aware_utc_value():
    value = datetime(2026, 8, 20, 17, 0, tzinfo=UTC)  # 20:00 Cairo (UTC+3)
    local = clock.to_local(value)
    assert local.hour == 20
    assert local.date() == date(2026, 8, 20)


def test_to_local_treats_naive_as_utc():
    naive = datetime(2026, 8, 20, 17, 0)
    aware = clock.to_local(naive)
    assert aware.tzinfo is not None
    assert aware.hour == 20


@pytest.mark.parametrize(
    ("hhmm", "expected"),
    [("19:00", (19, 0)), ("00:00", (0, 0)), ("23:59", (23, 59))],
)
def test_local_datetime_valid(hhmm: str, expected: tuple[int, int]):
    result = clock.local_datetime(date(2026, 8, 20), hhmm)
    assert (result.hour, result.minute) == expected
    assert result.tzinfo is clock.platform_timezone()


@pytest.mark.parametrize("hhmm", ["19", "19:5", "24:00", "12:60", "ab:cd", "1900", ""])
def test_local_datetime_rejects_malformed(hhmm: str):
    with pytest.raises(ValueError, match="HH:MM"):
        clock.local_datetime(date(2026, 8, 20), hhmm)
