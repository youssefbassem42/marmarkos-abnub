"""Verse list query parameters (Part 1 §5.1/§5.3)."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.bible.domain.enums import VerseStatus


class VerseListParams(BaseModel):
    """Manager list filters (GET /bible-verses)."""

    status: VerseStatus | None = Field(default=None, description="Filter by status")
    q: str | None = Field(default=None, max_length=200, description="Title/reference search")
    created_by: UUID | None = Field(default=None, description="Filter by creator")
    date_from: date | None = Field(default=None, description="Created on/after (local date)")
    date_to: date | None = Field(default=None, description="Created on/before (local date)")
    has_quiz: bool | None = Field(default=None, description="Only verses with/without a quiz")
    sort: str = Field(
        default="created_at",
        pattern="^(published_at|scheduled_at|created_at|title)$",
        description="Sort key",
    )
    order: str = Field(default="desc", pattern="^(asc|desc)$", description="Sort direction")


class PublishedFeedParams(BaseModel):
    """Member feed filters (GET /bible-verses/published)."""

    q: str | None = Field(default=None, max_length=200, description="Title/reference search")
    read: str = Field(
        default="all", pattern="^(all|read|unread)$", description="Caller read-state filter"
    )
    has_quiz: bool | None = Field(default=None, description="Only verses with/without a quiz")
