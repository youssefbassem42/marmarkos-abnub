"""SQLAlchemy ORM models for the bible module (Part 1 §4.2–§4.4)."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.bible.domain.enums import (
    NotificationDeliveryStatus,
    ScheduleStatus,
    VerseStatus,
)
from app.shared.infrastructure.persistence.base import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.quiz.infrastructure.persistence.models import Quiz
    from app.modules.users.infrastructure.persistence.models import User


class BibleVerse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bible_verses"
    __table_args__ = (
        # BR-2: chapter/verse bounds and an ordered verse range.
        CheckConstraint("chapter >= 1 AND chapter <= 150", name="ck_bible_verses_chapter"),
        CheckConstraint(
            "verse_end IS NULL OR verse_end >= verse_start",
            name="ck_bible_verses_verse_range",
        ),
        # D-2 removed uq_bible_verses_published_week: multiple published
        # verses may coexist and "This Week" is simply the newest one.
        Index(
            "ix_bible_verses_status_published_at",
            "status",
            text("published_at DESC"),
        ),
        Index("ix_bible_verses_created_by", "created_by"),
    )

    # Required content (BR-1).
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    verse_reference: Mapped[str] = mapped_column(String(120), nullable=False)
    book: Mapped[str] = mapped_column(String(60), nullable=False)
    chapter: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    verse_start: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional content (BR-1).
    subtitle: Mapped[str | None] = mapped_column(String(200))
    verse_end: Mapped[int | None] = mapped_column(SmallInteger)
    reflection: Mapped[str | None] = mapped_column(Text)
    image: Mapped[str | None] = mapped_column(String(500))
    translation: Mapped[str] = mapped_column(String(80), default="NIV", nullable=False)

    # Lifecycle (BR-3..BR-7): published_at is write-once and
    # week_start_date is derived from it at publish time (Monday ISO).
    status: Mapped[VerseStatus] = mapped_column(
        SAEnum(VerseStatus, native_enum=False, length=20),
        default=VerseStatus.DRAFT,
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    week_start_date: Mapped[date | None] = mapped_column(Date, index=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_by_user: Mapped["User | None"] = relationship()
    schedules: Mapped[list["VersePublicationSchedule"]] = relationship(
        back_populates="verse", cascade="all, delete-orphan"
    )
    views: Mapped[list["VerseView"]] = relationship(
        back_populates="verse", cascade="all, delete-orphan"
    )
    reads: Mapped[list["VerseRead"]] = relationship(
        back_populates="verse", cascade="all, delete-orphan"
    )
    quiz: Mapped["Quiz | None"] = relationship(
        back_populates="verse",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="raise",
    )


class VersePublicationSchedule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One scheduled publication attempt chain for a verse (BR-9..BR-12).

    At most one ``SCHEDULED`` row may exist per verse (partial unique
    index). Publication flips the row to ``PUBLISHED`` in the same
    transaction as the verse status change; failures increment
    ``attempts`` and are retried while ``attempts < 5`` (BR-11). Creator
    notification state lives here so a half-delivered notification is
    visible and retryable (BR-24).
    """

    __tablename__ = "verse_publication_schedules"
    __table_args__ = (
        Index(
            "uq_verse_publication_schedules_active",
            "verse_id",
            unique=True,
            postgresql_where=text("status = 'SCHEDULED'"),
        ),
        Index("ix_verse_publication_schedules_due", "status", "scheduled_at"),
    )

    verse_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bible_verses.id", ondelete="CASCADE"), nullable=False
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[ScheduleStatus] = mapped_column(
        SAEnum(ScheduleStatus, native_enum=False, length=20),
        default=ScheduleStatus.SCHEDULED,
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    attempts: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    notification_status: Mapped[NotificationDeliveryStatus] = mapped_column(
        SAEnum(NotificationDeliveryStatus, native_enum=False, length=20),
        default=NotificationDeliveryStatus.PENDING,
        nullable=False,
    )
    notification_attempts: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_user: Mapped["User | None"] = relationship()

    verse: Mapped[BibleVerse] = relationship(back_populates="schedules")


class VerseView(UUIDPrimaryKeyMixin, Base):
    """One recorded open of a published verse (BR-13, D-16).

    High-volume append-only table; opens are deduplicated per user per
    verse within ``VERSE_OPEN_DEDUPE_SECONDS`` by the repository, not by
    a constraint (repeats outside the window are legitimate rows).
    """

    __tablename__ = "verse_views"
    __table_args__ = (
        Index("ix_verse_views_verse_opened", "verse_id", "opened_at"),
        Index("ix_verse_views_verse_user", "verse_id", "user_id"),
        Index("ix_verse_views_user_opened", "user_id", "opened_at"),
    )

    verse_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bible_verses.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    verse: Mapped[BibleVerse] = relationship(back_populates="views")
    user: Mapped["User"] = relationship(back_populates="verse_views")


class VerseRead(UUIDPrimaryKeyMixin, Base):
    """The explicit "Mark as Read" action; exactly one row per user/verse.

    Doubles as the quiz gate (D-6) and the denominator of the read-rate
    metric (BR-14/BR-16).
    """

    __tablename__ = "verse_reads"
    __table_args__ = (
        Index("uq_verse_reads_verse_user", "verse_id", "user_id", unique=True),
        Index("ix_verse_reads_verse_read_at", "verse_id", "read_at"),
    )

    verse_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bible_verses.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    verse: Mapped[BibleVerse] = relationship(back_populates="reads")
    user: Mapped["User"] = relationship(back_populates="verse_reads")
