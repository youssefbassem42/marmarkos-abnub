"""Domain events for the users module."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar

from app.shared.domain.events import DomainEvent


@dataclass(frozen=True, slots=True)
class UserRegistered(DomainEvent):
    event_type: ClassVar[str] = "user.registered"
    aggregate_type: ClassVar[str] = "user"

    email: str
    first_name: str | None = None
    last_name: str | None = None


@dataclass(frozen=True, slots=True)
class UserBanned(DomainEvent):
    event_type: ClassVar[str] = "user.banned"
    aggregate_type: ClassVar[str] = "user"

    banned_by: uuid.UUID | None = None
    reason: str | None = None
    banned_until: datetime | None = None
