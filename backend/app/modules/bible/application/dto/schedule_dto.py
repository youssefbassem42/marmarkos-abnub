"""Publication schedule DTOs (P5-013, Part 1 §5.2)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class VerseScheduleRequest(BaseModel):
    """POST/PATCH /bible-verses/{id}/schedule body."""

    scheduled_at: datetime = Field(
        description="Planned publication moment; ISO 8601, naive values are "
        "interpreted in the platform timezone (Africa/Cairo)"
    )


class VerseScheduleResponse(BaseModel):
    """Created/updated active schedule."""

    id: UUID = Field(description="Schedule id")
    verse_id: UUID = Field(description="Verse id")
    status: str = Field(description="SCHEDULED | PUBLISHED | CANCELLED | FAILED")
    scheduled_at: datetime = Field(description="Planned publication moment (UTC)")
    created_by_user_id: UUID | None = Field(default=None, description="Scheduler user")


class VerseScheduleItem(VerseScheduleResponse):
    """Manager scheduled-publications row (GET /bible-verses/schedules)."""

    verse_reference: str = Field(description="Scripture reference of the verse")
    verse_title: str = Field(description="Title of the verse")
    attempts: int = Field(ge=0, description="Failed publication attempts so far")
    notification_status: str = Field(description="Creator notification delivery state")
    published_at: datetime | None = Field(default=None, description="Actual publish time")


class ScheduleListParams(BaseModel):
    status: str | None = Field(default=None, description="Filter by schedule status")
    date_from: datetime | None = Field(default=None, description="scheduled_at lower bound")
    date_to: datetime | None = Field(default=None, description="scheduled_at upper bound")
