"""Check-in use case for weekly meeting attendance."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy.exc import IntegrityError

from app.core.exceptions.errors import ConflictError, ForbiddenError, ValidationError
from app.modules.attendance.application.dto.check_in_dto import (
    AttendanceDTO,
    CheckInResponse,
)
from app.modules.attendance.domain.entities import Attendance
from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.attendance.domain.meeting_schedule import (
    MEETING_DAY_NAME,
    current_meeting_date,
    is_meeting_date,
    meeting_index_in_month,
)
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)
from app.modules.attendance.infrastructure.services.qr_validation_service import (
    QrValidationService,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class CheckInCommand:
    """Use case: Record attendance for the current weekly meeting.

    Business flow:
    1. Authenticate admin
    2. Validate attendance permission
    3. Resolve the meeting that is open for recording
    4. Validate QR code
    5. Resolve user
    6. Reject a second record for the same user and meeting
    7. Create attendance
    8. Return result

    Meeting rules (see ``domain.meeting_schedule``):
    - Scanning works on any weekday; the record is attributed to the
      meeting of the current meeting week (Thursday -> Wednesday)
    - Only that meeting is open: a future meeting is not yet held and an
      earlier meeting is already closed, both are rejected
    - One record per user per meeting, enforced in the use case and by a
      unique index in the database
    """

    def __init__(self, session: "AsyncSession"):
        self._session = session
        self._qr_service = QrValidationService(session)
        self._attendance_repo = WeeklyAttendanceRepository(session)

    async def execute(
        self, qr_code: str, admin_user: User, meeting_date: date | None = None
    ) -> CheckInResponse:
        """Execute check-in command.

        Args:
            qr_code: QR code token to validate
            admin_user: The admin performing the scan
            meeting_date: Optional meeting the caller expects to record
                for; must be the currently open meeting

        Returns:
            CheckInResponse with attendance details

        Raises:
            ForbiddenError: If admin lacks permission
            ValidationError: If QR is invalid or the meeting is not open
            ConflictError: If the user is already recorded for the meeting
        """
        # Validate admin permission
        self._validate_admin_permission(admin_user)

        # Resolve the meeting that is open for recording
        open_meeting = self._resolve_open_meeting(meeting_date)

        # Validate QR and resolve user
        user = await self._qr_service.validate_and_resolve_user(qr_code)

        user_name = self._display_name(user)

        # Reject a second record for the same user and meeting
        existing = await self._attendance_repo.find_by_user_and_meeting(
            user.id, open_meeting
        )
        if existing is not None:
            raise ConflictError(
                f"{user_name} is already recorded for the "
                f"{MEETING_DAY_NAME} meeting on {open_meeting.isoformat()}"
            )

        # Create attendance record
        now = datetime.now()
        attendance = Attendance(
            id=uuid.uuid4(),
            user_id=user.id,
            meeting_date=open_meeting,
            check_in_at=now,
            status=AttendanceStatus.PRESENT,
            recorded_by=admin_user.id,
            created_at=now,
            updated_at=now,
        )

        # Persist. The unique index is the final guard against a double
        # scan racing past the check above.
        try:
            await self._attendance_repo.add(attendance)
            await self._session.commit()
        except IntegrityError as exc:
            await self._session.rollback()
            raise ConflictError(
                f"{user_name} is already recorded for the "
                f"{MEETING_DAY_NAME} meeting on {open_meeting.isoformat()}"
            ) from exc

        return CheckInResponse(
            success=True,
            message="Attendance recorded successfully",
            attendance=AttendanceDTO(
                id=attendance.id,
                user_id=attendance.user_id,
                user_name=user_name,
                meeting_date=attendance.meeting_date,
                meeting_index_in_month=meeting_index_in_month(attendance.meeting_date),
                check_in_at=attendance.check_in_at,
                status=attendance.status.value,
            ),
        )

    def _resolve_open_meeting(self, requested: date | None) -> date:
        """Return the meeting attendance may be recorded for.

        Args:
            requested: Meeting date supplied by the caller, if any

        Raises:
            ValidationError: If ``requested`` is not the open meeting
        """
        open_meeting = current_meeting_date()

        if requested is None:
            return open_meeting

        if not is_meeting_date(requested):
            raise ValidationError(
                f"{requested.isoformat()} is not a meeting date. "
                f"Meetings are held weekly on {MEETING_DAY_NAME}."
            )

        if requested > open_meeting:
            raise ValidationError(
                f"Cannot record attendance for the {MEETING_DAY_NAME} meeting on "
                f"{requested.isoformat()}: that meeting has not been held yet. "
                f"The open meeting is {open_meeting.isoformat()}."
            )

        if requested < open_meeting:
            raise ValidationError(
                f"Cannot record attendance for the {MEETING_DAY_NAME} meeting on "
                f"{requested.isoformat()}: that meeting is closed. "
                f"The open meeting is {open_meeting.isoformat()}."
            )

        return open_meeting

    @staticmethod
    def _display_name(user: User) -> str:
        """Best available display name for a user."""
        name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return name or user.email

    def _validate_admin_permission(self, user: User) -> None:
        """Validate that user has permission to record attendance.

        Args:
            user: The user attempting to record attendance

        Raises:
            ForbiddenError: If user lacks permission
        """
        # For Phase 2, only ADMIN and SERVANT roles can record attendance
        allowed_roles = {RoleName.ADMIN, RoleName.SERVANT}
        if user.role.name not in allowed_roles:
            raise ForbiddenError(
                "You do not have permission to record attendance. "
                "Only administrators and servants can scan QR codes."
            )
