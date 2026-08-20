"""Repository interface for the comments module."""

import uuid
from typing import Protocol

from app.modules.comments.domain.enums.comment_status import CommentStatus
from app.modules.comments.infrastructure.persistence.models import Comment


class CommentRepository(Protocol):
    async def get_by_id(self, comment_id: uuid.UUID) -> Comment | None: ...

    async def add(self, comment: Comment) -> None: ...

    async def list_by_post(
        self, post_id: uuid.UUID, include_hidden: bool = False
    ) -> list[Comment]: ...

    async def set_status(self, comment: Comment, status: CommentStatus) -> None: ...

    async def count_for_post(self, post_id: uuid.UUID) -> int: ...
