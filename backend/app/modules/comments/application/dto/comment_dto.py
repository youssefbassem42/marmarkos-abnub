"""Request and response DTOs for the comments of a blog post."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CommentCreateRequest(BaseModel):
    """The body of a new comment or reply."""

    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(
        min_length=1,
        max_length=100_000,
        description="Sanitized HTML with at most 500 visible words",
    )
    parent_comment_id: UUID | None = Field(
        default=None,
        description="The comment being replied to; null creates a top-level comment",
    )


class CommentUpdateRequest(BaseModel):
    """The body of an edit made by the owner of a comment."""

    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(
        min_length=1,
        max_length=100_000,
        description="Sanitized HTML with at most 500 visible words",
    )


class CommentAuthorResponse(BaseModel):
    """The public identity of a comment author."""

    id: UUID = Field(description="Author id")
    full_name: str = Field(description="Author display name")


class CommentLikeResponse(BaseModel):
    """The active likes of one comment or reply."""

    comment_id: UUID = Field(description="Comment id")
    likes_count: int = Field(ge=0, description="Number of active likes")
    liked: bool = Field(description="Whether the caller liked the comment")


class CommentResponse(BaseModel):
    """One comment and the replies nested underneath it."""

    id: UUID = Field(description="Comment id")
    post_id: UUID = Field(description="Post id")
    parent_comment_id: UUID | None = Field(default=None, description="Parent comment id")
    content: str = Field(description="Safe comment HTML")
    status: str = Field(description="Comment moderation status")
    author: CommentAuthorResponse = Field(description="Comment author")
    likes_count: int = Field(ge=0, description="Number of active likes")
    liked: bool = Field(description="Whether the caller liked the comment")
    replies: list[CommentResponse] = Field(default_factory=list, description="Nested replies")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")
