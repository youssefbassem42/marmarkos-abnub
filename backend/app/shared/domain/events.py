"""Lightweight domain event abstraction.

Domain events are plain frozen dataclasses. They carry no SQLAlchemy or
infrastructure dependency. The Unit of Work persists them into the
``outbox_events`` table as part of the same database transaction that
produces the aggregate change (transactional outbox).
"""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import ClassVar


@dataclass(frozen=True, slots=True, kw_only=True)
class DomainEvent:
    """Base class for all domain events.

    Subclasses must set ``event_type`` and ``aggregate_type`` class
    variables and declare the payload fields they need. All fields are
    keyword-only so subclass fields never collide with base defaults.
    """

    aggregate_id: uuid.UUID
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    event_type: ClassVar[str] = ""
    aggregate_type: ClassVar[str] = ""

    def __post_init__(self) -> None:
        if not self.event_type:
            raise ValueError("DomainEvent subclasses must define event_type")
        if not self.aggregate_type:
            raise ValueError("DomainEvent subclasses must define aggregate_type")
