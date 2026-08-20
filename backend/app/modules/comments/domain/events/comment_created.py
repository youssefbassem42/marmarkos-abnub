"""Domain events for the comments module."""

import uuid
from dataclasses import dataclass
from typing import ClassVar

from app.shared.domain.events import DomainEvent


@dataclass(frozen=True, slots=True)
class CommentCreated(DomainEvent):
    event_type: ClassVar[str] = "comment.created"
    aggregate_type: ClassVar[str] = "comment"

    post_id: uuid.UUID
    author_id: uuid.UUID
    parent_comment_id: uuid.UUID | None = None
