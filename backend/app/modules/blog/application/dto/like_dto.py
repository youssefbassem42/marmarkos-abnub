"""Response DTOs for the likes of a blog post."""

from uuid import UUID

from pydantic import BaseModel, Field


class LikeResponse(BaseModel):
    """The number of active likes and the caller's own like state."""

    post_id: UUID = Field(description="Post id")
    likes_count: int = Field(ge=0, description="Number of active likes")
    liked: bool = Field(description="Whether the signed-in member likes the post")
