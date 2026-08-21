"""Unit tests for the weekly meeting schedule rules."""

from datetime import date

from app.modules.attendance.domain.meeting_schedule import (
    MEETING_DAY_NAME,
    MEETING_WEEKDAY,
    current_meeting_date,
    is_meeting_date,
    meeting_dates_between,
    meeting_index_in_month,
    meeting_week_end,
    meetings_in_month,
    month_bounds,
    next_meeting_date,
    previous_meeting_date,
)

# August 2026: Thursdays fall on the 6th, 13th, 20th and 27th.
AUG_MEETINGS = [date(2026, 8, 6), date(2026, 8, 13), date(2026, 8, 20), date(2026, 8, 27)]


def test_meeting_day_is_thursday():
    assert MEETING_WEEKDAY == 3
    assert MEETING_DAY_NAME == "Thursday"
    assert date(2026, 8, 20).weekday() == MEETING_WEEKDAY


def test_is_meeting_date():
    assert is_meeting_date(date(2026, 8, 20)) is True
    assert is_meeting_date(date(2026, 8, 21)) is False
    assert is_meeting_date(date(2026, 8, 19)) is False


def test_current_meeting_date_on_meeting_day():
    thursday = date(2026, 8, 20)
    assert current_meeting_date(thursday) == thursday


def test_current_meeting_date_after_meeting_day():
    # Friday through Wednesday still belong to the Thursday 20th meeting.
    for day in range(21, 27):
        assert current_meeting_date(date(2026, 8, day)) == date(2026, 8, 20)


def test_current_meeting_date_never_returns_a_future_meeting():
    wednesday = date(2026, 8, 26)
    assert current_meeting_date(wednesday) < wednesday
    assert current_meeting_date(wednesday) == date(2026, 8, 20)


def test_meeting_week_end_is_wednesday():
    assert meeting_week_end(date(2026, 8, 20)) == date(2026, 8, 26)


def test_next_and_previous_meeting():
    assert next_meeting_date(date(2026, 8, 20)) == date(2026, 8, 27)
    assert next_meeting_date(date(2026, 8, 24)) == date(2026, 8, 27)
    assert previous_meeting_date(date(2026, 8, 20)) == date(2026, 8, 13)


def test_meetings_in_month_returns_four_meetings():
    assert meetings_in_month(2026, 8) == AUG_MEETINGS
    assert len(meetings_in_month(2026, 8)) == 4


def test_month_with_five_thursdays():
    # October 2026 has five Thursdays.
    meetings = meetings_in_month(2026, 10)
    assert len(meetings) == 5
    assert meetings[0] == date(2026, 10, 1)
    assert meetings[-1] == date(2026, 10, 29)


def test_meeting_dates_between_inclusive():
    meetings = meeting_dates_between(date(2026, 8, 6), date(2026, 8, 20))
    assert meetings == AUG_MEETINGS[:3]


def test_meeting_dates_between_starting_mid_week():
    meetings = meeting_dates_between(date(2026, 8, 7), date(2026, 8, 20))
    assert meetings == [date(2026, 8, 13), date(2026, 8, 20)]


def test_meeting_dates_between_reversed_range_is_empty():
    assert meeting_dates_between(date(2026, 8, 20), date(2026, 8, 6)) == []


def test_meeting_index_in_month():
    assert [meeting_index_in_month(meeting) for meeting in AUG_MEETINGS] == [1, 2, 3, 4]


def test_meeting_index_in_month_for_non_meeting_day():
    # Saturday 22nd belongs to the third meeting of August.
    assert meeting_index_in_month(date(2026, 8, 22)) == 3


def test_month_bounds():
    assert month_bounds(2026, 8) == (date(2026, 8, 1), date(2026, 8, 31))
    assert month_bounds(2026, 2) == (date(2026, 2, 1), date(2026, 2, 28))
