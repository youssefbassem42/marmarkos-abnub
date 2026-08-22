"""Unit tests for the LATE derivation rule (TASK-701 #1, BR-2)."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.modules.attendance.application.commands.check_in_command import (
    derive_check_in_status,
)
from app.modules.attendance.domain.enums import AttendanceStatus

CAIRO = ZoneInfo("Africa/Cairo")
MEETING = date(2026, 8, 20)  # a Thursday


def _local(hour: int, minute: int) -> datetime:
    return datetime(2026, 8, 20, hour, minute, tzinfo=CAIRO)


def test_on_time_scan_is_present():
    # Start is 19:00; scanning at 18:59 is on time.
    assert derive_check_in_status(_local(18, 59), MEETING) is AttendanceStatus.PRESENT


def test_exactly_at_grace_boundary_is_present():
    # 19:00 + 15 minutes grace = 19:15. The boundary itself counts as on time.
    assert derive_check_in_status(_local(19, 15), MEETING) is AttendanceStatus.PRESENT


def test_one_minute_past_grace_is_late():
    assert derive_check_in_status(_local(19, 16), MEETING) is AttendanceStatus.LATE


def test_utc_timestamp_is_compared_in_platform_zone():
    # 19:16 Cairo == 16:16 UTC in August (UTC+3): still LATE when the
    # stored value arrives as an aware UTC timestamp.
    utc_value = datetime(2026, 8, 20, 16, 16, tzinfo=UTC)
    assert derive_check_in_status(utc_value, MEETING) is AttendanceStatus.LATE

    utc_early = datetime(2026, 8, 20, 16, 0, tzinfo=UTC)  # 19:00 Cairo
    assert derive_check_in_status(utc_early, MEETING) is AttendanceStatus.PRESENT


def test_scan_on_a_later_weekday_of_the_same_week_is_always_late():
    # Saturday belongs to Thursday's meeting; by then the meeting ended.
    saturday = datetime(2026, 8, 22, 10, 24, tzinfo=CAIRO)
    assert derive_check_in_status(saturday, MEETING) is AttendanceStatus.LATE


def test_naive_timestamp_is_interpreted_as_utc():
    naive = datetime(2026, 8, 20, 19, 30)  # naive "UTC" 19:30 = 22:30 Cairo
    assert derive_check_in_status(naive, MEETING) is AttendanceStatus.LATE


def test_next_meeting_date_gets_a_fresh_window():
    next_thursday = MEETING + timedelta(days=7)
    assert (
        derive_check_in_status(datetime(2026, 8, 27, 19, 10, tzinfo=CAIRO), next_thursday)
        is AttendanceStatus.PRESENT
    )
