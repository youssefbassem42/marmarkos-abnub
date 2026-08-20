"""SQLAlchemy ORM models for the comments module.

Self-referencing replies: ``parent_comment_id IS NULL`` is a top-level
comment, otherwise a reply. Comments are moderated by status
(VISIBLE/HIDDEN/DELETED/FLAGGED), never physically deleted.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.comments.domain.enums.comment_status import CommentStatus
from app.shared.infrastructure.persistence.base import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.blog.infrastructure.persistence.models import BlogPost
    from app.modules.users.infrastructure.persistence.models import User


class Comment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "comments"

    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("blog_posts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), index=True, nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[CommentStatus] = mapped_column(
        SAEnum(CommentStatus, name="comment_status", native_enum=False, length=20),
        default=CommentStatus.VISIBLE,
        index=True,
        nullable=False,
    )

    post: Mapped["BlogPost"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship(back_populates="comments")
    parent: Mapped["Comment | None"] = relationship(
        back_populates="replies", remote_side="Comment.id"
    )
    replies: Mapped[list["Comment"]] = relationship(back_populates="parent")
