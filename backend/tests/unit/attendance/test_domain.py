"""Unit tests for attendance domain logic."""

import uuid
from datetime import date, datetime

from app.modules.attendance.domain.entities import Attendance
from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.attendance.domain.meeting_schedule import current_meeting_date

MEETING = current_meeting_date(date(2026, 8, 21))  # Thursday 2026-08-20


def _attendance(status: AttendanceStatus, meeting_date: date = MEETING) -> Attendance:
    now = datetime.now()
    return Attendance(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        meeting_date=meeting_date,
        check_in_at=now,
        status=status,
        recorded_by=uuid.uuid4(),
        created_at=now,
        updated_at=now,
    )


def test_attendance_entity_creation():
    """Test creating an attendance entity."""
    attendance_id = uuid.uuid4()
    user_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    now = datetime.now()

    attendance = Attendance(
        id=attendance_id,
        user_id=user_id,
        meeting_date=MEETING,
        check_in_at=now,
        status=AttendanceStatus.PRESENT,
        recorded_by=admin_id,
        created_at=now,
        updated_at=now,
    )

    assert attendance.id == attendance_id
    assert attendance.user_id == user_id
    assert attendance.meeting_date == MEETING
    assert attendance.check_in_at == now
    assert attendance.status == AttendanceStatus.PRESENT
    assert attendance.recorded_by == admin_id


def test_meeting_date_is_a_thursday():
    """Attendance is stored against the weekly meeting day."""
    attendance = _attendance(AttendanceStatus.PRESENT)

    assert attendance.meeting_date == date(2026, 8, 20)
    assert attendance.is_on_meeting_day is True
    assert attendance.meeting_index_in_month == 3


def test_is_present_property():
    """Test the is_present property."""
    attendance = _attendance(AttendanceStatus.PRESENT)

    assert attendance.is_present is True
    assert attendance.is_absent is False
    assert attendance.is_excused is False


def test_is_absent_property():
    """Test the is_absent property."""
    attendance = _attendance(AttendanceStatus.ABSENT)

    assert attendance.is_present is False
    assert attendance.is_absent is True
    assert attendance.is_excused is False


def test_is_excused_property():
    """Test the is_excused property."""
    attendance = _attendance(AttendanceStatus.EXCUSED)

    assert attendance.is_present is False
    assert attendance.is_absent is False
    assert attendance.is_excused is True


def test_attendance_status_enum():
    """Test attendance status enum values."""
    assert AttendanceStatus.PRESENT.value == "PRESENT"
    assert AttendanceStatus.ABSENT.value == "ABSENT"
    assert AttendanceStatus.EXCUSED.value == "EXCUSED"

    # Test that enum can be created from string
    assert AttendanceStatus("PRESENT") == AttendanceStatus.PRESENT
    assert AttendanceStatus("ABSENT") == AttendanceStatus.ABSENT
    assert AttendanceStatus("EXCUSED") == AttendanceStatus.EXCUSED
