"""The single clock of the platform.

Every "what date/time is it" answer in the application must come from
here so that business behaviour (which meeting is open, whether a scan
is late, when the absence cutoff passes) follows the configured platform
timezone instead of the server clock.

All returned values are timezone-aware. ``date.today()`` and
``datetime.now()`` are banned outside this module.
"""

from datetime import UTC, date, datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

from app.config import settings


@lru_cache(maxsize=1)
def platform_timezone() -> ZoneInfo:
    """Return the configured platform timezone (default Africa/Cairo)."""
    return ZoneInfo(settings.PLATFORM_TIMEZONE)


def now_utc() -> datetime:
    """Current moment as a timezone-aware UTC datetime."""
    return datetime.now(UTC)


def now_local() -> datetime:
    """Current moment in the platform timezone."""
    return now_utc().astimezone(platform_timezone())


def today_local() -> date:
    """Today's calendar date in the platform timezone."""
    return now_local().date()


def to_local(value: datetime) -> datetime:
    """Convert an aware datetime to the platform timezone.

    A naive value is interpreted as UTC (storage convention for
    ``timestamptz`` columns read back without tzinfo).
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(platform_timezone())


def local_datetime(day: date, hhmm: str) -> datetime:
    """Combine a calendar date with an ``HH:MM`` local time-of-day.

    Returns an aware datetime in the platform timezone.

    Raises:
        ValueError: If ``hhmm`` is not a valid ``HH:MM`` value.
    """
    hours, _, minutes = hhmm.partition(":")
    try:
        hour = int(hours)
        minute = int(minutes)
    except ValueError as exc:
        raise ValueError(f"Malformed time {hhmm!r}; expected HH:MM") from exc

    if len(minutes) != 2 or not (0 <= hour <= 23) or not (0 <= minute <= 59):
        raise ValueError(f"Malformed time {hhmm!r}; expected HH:MM")

    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=platform_timezone())
