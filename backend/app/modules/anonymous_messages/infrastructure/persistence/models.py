"""SQLAlchemy ORM model for anonymous messages.

PRIVACY: this table intentionally stores NO user identity (no user_id,
email, phone or auth reference). Anonymity is enforced at the database
level: there is no column that could link a message back to a sender.
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("ix_anonymous_messages_status_created", "status", "created_at"),)
