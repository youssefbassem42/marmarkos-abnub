"""Blog-post request and response DTOs (Phase 7.2).

The database calls the taxonomy categories; the product calls it tags
(D-4).  The public names of this contract therefore use ``tag`` and
``tags`` without changing the existing tables.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _clean_cover_image(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if not cleaned.startswith("https://"):
        raise ValueError("cover image must be an https URL")
    return cleaned


def _clean_tags(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    cleaned = [" ".join(tag.split()) for tag in value]
    if any(not tag for tag in cleaned):
        raise ValueError("tag names must not be empty")
    if len(set(cleaned)) != len(cleaned):
        raise ValueError("tag names must not repeat")
    return cleaned


class BlogPostCreateRequest(BaseModel):
    """POST /admin/blog/posts body."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255, description="Post title")
    excerpt: str | None = Field(
        default=None,
        max_length=500,
        description="Short summary shown on the post card",
    )
    body: str = Field(min_length=1, description="Post body")
    cover_image: str | None = Field(
        default=None,
        max_length=500,
        description="Secure URL of the uploaded cover image",
    )
    tags: list[str] = Field(default_factory=list, description="Tag names")
    published_at: datetime | None = Field(
        default=None,
        description="Publication date; a future date schedules the post",
    )

    @field_validator("cover_image")
    @classmethod
    def _cover_image(cls, value: str | None) -> str | None:
        return _clean_cover_image(value)

    @field_validator("tags")
    @classmethod
    def _tags(cls, value: list[str]) -> list[str]:
        cleaned = _clean_tags(value)
        assert cleaned is not None
        return cleaned


class BlogPostUpdateRequest(BaseModel):
    """PATCH /admin/blog/posts/{id} body; omitted fields stay unchanged."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=255)
    excerpt: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, min_length=1)
    cover_image: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = Field(default=None)
    published_at: datetime | None = Field(default=None)

    @field_validator("cover_image")
    @classmethod
    def _cover_image(cls, value: str | None) -> str | None:
        return _clean_cover_image(value)

    @field_validator("tags")
    @classmethod
    def _tags(cls, value: list[str] | None) -> list[str] | None:
        return _clean_tags(value)


class BlogPostScheduleRequest(BaseModel):
    """POST /admin/blog/posts/{id}/schedule body."""

    published_at: datetime = Field(description="Future publication date")


class BlogTagResponse(BaseModel):
    """One tag exposed by the blog API."""

    id: UUID = Field(description="Tag id")
    name: str = Field(description="Tag name")
    slug: str = Field(description="URL-safe tag name")


class BlogAuthorResponse(BaseModel):
    """The public identity of a post author."""

    id: UUID = Field(description="Author id")
    full_name: str = Field(description="Author display name")


class BlogPostSummaryResponse(BaseModel):
    """A post in the member-facing list."""

    id: UUID = Field(description="Post id")
    title: str = Field(description="Post title")
    excerpt: str | None = Field(default=None, description="Post summary")
    cover_image: str | None = Field(default=None, description="Cover image URL")
    tags: list[BlogTagResponse] = Field(description="Tags carried by the post")
    published_at: datetime | None = Field(default=None, description="Publication date")
    author: BlogAuthorResponse = Field(description="Post author")


class BlogPostDetailResponse(BaseModel):
    """The detail of a published post."""

    id: UUID = Field(description="Post id")
    title: str = Field(description="Post title")
    excerpt: str | None = Field(default=None, description="Post summary")
    body: str = Field(description="Post body")
    cover_image: str | None = Field(default=None, description="Cover image URL")
    tags: list[BlogTagResponse] = Field(description="Tags carried by the post")
    published_at: datetime | None = Field(default=None, description="Publication date")
    author: BlogAuthorResponse = Field(description="Post author")


class BlogPostAdminResponse(BaseModel):
    """A post as the administration sees it."""

    id: UUID = Field(description="Post id")
    title: str = Field(description="Post title")
    excerpt: str | None = Field(default=None, description="Post summary")
    body: str = Field(description="Post body")
    cover_image: str | None = Field(default=None, description="Cover image URL")
    tags: list[BlogTagResponse] = Field(description="Tags carried by the post")
    status: str = Field(description="Lifecycle status")
    published_at: datetime | None = Field(default=None, description="Publication date")
    author: BlogAuthorResponse = Field(description="Post author")
    author_id: UUID = Field(description="Author id")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")


class BlogImageUploadResponse(BaseModel):
    """The secure URL returned after a cover upload."""

    url: str = Field(description="Secure URL of the uploaded image")
