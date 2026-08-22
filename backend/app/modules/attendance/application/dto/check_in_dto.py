"""DTOs for attendance check-in."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.attendance.domain.enums import AttendanceMethod


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
    method: AttendanceMethod = Field(
        AttendanceMethod.QR_SCAN,
        description="How the code was captured: QR_SCAN (camera) or MANUAL (typed).",
    )


class AttendanceDTO(BaseModel):
    """Attendance record data transfer object."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    user_name: str
    meeting_date: date
    meeting_index_in_month: int = Field(
        ..., description="1-based position of the meeting within its month (1..5)"
    )
    check_in_at: datetime
    status: str
    method: str = Field(..., description="Scan method: QR_SCAN or MANUAL")
    recorded_by: UUID = Field(..., description="Admin who performed the scan")
    recorded_by_name: str = Field(..., description="Display name of the recording admin")


class CheckInResponse(BaseModel):
    """Response after successful check-in."""

    success: bool
    message: str
    attendance: AttendanceDTO


class ExcuseRequest(BaseModel):
    """Request body for correcting a record to EXCUSED."""

    reason: str | None = Field(
        None,
        description="Optional free-text justification, stored in the audit log",
        max_length=500,
    )


class ExcuseResponse(BaseModel):
    """Response after marking a record EXCUSED."""

    success: bool
    message: str
    attendance: AttendanceDTO
