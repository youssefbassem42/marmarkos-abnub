"""Transactional outbox for reliable asynchronous notifications.

Domain events are persisted into ``outbox_events`` inside the same
database transaction that changes the aggregate. A background worker
(polling this table) later dispatches them to in-app notifications,
email providers and other side effects.
"""

import uuid
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from enum import Enum, StrEnum
from typing import Any

from sqlalchemy import DateTime, Index, Integer, String, Text, Uuid, func, select, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.domain.events import DomainEvent
from app.shared.infrastructure.persistence.base import Base, UUIDPrimaryKeyMixin

_EMPTY_PAYLOAD = text("'{}'::jsonb")


def _json_safe(value: Any) -> Any:
    """Convert dataclass payload values into JSON-serializable primitives."""
    if isinstance(value, (uuid.UUID, datetime, date, timedelta)):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


class OutboxStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class OutboxEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "outbox_events"
    __table_args__ = (
        Index("ix_outbox_events_dispatch", "status", "available_at"),
        Index("ix_outbox_events_aggregate", "aggregate_type", "aggregate_id"),
    )

    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    aggregate_type: Mapped[str] = mapped_column(String(100), nullable=False)
    aggregate_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=_EMPTY_PAYLOAD, nullable=False
    )
    status: Mapped[OutboxStatus] = mapped_column(
        # native_enum=False keeps the column portable across Neon/local PG
        # and avoids ALTER TYPE pain when statuses evolve.
        SAEnum(OutboxStatus, name="outbox_status", native_enum=False, length=20),
        default=OutboxStatus.PENDING,
        nullable=False,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    @classmethod
    def from_domain_event(cls, event: DomainEvent) -> "OutboxEvent":
        return cls(
            event_type=event.event_type,
            aggregate_type=event.aggregate_type,
            aggregate_id=event.aggregate_id,
            payload=_json_safe(asdict(event)),
        )


class OutboxRepository:
    """Outbox persistence used by the Unit of Work and the dispatcher worker."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, event: OutboxEvent) -> None:
        self._session.add(event)

    async def claim_pending(self, limit: int = 50) -> list[OutboxEvent]:
        """Claim due events atomically; the worker owns them until processed."""
        stmt = (
            select(OutboxEvent)
            .where(
                OutboxEvent.status == OutboxStatus.PENDING,
                OutboxEvent.available_at <= func.now(),
            )
            .order_by(OutboxEvent.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def mark_processed(self, event: OutboxEvent) -> None:
        event.status = OutboxStatus.PROCESSED
        event.processed_at = datetime.now()
        await self._session.flush()

    async def mark_failed(
        self, event: OutboxEvent, error: str, retry_after_seconds: int = 300
    ) -> None:
        event.status = OutboxStatus.FAILED
        event.attempts += 1
        event.last_error = error[:2000]
        event.available_at = datetime.now(UTC) + timedelta(seconds=retry_after_seconds)
        await self._session.flush()

    async def list_pending(self, limit: int = 100) -> list[OutboxEvent]:
        result = await self._session.execute(
            select(OutboxEvent)
            .where(OutboxEvent.status == OutboxStatus.PENDING)
            .order_by(OutboxEvent.created_at)
            .limit(limit)
        )
        return list(result.scalars().all())
