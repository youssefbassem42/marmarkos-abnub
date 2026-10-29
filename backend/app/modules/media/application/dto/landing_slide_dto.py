"""Landing-slide request/response DTOs (plan §7.2).

The public projection carries the public fields only: no internal flag and
no timestamps the members do not need.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LandingSlideCreateRequest(BaseModel):
    """POST /admin/landing/slides body (the image URL is the uploaded file)."""

    image: str = Field(max_length=1000, description="Secure URL of the uploaded image")
    title: str | None = Field(default=None, max_length=200, description="Optional title (≤200)")
    subtitle: str | None = Field(
        default=None, max_length=300, description="Optional subtitle (≤300)"
    )


class LandingSlideUpdateRequest(BaseModel):
    """PATCH /admin/landing/slides/{id} body — all fields optional."""

    image: str | None = Field(
        default=None, max_length=1000, description="Secure URL of the uploaded image"
    )
    title: str | None = Field(default=None, max_length=200, description="Optional title (≤200)")
    subtitle: str | None = Field(
        default=None, max_length=300, description="Optional subtitle (≤300)"
    )
    active: bool | None = Field(default=None, description="Whether the slide is shown to members")


class LandingSlideReorderRequest(BaseModel):
    """POST /admin/landing/slides/reorder body — the ids in the wanted order."""

    ids: list[UUID] = Field(description="The slide ids in the wanted order")


class LandingSlidePublicItem(BaseModel):
    """Member-facing projection of a slide (public fields only)."""

    id: UUID = Field(description="Slide id")
    image: str = Field(description="Image URL")
    title: str | None = Field(default=None, description="Title")
    subtitle: str | None = Field(default=None, description="Subtitle")
    order: int = Field(description="Display order")


class LandingSlideAdminItem(BaseModel):
    """Admin projection of a slide, active flag and timestamps included."""

    id: UUID = Field(description="Slide id")
    image: str = Field(description="Image URL")
    title: str | None = Field(default=None, description="Title")
    subtitle: str | None = Field(default=None, description="Subtitle")
    order: int = Field(description="Display order")
    active: bool = Field(description="Whether the slide is shown to members")
    created_at: datetime = Field(description="Creation timestamp (UTC)")
    updated_at: datetime = Field(description="Last update timestamp (UTC)")
