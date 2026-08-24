"""SQLAlchemy ORM models for the auth module."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.auth.domain.enums.auth_token_purpose import AuthTokenPurpose
from app.shared.infrastructure.persistence.base import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.users.infrastructure.persistence.models import User


class RefreshToken(UUIDPrimaryKeyMixin, Base):
    """Persisted refresh-token session.

    Only the SHA-256 hash of the token is stored; the raw token travels
    only in the HttpOnly cookie. Revocation is explicit (``revoked_at``)
    so logout and token reuse are detectable.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class AuthToken(TimestampMixin, UUIDPrimaryKeyMixin, Base):
    """Single-use action token for email-verified flows.

    Covers email verification and password reset: only the SHA-256 hash
    is stored, the raw token exists solely inside the emailed link.
    Consuming sets ``used_at``; issuing a new link of the same purpose
    invalidates all previous pending ones for that user.
    """

    __tablename__ = "auth_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    purpose: Mapped[AuthTokenPurpose] = mapped_column(
        SAEnum(AuthTokenPurpose, native_enum=False, length=30), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
