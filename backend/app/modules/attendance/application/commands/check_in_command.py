"""Check-in use case for weekly meeting attendance."""

import uuid
from collections.abc import Callable
from datetime import date, datetime, timedelta

from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.core.exceptions.errors import ConflictError, ForbiddenError, ValidationError
from app.core.time import local_datetime, now_utc, to_local, today_local
from app.modules.attendance.application.dto.check_in_dto import (
    AttendanceDTO,
    CheckInResponse,
)
from app.modules.attendance.domain.entities import Attendance
from app.modules.attendance.domain.enums import AttendanceMethod, AttendanceStatus
from app.modules.attendance.domain.events.attendance_recorded import AttendanceRecorded
from app.modules.attendance.domain.meeting_schedule import (
    MEETING_DAY_NAME,
    current_meeting_date,
    is_meeting_date,
    meeting_index_in_month,
)
from app.modules.attendance.infrastructure.services.qr_validation_service import (
    QrValidationService,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


def derive_check_in_status(now: datetime, meeting_date: date) -> AttendanceStatus:
    """Pure BR-2 rule: PRESENT at or before start+grace, LATE after.

    A scan on any later weekday of the same meeting week is always LATE,
    because ``meeting_date @ start`` is then already in the past.
    """
    threshold = local_datetime(meeting_date, settings.MEETING_START_TIME) + timedelta(
        minutes=settings.MEETING_LATE_GRACE_MINUTES
    )
    return AttendanceStatus.LATE if to_local(now) > threshold else AttendanceStatus.PRESENT


class CheckInCommand:
    """Use case: Record attendance for the current weekly meeting.

    Business flow:
    1. Authenticate admin
    2. Validate attendance permission
    3. Resolve the meeting that is open for recording
    4. Validate QR code
    5. Resolve user
    6. Reject a second record for the same user and meeting
    7. Create attendance + outbox event + audit row in one transaction (BR-8)
    8. Return result

    Meeting rules (see ``domain.meeting_schedule``):
    - Scanning works on any weekday; the record is attributed to the
      meeting of the current meeting week (Thursday -> Wednesday)
    - Only that meeting is open: a future meeting is not yet held and an
      earlier meeting is already closed, both are rejected
    - One record per user per meeting, enforced in the use case and by a
      unique index in the database

    Status rule (BR-2): a scan whose platform-local timestamp is later
    than ``meeting_date @ MEETING_START_TIME`` plus the grace period is
    recorded as LATE, otherwise PRESENT. A scan on any later weekday of
    the same meeting week is therefore always LATE, because it is by
    definition after the meeting ended.
    """

    def __init__(
        self,
        uow: UnitOfWork,
        *,
        now: Callable[[], datetime] = now_utc,
        today: Callable[[], date] = today_local,
    ):
        self._uow = uow
        self._now = now
        self._today = today
        self._qr_service = QrValidationService(uow.session)

    async def execute(
        self,
        qr_code: str,
        admin_user: User,
        meeting_date: date | None = None,
        method: AttendanceMethod = AttendanceMethod.QR_SCAN,
    ) -> CheckInResponse:
        """Execute check-in command.

        Args:
            qr_code: QR code token to validate
            admin_user: The admin performing the scan
            meeting_date: Optional meeting the caller expects to record
                for; must be the currently open meeting
            method: How the code was captured (QR_SCAN or MANUAL)

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
        duplicate_message = (
            f"{user_name} is already recorded for the "
            f"{MEETING_DAY_NAME} meeting on {open_meeting.isoformat()}"
        )

        # Reject a second record for the same user and meeting
        existing = await self._uow.weekly_attendance.find_by_user_and_meeting(user.id, open_meeting)
        if existing is not None:
            raise ConflictError(duplicate_message)

        # Derive status from the meeting's configured start time plus the
        # late grace period (BR-2).
        now = self._now()
        threshold = local_datetime(open_meeting, settings.MEETING_START_TIME) + timedelta(
            minutes=settings.MEETING_LATE_GRACE_MINUTES
        )
        status = AttendanceStatus.LATE if to_local(now) > threshold else AttendanceStatus.PRESENT
        attendance = Attendance(
            id=uuid.uuid4(),
            user_id=user.id,
            meeting_date=open_meeting,
            check_in_at=now,
            status=status,
            recorded_by=admin_user.id,
            created_at=now,
            updated_at=now,
            method=method,
        )

        # Persist record + outbox event + audit row atomically (BR-8).
        # The unique index is the final guard against a double scan
        # racing past the check above.
        try:
            await self._uow.weekly_attendance.add(attendance)
            self._uow.record(
                AttendanceRecorded(
                    aggregate_id=attendance.id,
                    user_id=user.id,
                    meeting_date=open_meeting,
                    status=status.value,
                    method=method.value,
                    recorded_by=admin_user.id,
                )
            )
            await self._uow.audit.record(
                action="attendance.check_in",
                entity_type="weekly_attendance_record",
                entity_id=str(attendance.id),
                actor_user_id=admin_user.id,
                metadata={
                    "user_id": str(user.id),
                    "meeting_date": open_meeting.isoformat(),
                    "status": status.value,
                    "method": method.value,
                },
            )
            await self._uow.commit()
        except IntegrityError as exc:
            await self._uow.rollback()
            raise ConflictError(duplicate_message) from exc

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
                status=status.value,
                method=method.value,
                recorded_by=admin_user.id,
                recorded_by_name=self._display_name(admin_user),
            ),
        )

    def _resolve_open_meeting(self, requested: date | None) -> date:
        """Return the meeting attendance may be recorded for.

        Args:
            requested: Meeting date supplied by the caller, if any

        Raises:
            ValidationError: If ``requested`` is not the open meeting
        """
        open_meeting = current_meeting_date(self._today())

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

        Kept as defence in depth: the route already requires ADMIN or
        SERVANT via ``require_role``.

        Args:
            user: The user attempting to record attendance

        Raises:
            ForbiddenError: If user lacks permission
        """
        allowed_roles = {RoleName.ADMIN, RoleName.SERVANT}
        if user.role.name not in allowed_roles:
            raise ForbiddenError(
                "You do not have permission to record attendance. "
                "Only administrators and servants can scan QR codes."
            )
