"""Shared SQLAlchemy persistence foundation: declarative Base and mixins."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Single declarative base for the whole modular monolith."""


class UUIDPrimaryKeyMixin:
    """PostgreSQL-native UUID primary key generated on the application side.

    ``default=uuid.uuid4`` keeps the strategy portable (Neon, local PG,
    SQLite test doubles) while remaining opaque to the outside world.
    """

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    """Timezone-aware created/updated timestamps.

    All timestamps are stored as ``timestamptz`` (UTC). ``updated_at`` is
    maintained by PostgreSQL ``now()`` via ON UPDATE, so application code
    never has to manage it manually.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CreatedAtMixin:
    """created_at only, for immutable records (attendance, likes, audit)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
