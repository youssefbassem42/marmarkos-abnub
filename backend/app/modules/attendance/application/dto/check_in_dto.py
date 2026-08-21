"""DTOs for attendance check-in."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    """Request to record attendance for the current meeting via QR code."""

    qr_code: str = Field(..., description="QR code token to validate")
    meeting_date: date | None = Field(
        None,
        description=(
            "Optional meeting the client expects to record for. Must be the "
            "currently open meeting; past and future meetings are rejected."
        ),
    )


class AttendanceDTO(BaseModel):
    """Attendance record data transfer object."""

    id: UUID
    user_id: UUID
    user_name: str
    meeting_date: date
    meeting_index_in_month: int = Field(
        ..., description="1-based position of the meeting within its month (1..5)"
    )
    check_in_at: datetime
    status: str

    class Config:
        from_attributes = True


class CheckInResponse(BaseModel):
    """Response after successful check-in."""

    success: bool
    message: str
    attendance: AttendanceDTO
