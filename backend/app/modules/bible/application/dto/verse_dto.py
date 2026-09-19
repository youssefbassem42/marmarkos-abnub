"""Verse request/response DTOs (P5-009, Part 1 §5.1).

Validation mirrors BR-2 exactly; every field carries a description so
the OpenAPI document is self-explanatory. Quiz data never leaks into
member projections beyond ``QuizSummary`` (§10.1).
"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.bible.domain.enums import ScheduleStatus, VerseStatus


def _validate_cover_image_url(value: str | None) -> str | None:
    """P5-012: only https URLs on the configured Cloudinary host.

    The client uploads through the existing signed flow; the verse
    endpoints never accept a raw file — just the returned URL.
    """
    if value is None or value.strip() == "":
        return None
    from app.config import settings

    stripped = value.strip()
    if not stripped.startswith("https://"):
        raise ValueError("image must be an https URL")
    if len(stripped) > 500:
        raise ValueError("image URL must be at most 500 characters")
    cloud_name = settings.CLOUDINARY_CLOUD_NAME
    if cloud_name and f"res.cloudinary.com/{cloud_name}/" not in stripped:
        raise ValueError("image must be hosted on the platform's Cloudinary account")
    return stripped


class VerseScheduleBrief(BaseModel):
    """Active/latest schedule attached to a manager detail response."""

    id: UUID = Field(description="Schedule id")
    status: ScheduleStatus = Field(description="Schedule lifecycle status")
    scheduled_at: datetime = Field(description="Planned publication moment (UTC)")
    notification_status: str = Field(description="Creator notification delivery state")


class QuizSummary(BaseModel):
    """Read-only quiz summary embedded in verse payloads (BR-18)."""

    quiz_id: UUID = Field(description="Quiz id")
    status: str = Field(description="Quiz lifecycle status")
    question_count: int = Field(ge=0, description="Number of questions")
    total_points: int = Field(ge=0, description="Derived sum of question points")
    duration_seconds: int = Field(ge=30, le=7200, description="Time limit in seconds")


class CreatorBrief(BaseModel):
    id: UUID = Field(description="Creator user id")
    full_name: str | None = Field(default=None, description="Display name")
    email: str | None = Field(default=None, description="Account email")


class VerseCreateRequest(BaseModel):
    """POST /bible-verses body (BR-1/BR-2)."""

    title: str = Field(min_length=1, max_length=100, description="Display title (≤100)")
    subtitle: str | None = Field(
        default=None, max_length=200, description="Optional subtitle (≤200)"
    )
    verse_reference: str = Field(min_length=1, max_length=120, description="e.g. Matthew 6:25-34")
    book: str = Field(min_length=1, max_length=60, description="Bible book name")
    chapter: int = Field(ge=1, le=150, description="Chapter number (1–150)")
    verse_start: int = Field(ge=1, le=200, description="First verse number (1–200)")
    verse_end: int | None = Field(
        default=None, ge=1, le=200, description="Last verse number when a range"
    )
    text: str = Field(min_length=1, max_length=2000, description="Verse text (≤2000)")
    reflection: str | None = Field(
        default=None, max_length=5000, description="Pastoral reflection (≤5000)"
    )
    image: str | None = Field(
        default=None, max_length=500, description="Cover image URL (https, Cloudinary host)"
    )
    translation: str | None = Field(
        default=None, max_length=80, description="Bible translation code (default NIV)"
    )
    status: VerseStatus | None = Field(
        default=None,
        description="Save as DRAFT (default) or PUBLISHED immediately",
    )

    @model_validator(mode="after")
    def _verse_range(self) -> "VerseCreateRequest":
        if self.verse_end is not None and self.verse_end < self.verse_start:
            raise ValueError("verse_end must be greater than or equal to verse_start")
        return self

    @field_validator("image")
    @classmethod
    def _image_url(cls, value: str | None) -> str | None:
        return _validate_cover_image_url(value)


class VerseUpdateRequest(BaseModel):
    """PATCH /bible-verses/{id} body — all fields optional."""

    title: str | None = Field(default=None, min_length=1, max_length=100)
    subtitle: str | None = Field(default=None, max_length=200)
    verse_reference: str | None = Field(default=None, min_length=1, max_length=120)
    book: str | None = Field(default=None, min_length=1, max_length=60)
    chapter: int | None = Field(default=None, ge=1, le=150)
    verse_start: int | None = Field(default=None, ge=1, le=200)
    verse_end: int | None = Field(default=None, ge=1, le=200)
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    reflection: str | None = Field(default=None, max_length=5000)
    image: str | None = Field(default=None, max_length=500)
    translation: str | None = Field(default=None, max_length=80)
    status: VerseStatus | None = Field(
        default=None,
        description="DRAFT↔PUBLISHED and ARCHIVED→DRAFT transitions only (BR-5)",
    )

    @model_validator(mode="after")
    def _verse_range(self) -> "VerseUpdateRequest":
        if (
            self.verse_end is not None
            and self.verse_start is not None
            and self.verse_end < self.verse_start
        ):
            raise ValueError("verse_end must be greater than or equal to verse_start")
        return self

    @field_validator("image")
    @classmethod
    def _image_url(cls, value: str | None) -> str | None:
        return _validate_cover_image_url(value)


class VerseAdminItem(BaseModel):
    """Manager table row for GET /bible-verses."""

    id: UUID = Field(description="Verse id")
    title: str = Field(description="Display title")
    verse_reference: str = Field(description="Scripture reference")
    status: VerseStatus = Field(description="Lifecycle status")
    schedule: VerseScheduleBrief | None = Field(
        default=None, description="Active/latest publication schedule"
    )
    has_quiz: bool = Field(description="Whether any quiz exists for this verse")
    opens: int = Field(ge=0, description="Total recorded opens")
    reads: int = Field(ge=0, description="Unique readers")
    created_by_user: CreatorBrief | None = Field(default=None, description="Created by")
    created_at: datetime = Field(description="Creation timestamp (UTC)")
    published_at: datetime | None = Field(default=None, description="First publish time")


class VerseStatsResponse(BaseModel):
    """GET /bible-verses/stats — KPI card counts."""

    total: int = Field(ge=0, description="All verses")
    drafts: int = Field(ge=0, description="DRAFT verses")
    scheduled: int = Field(ge=0, description="SCHEDULED verses")
    published: int = Field(ge=0, description="PUBLISHED verses")
    archived: int = Field(ge=0, description="ARCHIVED verses")


class VerseCard(BaseModel):
    """Member-facing feed card (§5.3 GET /bible-verses/published)."""

    id: UUID = Field(description="Verse id")
    title: str = Field(description="Display title")
    verse_reference: str = Field(description="Scripture reference")
    excerpt: str = Field(description="Truncated verse text")
    image: str | None = Field(default=None, description="Cover image URL")
    published_at: datetime | None = Field(default=None, description="Publish time (UTC)")
    week_start_date: date | None = Field(default=None, description="Monday of the ISO week")
    is_read: bool = Field(description="Caller marked this verse read")
    has_quiz: bool = Field(description="A published quiz exists")
    quiz_state: str | None = Field(
        default=None,
        description="none | available | locked_read_required | in_progress | completed",
    )


class VerseDetailResponse(BaseModel):
    """GET /bible-verses/{id} — public projection plus manager extras.

    Manager-only extras (opens, reads, created_by_user, schedule,
    quiz_summary) are populated only for ADMIN/SERVANT callers.
    """

    id: UUID = Field(description="Verse id")
    title: str = Field(description="Display title")
    subtitle: str | None = Field(default=None, description="Subtitle")
    verse_reference: str = Field(description="Scripture reference")
    book: str = Field(description="Bible book name")
    chapter: int = Field(description="Chapter number")
    verse_start: int = Field(description="First verse number")
    verse_end: int | None = Field(default=None, description="Last verse number")
    text: str = Field(description="Verse text")
    reflection: str | None = Field(default=None, description="Reflection content")
    image: str | None = Field(default=None, description="Cover image URL")
    translation: str = Field(description="Translation code")
    status: VerseStatus = Field(description="Lifecycle status")
    published_at: datetime | None = Field(default=None, description="Publish time")
    week_start_date: date | None = Field(default=None, description="ISO week start")
    # Member engagement projection.
    is_read: bool = Field(default=False, description="Caller marked this verse read")
    # Manager-only extras.
    opens: int | None = Field(default=None, ge=0, description="[manager] Total opens")
    reads: int | None = Field(default=None, ge=0, description="[manager] Unique readers")
    created_by_user: CreatorBrief | None = Field(default=None, description="[manager] Created by")
    schedule: VerseScheduleBrief | None = Field(default=None, description="[manager] Schedule")
    quiz_summary: QuizSummary | None = Field(default=None, description="[manager] Quiz summary")
