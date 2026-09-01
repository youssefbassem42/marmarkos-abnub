"""Domain events for the bible module (US-028, Part 1 §4.7)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import ClassVar

from app.shared.domain.events import DomainEvent


@dataclass(frozen=True, slots=True)
class BibleVersePublished(DomainEvent):
    """A verse became PUBLISHED; the creator is notified via the outbox.

    Emitted inside the same transaction that moves the verse and its
    schedule to PUBLISHED, so the email/in-app notification can never
    be sent for a publication that did not commit. ``trigger`` records
    whether the publication came from the cron tick or a manual publish.
    """

    event_type: ClassVar[str] = "bible_verse.published"
    aggregate_type: ClassVar[str] = "bible_verse"

    verse_id: uuid.UUID
    schedule_id: uuid.UUID | None
    creator_id: uuid.UUID | None
    verse_reference: str
    title: str
    published_at: datetime
    trigger: str = "scheduled"
