"""Correction use case: mark a check-in as EXCUSED (BR-6)."""

import uuid

from app.core.exceptions.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.time import today_local
from app.modules.attendance.application.dto.check_in_dto import (
    AttendanceDTO,
    ExcuseResponse,
)
from app.modules.attendance.application.queries.meeting_attendance_query import display_name
from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.attendance.domain.events.attendance_recorded import AttendanceExcused
from app.modules.attendance.domain.meeting_schedule import (
    MEETING_DAY_NAME,
    current_meeting_date,
    meeting_index_in_month,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


class ExcuseAttendanceCommand:
    """Use case: correct an attendance record to EXCUSED.

    Rule set (BR-6) - the only permitted correction in Sprint 2:
    - ADMIN only
    - the record must exist
    - applies to the open meeting only; past meetings are closed
    - writes an ``audit_logs`` row with the reason and records an
      ``attendance.excused`` outbox event, in one transaction
    """

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def execute(
        self,
        attendance_id: uuid.UUID,
        admin_user: User,
        reason: str | None = None,
    ) -> ExcuseResponse:
        """Mark an attendance record of the open meeting as EXCUSED.

        Args:
            attendance_id: The attendance record to correct
            admin_user: The authenticated administrator
            reason: Optional free-text justification, stored in audit

        Raises:
            ForbiddenError: If the caller is not an ADMIN
            NotFoundError: If the record does not exist
            ValidationError: If the record belongs to a past meeting
        """
        self._validate_admin(admin_user)

        record = await self._uow.weekly_attendance.get_by_id(attendance_id)
        if record is None:
            raise NotFoundError("Attendance record not found")

        open_meeting = current_meeting_date(today_local())
        if record.meeting_date != open_meeting:
            raise ValidationError(
                "Only the open "
                f"{MEETING_DAY_NAME} meeting ({open_meeting.isoformat()}) can be "
                f"corrected; {record.meeting_date.isoformat()} is closed."
            )

        member = await self._uow.users.get_by_id(record.user_id)
        recorder = await self._uow.users.get_by_id(record.recorded_by)

        previous_status = record.status
        record.status = AttendanceStatus.EXCUSED
        await self._uow.weekly_attendance.update(record)

        self._uow.record(
            AttendanceExcused(
                aggregate_id=record.id,
                user_id=record.user_id,
                meeting_date=open_meeting,
                previous_status=str(previous_status.value),
                reason=reason,
                excused_by=admin_user.id,
            )
        )
        await self._uow.audit.record(
            action="attendance.excused",
            entity_type="weekly_attendance_record",
            entity_id=str(record.id),
            actor_user_id=admin_user.id,
            metadata={
                "user_id": str(record.user_id),
                "meeting_date": open_meeting.isoformat(),
                "reason": reason,
            },
        )
        await self._uow.commit()

        return ExcuseResponse(
            success=True,
            message="Attendance marked as excused",
            attendance=AttendanceDTO(
                id=record.id,
                user_id=record.user_id,
                user_name=display_name(member) if member is not None else "",
                meeting_date=record.meeting_date,
                meeting_index_in_month=meeting_index_in_month(record.meeting_date),
                check_in_at=record.check_in_at,
                status=AttendanceStatus.EXCUSED.value,
                method=str(record.method.value),
                recorded_by=record.recorded_by,
                recorded_by_name=(display_name(recorder) if recorder is not None else ""),
            ),
        )

    @staticmethod
    def _validate_admin(user: User) -> None:
        if user.role.name != RoleName.ADMIN:
            raise ForbiddenError("Only administrators can excuse attendance")
