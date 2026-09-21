"""Internal scheduler tick endpoint (P5-019, D-3, Part 1 §5.8).

One POST publishes due schedules and drains the outbox. Single-item failures
are counted, never raised — the tick answers 200 with counters so a cron
monitor only sees real outages.
"""


from fastapi import APIRouter
from pydantic import BaseModel, Field

# Importing the handler module registers bible_verse.published in the
# dispatcher registry (import-time side effect by design).
import app.modules.bible.application.handlers.bible_verse_published_handler  # noqa: F401,E402
from app.config import settings
from app.core.database import async_session_factory
from app.modules.bible.application.services.publication_service import publish_due
from app.modules.internal.presentation.dependencies import CronOrAdmin
from app.shared.application.outbox_dispatcher import dispatch_pending

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

    publication = await publish_due(
        async_session_factory, limit=settings.SCHEDULER_TICK_MAX_BATCH
    )
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
