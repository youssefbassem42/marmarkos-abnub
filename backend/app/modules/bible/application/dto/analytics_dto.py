"""Verse analytics DTOs (Part 1 §5.7, P5-033)."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class VerseAnalyticsOverview(BaseModel):
    """GET /bible-verses/analytics/overview — dashboard totals."""

    total_posts: int = Field(ge=0, description="All verses")
    published: int = Field(ge=0, description="PUBLISHED verses")
    total_opens: int = Field(ge=0, description="Member opens (BR-13 filtered)")
    total_reads: int = Field(ge=0, description="Unique member readers")
    read_rate: float = Field(description="unique_reads / unique_opens × 100 (0 when no opens)")


class VerseQuickStats(BaseModel):
    """GET /bible-verses/analytics/quick-stats — admin Quick-Stat card."""

    this_week: int = Field(ge=0, description="Member opens since the start of this ISO week")
    this_month: int = Field(ge=0, description="Member opens since the start of this month")
    avg_reads: float = Field(ge=0, description="Average member opens per opened verse")
    top_verse_reference: str | None = Field(
        default=None, description="Reference of the most-opened verse"
    )
    top_verse_opens: int = Field(ge=0, description="Member opens of the top verse")


class EngagementSeriesPoint(BaseModel):
    bucket: date = Field(description="Day or ISO week start (granularity dependent)")
    opens: int = Field(ge=0, description="Opens in the bucket")
    reads: int = Field(ge=0, description="Reads in the bucket")


class RelatedQuizSummary(BaseModel):
    quiz_id: uuid.UUID = Field(description="Quiz id")
    participants: int = Field(ge=0, description="Finished participants")
    average_score_out_of_10: float = Field(description="Average score /10")


class VerseAnalyticsResponse(BaseModel):
    """GET /bible-verses/{id}/analytics."""

    verse_id: uuid.UUID = Field(description="Verse id")
    title: str = Field(description="Verse title")
    verse_reference: str = Field(description="Scripture reference")
    total_opens: int = Field(ge=0, description="Member opens (BR-13)")
    unique_opens: int = Field(ge=0, description="Distinct member openers")
    total_reads: int = Field(ge=0, description="Unique member readers")
    unique_readers: int = Field(ge=0, description="Distinct member readers")
    read_rate: float = Field(description="unique_readers / unique_opens × 100")
    series: list[EngagementSeriesPoint] = Field(
        description="Gap-filled opens/reads per bucket"
    )
    quiz: RelatedQuizSummary | None = Field(default=None, description="Related quiz performance")


class VerseUserEngagementItem(BaseModel):
    """Per-user engagement row (GET /bible-verses/{id}/analytics/users)."""

    user_id: uuid.UUID = Field(description="User id")
    full_name: str = Field(description="Display name")
    avatar: str | None = Field(default=None, description="Avatar URL")
    opened_count: int = Field(ge=0, description="Times the user opened the verse")
    has_read: bool = Field(description="User marked the verse read")
    last_opened_at: datetime | None = Field(default=None, description="Most recent open")
