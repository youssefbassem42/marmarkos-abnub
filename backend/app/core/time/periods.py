"""ISO-week and month period arithmetic (D-5).

Phase 5 reports weekly and monthly points on **Monday-based ISO weeks**
in the platform timezone (Africa/Cairo). Attendance keeps its own
Thursday meeting week in ``attendance/domain/meeting_schedule.py``;
the two definitions must never mix, so this module is the single home
of the ISO week for bible verses, quizzes and the points ledger.

All functions are pure ``date``/``datetime`` math; callers that need
"now" use :mod:`app.core.time.clock`.
"""

from datetime import UTC, date, datetime, time, timedelta

from app.core.time.clock import platform_timezone


def iso_week_start(day: date) -> date:
    """The Monday starting the ISO week containing ``day`` (D-5)."""
    return day - timedelta(days=day.weekday())


def iso_week_end(day: date) -> date:
    """The Sunday ending the ISO week containing ``day``."""
    return iso_week_start(day) + timedelta(days=6)


def month_start(day: date) -> date:
    """The first calendar day of the month containing ``day`` (BR-33)."""
    return day.replace(day=1)


def month_bounds(year: int, month: int) -> tuple[date, date]:
    """First and last calendar day of a month."""
    start = date(year, month, 1)
    if month == 12:
        end = date(year, 12, 31)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return start, end


def _local_midnight_utc(day: date) -> datetime:
    """Local midnight of ``day`` expressed as an aware UTC datetime.

    Mirrors the attendance idiom of building a platform-local wall-clock
    boundary (``local_datetime(...).astimezone(UTC)``) so comparisons
    against ``timestamptz`` columns are exact.
    """
    local = datetime.combine(day, time.min, tzinfo=platform_timezone())
    return local.astimezone(UTC)


def week_window_utc(day: date) -> tuple[datetime, datetime]:
    """Local Monday 00:00 → next Monday 00:00 as aware UTC datetimes."""
    start = iso_week_start(day)
    return _local_midnight_utc(start), _local_midnight_utc(start + timedelta(days=7))


def month_window_utc(year: int, month: int) -> tuple[datetime, datetime]:
    """Local first-of-month 00:00 → first of next month, as UTC datetimes."""
    start = date(year, month, 1)
    end_year, end_month = (year + 1, 1) if month == 12 else (year, month + 1)
    return _local_midnight_utc(start), _local_midnight_utc(date(end_year, end_month, 1))


def last_n_months(anchor: date, n: int) -> list[date]:
    """The last ``n`` months as first-of-month dates, oldest → newest.

    The anchor's own month is always included as the newest entry, so
    ``last_n_months(date(2026, 3, 15), 6)`` starts at October 2025.
    """
    months: list[date] = []
    year, month = anchor.year, anchor.month
    for _ in range(max(n, 0)):
        months.append(date(year, month, 1))
        year, month = (year - 1, 12) if month == 1 else (year, month - 1)
    months.reverse()
    return months
