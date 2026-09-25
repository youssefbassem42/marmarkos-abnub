"""Outbox acknowledgements for attendance domain events.

Check-in and excuse already write their aggregate and audit row inline
(BR-8, BR-6); the outbox rows exist for record-keeping only. Until an
async consumer (e.g. analytics or attendance notifications) is built,
these handlers acknowledge the events so the dispatcher does not treat
them as unknown and retry them forever.
"""

import logging

from app.shared.application.outbox_dispatcher import register_handler
from app.shared.infrastructure.persistence.outbox import OutboxEvent
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


async def _ack_attendance_recorded(uow: UnitOfWork, event: OutboxEvent) -> None:
    logger.debug("outbox attendance.recorded acknowledged: %s", event.id)


async def _ack_attendance_excused(uow: UnitOfWork, event: OutboxEvent) -> None:
    logger.debug("outbox attendance.excused acknowledged: %s", event.id)


register_handler("attendance.recorded", _ack_attendance_recorded)
register_handler("attendance.excused", _ack_attendance_excused)