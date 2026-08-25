"""SQLAlchemy ORM models for the notifications module.

Per-user notification rows; ``user_id IS NULL`` represents a broadcast
visible to every user (the bell query is ``user_id = me OR user_id IS
NULL``). Simple and scalable for the MVP; an event/delivery split can be
introduced later if fan-out becomes heavy.

Every row carries both languages: ``title``/``message`` are the Arabic
copy, ``title_en``/``message_en`` the English copy; both are required.

Read state is per user in ``notification_reads``. The ``read_at`` column
below is LEGACY: application code must never write or read it.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Index, PrimaryKeyConstraint, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.shared.infrastructure.persistence.base import (
    Base,
    CreatedAtMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.users.infrastructure.persistence.models import User


class Notification(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_created_at", "created_at"),
    )

    # NULL = broadcast/system notification delivered to every user.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True
    )
    type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, name="notification_type", native_enum=False, length=30),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    message_en: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    # LEGACY (per-user read state lives in NotificationRead). Never written.
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    user: Mapped["User | None"] = relationship(back_populates="notifications")


class NotificationRead(Base):
    """One row per (notification, user) that has read that notification."""

    __tablename__ = "notification_reads"
    __table_args__ = (
        PrimaryKeyConstraint("notification_id", "user_id"),
        Index("ix_notification_reads_user", "user_id"),
    )

    notification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
