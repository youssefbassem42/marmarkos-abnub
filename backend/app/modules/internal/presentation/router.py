"""Internal scheduler tick endpoint (P5-019, D-3, Part 1 §5.8).

One POST publishes due schedules and drains the outbox. Single-item failures
are counted, never raised — the tick answers 200 with counters so a cron
monitor only sees real outages.
"""

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select

# Importing the handler modules registers their event types in the
# dispatcher registry (import-time side effect by design).
import app.modules.attendance.application.handlers.attendance_event_handlers  # noqa: F401,E402
import app.modules.bible.application.handlers.bible_verse_published_handler  # noqa: F401,E402
import app.modules.users.application.handlers.user_registered_handler  # noqa: F401,E402
from app.config import settings
from app.core.database import async_session_factory
from app.core.observability import render
from app.modules.bible.application.services.publication_service import publish_due
from app.modules.internal.presentation.dependencies import CronOrAdmin
from app.shared.application.outbox_dispatcher import dispatch_pending
from app.shared.infrastructure.persistence.outbox import OutboxEvent, OutboxStatus

router = APIRouter(prefix="/internal", tags=["Internal"])


class SchedulerTickResponse(BaseModel):
    """Frozen response shape (§5.8)."""

    published: int = Field(ge=0, description="Schedules published this tick")
    publish_failed: int = Field(ge=0, description="Publications that failed and will retry")
    auto_finished_attempts: int = Field(ge=0, description="Attempts auto-graded (always 0, V2)")
    outbox_processed: int = Field(ge=0, description="Outbox events processed")
    outbox_failed: int = Field(ge=0, description="Outbox events failed (backoff)")


@router.post(
    "/scheduler/tick",
    responses={
        401: {"description": "Missing or wrong cron secret / bearer"},
        403: {"description": "Non-admin bearer"},
        503: {"description": "scheduler_disabled: no CRON_SECRET configured"},
    },
)
async def scheduler_tick(actor: CronOrAdmin) -> SchedulerTickResponse:
    """Run one idempotent scheduler cycle (safe every minute, safe concurrently).

    ``actor`` is ``None`` for cron-secret calls; the ADMIN user for a
    manual trigger.
    """
    _ = actor

    publication = await publish_due(async_session_factory, limit=settings.SCHEDULER_TICK_MAX_BATCH)
    delivery = await dispatch_pending(
        async_session_factory, limit=settings.SCHEDULER_TICK_MAX_BATCH
    )
    return SchedulerTickResponse(
        published=publication["published"],
        publish_failed=publication["failed"],
        # V2: attempts are never auto-finished; the member must submit.
        auto_finished_attempts=0,
        outbox_processed=delivery["processed"],
        outbox_failed=delivery["failed"],
    )


@router.get(
    "/metrics",
    response_class=PlainTextResponse,
    responses={
        401: {"description": "Missing or wrong cron secret / bearer"},
        403: {"description": "Non-admin bearer"},
        503: {"description": "scheduler_disabled: no CRON_SECRET configured"},
    },
    summary="The in-process counters (Prometheus exposition format)",
)
async def metrics(actor: CronOrAdmin) -> PlainTextResponse:
    """Expose the operational counters (SEC-014 / OPS-004).

    The endpoint is protected exactly like the scheduler tick: the cron
    secret or an ADMIN bearer token. The counters live in the memory of
    the process (they are reset on a restart); the number of pending
    outbox rows is read from the database, because that number must
    survive a restart - it is the one that says "the scheduler is
    behind".
    """
    _ = actor
    pending = await _pending_outbox_rows()
    return PlainTextResponse(
        render(extra=[("marmarkos_outbox_pending", pending)]),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


async def _pending_outbox_rows() -> float:
    """How many outbox rows are still waiting to be dispatched."""
    async with async_session_factory() as session:
        count = (
            await session.execute(
                select(func.count())
                .select_from(OutboxEvent)
                .where(OutboxEvent.status.in_((OutboxStatus.PENDING, OutboxStatus.FAILED)))
            )
        ).scalar_one()
    return float(count)
