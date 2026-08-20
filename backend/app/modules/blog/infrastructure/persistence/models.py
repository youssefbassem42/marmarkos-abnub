"""SQLAlchemy ORM models for the blog module.

Posts are archived, not deleted. Categories provide filtering; tags are
deferred until filtering demand justifies them (documented in
docs/database/DATABASE_DESIGN.md).
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.blog.domain.enums.post_status import PostStatus
from app.shared.infrastructure.persistence.base import (
    Base,
    CreatedAtMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.comments.infrastructure.persistence.models import Comment
    from app.modules.users.infrastructure.persistence.models import User


class BlogPost(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "blog_posts"
    __table_args__ = (Index("ix_blog_posts_status_published_at", "status", "published_at"),)

    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    excerpt: Mapped[str | None] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    cover_image: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[PostStatus] = mapped_column(
        SAEnum(PostStatus, name="post_status", native_enum=False, length=20),
        default=PostStatus.DRAFT,
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    author: Mapped["User"] = relationship(back_populates="blog_posts")
    comments: Mapped[list["Comment"]] = relationship(back_populates="post")
    likes: Mapped[list["BlogPostLike"]] = relationship(back_populates="post")
    categories: Mapped[list["BlogCategory"]] = relationship(
        secondary="blog_post_categories", back_populates="posts"
    )


class BlogCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "blog_categories"

    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))

    posts: Mapped[list["BlogPost"]] = relationship(
        secondary="blog_post_categories", back_populates="categories"
    )


class BlogPostCategory(Base):
    """Many-to-many link between posts and categories (composite PK)."""

    __tablename__ = "blog_post_categories"

    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("blog_posts.id", ondelete="CASCADE"), primary_key=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("blog_categories.id", ondelete="CASCADE"), primary_key=True
    )


class BlogPostLike(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "blog_post_likes"
    __table_args__ = (
        # A user can like a post at most once.
        Index("uq_blog_post_likes_post_user", "post_id", "user_id", unique=True),
    )

    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    post: Mapped["BlogPost"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship(back_populates="blog_likes")
