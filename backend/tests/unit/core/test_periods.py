"""Unit tests for the ISO period helpers (P5-001, D-5).

Cairo has been DST-free since 2023 and sits at UTC+2 in winter /
UTC+3 in summer; the window functions must therefore produce exact
UTC boundaries around local midnight.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.time.periods import (
    iso_week_end,
    iso_week_start,
    last_n_months,
    month_bounds,
    month_start,
    month_window_utc,
    week_window_utc,
)

CAIRO = ZoneInfo("Africa/Cairo")


def test_iso_week_start_is_monday() -> None:
    # Wednesday 2026-08-26 belongs to ISO week starting Monday 2026-08-24.
    assert iso_week_start(date(2026, 8, 26)) == date(2026, 8, 24)
    # A Monday maps to itself.
    assert iso_week_start(date(2026, 8, 24)) == date(2026, 8, 24)


def test_iso_week_start_year_rollover() -> None:
    # 2027-01-01 is a Friday: its ISO week starts Monday 2026-12-28.
    assert iso_week_start(date(2027, 1, 1)) == date(2026, 12, 28)
    assert iso_week_start(date(2026, 12, 31)).isoformat() == "2026-12-28"


def test_iso_week_end_is_sunday() -> None:
    assert iso_week_end(date(2026, 8, 26)) == date(2026, 8, 30)
    assert iso_week_end(date(2026, 8, 30)) == date(2026, 8, 30)


def test_month_start() -> None:
    assert month_start(date(2026, 8, 26)) == date(2026, 8, 1)
    assert month_start(date(2026, 1, 31)) == date(2026, 1, 1)


def test_month_bounds_including_leap_february() -> None:
    assert month_bounds(2026, 2) == (date(2026, 2, 1), date(2026, 2, 28))
    assert month_bounds(2028, 2) == (date(2028, 2, 1), date(2028, 2, 29))
    assert month_bounds(2026, 12) == (date(2026, 12, 1), date(2026, 12, 31))
    assert month_bounds(2026, 4) == (date(2026, 4, 1), date(2026, 4, 30))


def test_week_window_utc_winter_cairo_utc_plus_two() -> None:
    start, end = week_window_utc(date(2026, 1, 14))  # Wednesday
    # Local Mon 00:00 Cairo == Sun 22:00 UTC (UTC+2, DST-free).
    assert start == datetime(2026, 1, 11, 22, 0, tzinfo=ZoneInfo("UTC"))
    assert end == datetime(2026, 1, 18, 22, 0, tzinfo=ZoneInfo("UTC"))
    assert start.astimezone(CAIRO).date() == date(2026, 1, 12)


def test_week_window_utc_summer_cairo_utc_plus_three() -> None:
    start, _ = week_window_utc(date(2026, 8, 26))
    assert start == datetime(2026, 8, 23, 21, 0, tzinfo=ZoneInfo("UTC"))
    _, end = week_window_utc(date(2026, 8, 26))
    assert end == datetime(2026, 8, 30, 21, 0, tzinfo=ZoneInfo("UTC"))


def test_month_window_utc_crosses_dst_free_offsets() -> None:
    start, end = month_window_utc(2026, 8)
    assert start == datetime(2026, 7, 31, 21, 0, tzinfo=ZoneInfo("UTC"))
    assert end == datetime(2026, 8, 31, 21, 0, tzinfo=ZoneInfo("UTC"))


def test_month_window_utc_december() -> None:
    start, end = month_window_utc(2025, 12)
    assert start == datetime(2025, 11, 30, 22, 0, tzinfo=ZoneInfo("UTC"))
    assert end == datetime(2025, 12, 31, 22, 0, tzinfo=ZoneInfo("UTC"))


def test_last_n_months_ordering_and_length() -> None:
    months = last_n_months(date(2026, 3, 15), 6)
    assert len(months) == 6
    assert months[0] == date(2025, 10, 1)
    assert months[-1] == date(2026, 3, 1)
    assert months == sorted(months)


def test_last_n_months_spans_year_boundary() -> None:
    months = last_n_months(date(2026, 1, 9), 3)
    assert [m.isoformat() for m in months] == ["2025-11-01", "2025-12-01", "2026-01-01"]


def test_last_n_months_zero_is_empty() -> None:
    assert last_n_months(date(2026, 8, 1), 0) == []
