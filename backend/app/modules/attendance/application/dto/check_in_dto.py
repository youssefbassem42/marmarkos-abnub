"""DTOs for attendance check-in."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.attendance.domain.enums import AttendanceMethod


class CheckInRequest(BaseModel):
    """Request to record attendance for the current meeting.

    Exactly one identifier must be supplied: ``qr_code`` (scanned or
    typed QR token) or ``pin`` (the member's five-digit attendance PIN
    for when they cannot show their QR code at all).
    """

    qr_code: str | None = Field(None, description="QR code token to validate")
    pin: str | None = Field(
        None,
        pattern=r"^\d{5}$",
        description="The member's five-digit attendance PIN",
    )
    meeting_date: date | None = Field(
        None,
        description=(
            "Optional meeting the client expects to record for. Must be the "
            "currently open meeting; past and future meetings are rejected."
        ),
    )
    method: AttendanceMethod = Field(
        AttendanceMethod.QR_SCAN,
        description=(
            "How the code was captured: QR_SCAN (camera), MANUAL (typed "
            "token) or PIN. Ignored when ``pin`` is used — recorded as PIN."
        ),
    )

    @model_validator(mode="after")
    def exactly_one_identifier(self) -> "CheckInRequest":
        if bool(self.qr_code) == bool(self.pin):
            raise ValueError("Provide exactly one of qr_code or pin")
        return self


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
