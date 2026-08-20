"""Domain events for the blog module."""

import uuid
from dataclasses import dataclass
from typing import ClassVar

from app.shared.domain.events import DomainEvent


@dataclass(frozen=True, slots=True)
class BlogPostPublished(DomainEvent):
    event_type: ClassVar[str] = "blog.post_published"
    aggregate_type: ClassVar[str] = "blog_post"

    author_id: uuid.UUID
    title: str
    slug: str
