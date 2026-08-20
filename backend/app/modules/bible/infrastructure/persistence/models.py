"""SQLAlchemy ORM models for the bible module."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.infrastructure.persistence.base import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.users.infrastructure.persistence.models import User


class BibleVerse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bible_verses"
    __table_args__ = (
        # At most one *published* verse per week; drafts for the same week
        # are allowed. Enforced at the database level.
        Index(
            "uq_bible_verses_published_week",
            "week_start_date",
            unique=True,
            postgresql_where=text("is_published"),
        ),
    )

    verse_reference: Mapped[str] = mapped_column(String(120), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    translation: Mapped[str] = mapped_column(String(80), default="NIV", nullable=False)
    image: Mapped[str | None] = mapped_column(String(500))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    week_start_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_by_user: Mapped["User | None"] = relationship()
