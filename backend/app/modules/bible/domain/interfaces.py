"""Repository interfaces for the bible module."""

import uuid
from datetime import date
from typing import Protocol

from app.modules.bible.infrastructure.persistence.models import BibleVerse


class BibleVerseRepository(Protocol):
    async def add(self, verse: BibleVerse) -> None: ...

    async def get_by_id(self, verse_id: uuid.UUID) -> BibleVerse | None: ...

    async def get_published_for_week(self, week_start_date: date) -> BibleVerse | None: ...

    async def get_current_published(self, today: date | None = None) -> BibleVerse | None: ...
