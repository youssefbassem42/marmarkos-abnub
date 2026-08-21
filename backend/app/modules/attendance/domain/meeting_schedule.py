"""Weekly meeting schedule rules.

The service runs **one meeting per week, on Thursday**, so attendance is
per *meeting*, never per calendar day. A calendar month therefore holds
4 meetings (5 when the month contains five Thursdays).

Meeting week
------------
A meeting week starts on the meeting day (Thursday) and ends on the
following Wednesday::

    Thu (meeting) | Fri | Sat | Sun | Mon | Tue | Wed
    ^-------------------- one meeting week --------^

Every date inside that window resolves to the same ``meeting_date``.
Consequences, which the check-in use case relies on:

* An admin can scan on any weekday; the scan is attributed to the
  meeting of the current meeting week.
* The next Thursday is a *future* meeting and can never be recorded.
* Once a new Thursday starts, the previous meeting is closed and can no
  longer be recorded (no back-dating).

All helpers are pure functions over ``datetime.date`` so they can be
unit-tested without a database.
"""

import calendar
from datetime import date, timedelta

#: Monday is 0 in :meth:`datetime.date.weekday`, so Thursday is 3.
MEETING_WEEKDAY: int = 3

#: Human readable label used in API/UI messages.
MEETING_DAY_NAME: str = "Thursday"

#: Days in a meeting week.
MEETING_INTERVAL_DAYS: int = 7

__all__ = [
    "MEETING_DAY_NAME",
    "MEETING_INTERVAL_DAYS",
    "MEETING_WEEKDAY",
    "current_meeting_date",
    "is_meeting_date",
    "meeting_dates_between",
    "meeting_index_in_month",
    "meeting_week_end",
    "meetings_in_month",
    "month_bounds",
    "next_meeting_date",
    "previous_meeting_date",
]


def is_meeting_date(value: date) -> bool:
    """Return ``True`` when ``value`` falls on the weekly meeting day."""
    return value.weekday() == MEETING_WEEKDAY


def current_meeting_date(reference: date | None = None) -> date:
    """Return the meeting ``reference`` belongs to.

    This is the meeting day of the current meeting week: ``reference``
    itself when it is a Thursday, otherwise the most recent Thursday
    before it. Never returns a date in the future relative to
    ``reference``.
    """
    today = reference or date.today()
    days_since_meeting = (today.weekday() - MEETING_WEEKDAY) % MEETING_INTERVAL_DAYS
    return today - timedelta(days=days_since_meeting)


def meeting_week_end(meeting_date: date) -> date:
    """Return the last day (Wednesday) of ``meeting_date``'s meeting week."""
    return meeting_date + timedelta(days=MEETING_INTERVAL_DAYS - 1)


def next_meeting_date(reference: date | None = None) -> date:
    """Return the first meeting strictly after ``reference``."""
    return current_meeting_date(reference) + timedelta(days=MEETING_INTERVAL_DAYS)


def previous_meeting_date(reference: date | None = None) -> date:
    """Return the meeting immediately before ``reference``'s meeting."""
    return current_meeting_date(reference) - timedelta(days=MEETING_INTERVAL_DAYS)


def meeting_dates_between(start: date, end: date) -> list[date]:
    """Return every meeting date within the inclusive ``start``..``end`` range."""
    if end < start:
        return []

    first = start if is_meeting_date(start) else current_meeting_date(start) + timedelta(
        days=MEETING_INTERVAL_DAYS
    )

    meetings: list[date] = []
    current = first
    while current <= end:
        meetings.append(current)
        current += timedelta(days=MEETING_INTERVAL_DAYS)
    return meetings


def month_bounds(year: int, month: int) -> tuple[date, date]:
    """Return the first and last calendar day of ``year``/``month``."""
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def meetings_in_month(year: int, month: int) -> list[date]:
    """Return every meeting date in ``year``/``month`` (4 or 5 Thursdays)."""
    first_day, last_day = month_bounds(year, month)
    return meeting_dates_between(first_day, last_day)


def meeting_index_in_month(meeting_date: date) -> int:
    """Return the 1-based position of ``meeting_date`` within its month.

    ``1`` for the first Thursday of the month, ``4`` for the fourth, and
    ``5`` in the months that contain a fifth Thursday.
    """
    meetings = meetings_in_month(meeting_date.year, meeting_date.month)
    if meeting_date in meetings:
        return meetings.index(meeting_date) + 1
    # Not a meeting date: report the meeting week it belongs to instead.
    resolved = current_meeting_date(meeting_date)
    meetings = meetings_in_month(resolved.year, resolved.month)
    return meetings.index(resolved) + 1
