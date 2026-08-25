"""SQLAlchemy ORM model for anonymous messages.

PRIVACY: this table stores NO account linkage (no user_id, author_id,
email, IP, user agent or session reference), ever — not even for a
signed-in submitter. ``sender_name`` and ``sender_phone`` are optional,
self-declared free text typed by the sender; nothing else identity-
adjacent may ever be added to this table.
"""

from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.anonymous_messages.domain.enums.message_status import (
    MessageStatus,
    TelegramStatus,
)
from app.shared.infrastructure.persistence.base import Base, UUIDPrimaryKeyMixin


class AnonymousMessage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "anonymous_messages"

    message: Mapped[str] = mapped_column(Text, nullable=False)
    sender_name: Mapped[str | None] = mapped_column(String(120))
    sender_phone: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[MessageStatus] = mapped_column(
        SAEnum(MessageStatus, name="message_status", native_enum=False, length=20),
        default=MessageStatus.PENDING,
        nullable=False,
    )
    telegram_status: Mapped[TelegramStatus] = mapped_column(
        SAEnum(TelegramStatus, name="telegram_status", native_enum=False, length=20),
        default=TelegramStatus.PENDING,
        nullable=False,
    )
    telegram_message_id: Mapped[str | None] = mapped_column(String(100))
    attempts: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("ix_anonymous_messages_status_created", "status", "created_at"),)
