"""Unit tests for absence rules (TASK-701 #3, BR-4/BR-5/BR-6)."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.core.time import local_datetime, today_local
from app.modules.attendance.application.services.absence_service import (
    AbsenceCalculationService,
)
from app.modules.attendance.domain.enums import ATTENDED_STATUSES, AttendanceStatus
from app.modules.attendance.domain.meeting_schedule import current_meeting_date

CAIRO = ZoneInfo("Africa/Cairo")


def _service(today=None, now=None) -> AbsenceCalculationService:
    return AbsenceCalculationService(
        None,  # type: ignore[arg-type]  # no DB access on this code path
        today=today or today_local,
        now=now or (lambda: datetime.now(CAIRO)),
    )


def test_attended_statuses_are_exactly_present_and_late():
    assert ATTENDED_STATUSES == frozenset(
        {AttendanceStatus.PRESENT, AttendanceStatus.LATE}
    )
    # BR-3: late members are never counted as absent.
    assert AttendanceStatus.LATE in ATTENDED_STATUSES


def test_excused_is_neither_attended_nor_present():
    assert AttendanceStatus.EXCUSED not in ATTENDED_STATUSES
    assert AttendanceStatus.EXCUSED != AttendanceStatus.ABSENT


def test_is_absence_final_for_a_past_meeting():
    service = _service()
    past = current_meeting_date(today_local()) - __import__("datetime").timedelta(days=7)
    assert service.is_absence_final(past) is True


def test_is_absence_final_future_meeting_is_not_final():
    service = _service()
    future = current_meeting_date(today_local()) + __import__("datetime").timedelta(days=7)
    assert service.is_absence_final(future) is False


def test_is_absence_final_before_and_after_cutoff():
    open_meeting = current_meeting_date(today_local())

    before_cutoff = local_datetime(open_meeting, "20:59")
    after_cutoff = local_datetime(open_meeting, "21:01")

    before = _service(now=lambda: before_cutoff)
    after = _service(now=lambda: after_cutoff)

    assert before.is_absence_final(open_meeting) is False
    assert after.is_absence_final(open_meeting) is True


def test_week_closed_boundary_is_wednesday_2359_in_utc():
    meeting = date(2026, 8, 20)  # Thursday; week ends Wednesday 2026-08-26.
    closed_at = AbsenceCalculationService(None)._week_closed_at(meeting)  # type: ignore[arg-type]
    expected = local_datetime(date(2026, 8, 26), "23:59").astimezone(UTC)
    assert closed_at == expected
