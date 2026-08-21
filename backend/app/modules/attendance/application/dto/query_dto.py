"""DTOs for attendance queries and analysis."""

from datetime import date

from pydantic import BaseModel, Field

from app.modules.attendance.application.dto.check_in_dto import AttendanceDTO


class MeetingAttendanceResponse(BaseModel):
    """Response for a single meeting's attendance."""

    meeting_date: date
    meeting_index_in_month: int = Field(
        ..., description="1-based position of the meeting within its month (1..5)"
    )
    is_open: bool = Field(
        ..., description="True when this is the meeting currently open for check-in"
    )
    total_present: int
    attendance_records: list[AttendanceDTO]


class AttendanceSummary(BaseModel):
    """Summary statistics for one meeting."""

    total_present: int
    total_absent: int
    total_expected: int
    attendance_rate: float


class MeetingStatisticsResponse(BaseModel):
    """Response for a single meeting's statistics."""

    meeting_date: date
    meeting_index_in_month: int
    summary: AttendanceSummary


class MeetingStat(BaseModel):
    """Attendance for one meeting inside a monthly report."""

    meeting_date: date
    meeting_index_in_month: int
    present_count: int
    absent_count: int
    attendance_rate: float
    is_held: bool = Field(..., description="False for meetings still in the future")


class MonthlyStatisticsResponse(BaseModel):
    """Monthly analysis across the meetings of a calendar month.

    A month holds 4 meetings (5 when it contains five Thursdays).
    """

    year: int
    month: int
    total_meetings: int = Field(..., description="Meetings scheduled in the month (4 or 5)")
    meetings_held: int = Field(..., description="Meetings already held")
    expected_per_meeting: int = Field(..., description="Active users expected per meeting")
    meetings: list[MeetingStat]
    total_attendance: int = Field(..., description="Sum of check-ins across held meetings")
    average_attendance: float = Field(..., description="Average check-ins per held meeting")
    attendance_rate: float = Field(
        ..., description="Total attendance / (expected x meetings held), as a percentage"
    )
    distinct_attendees: int = Field(
        ..., description="Users who attended at least one meeting in the month"
    )
    full_attendance_count: int = Field(
        ..., description="Users who attended every meeting held so far"
    )
    no_attendance_count: int = Field(
        ..., description="Active users who attended no meeting in the month"
    )


class MeetingScheduleResponse(BaseModel):
    """The meeting calendar for a month."""

    year: int
    month: int
    meeting_day: str = Field(..., description="Weekday the meeting is held on")
    total_meetings: int
    meetings: list[date]
    open_meeting_date: date = Field(..., description="Meeting currently open for check-in")


class AbsentUsersResponse(BaseModel):
    """Response for absent users at a meeting."""

    meeting_date: date
    absent_count: int
    absent_users: list[dict[str, str]]


class AttendanceHistoryResponse(BaseModel):
    """Response for attendance history query."""

    total_count: int
    attendance_records: list[AttendanceDTO]
