"""Verse lifecycle status (Part 1 §4.2, BR-5).

``native_enum=False`` keeps the column a plain VARCHAR so status sets
can evolve without PostgreSQL ALTER TYPE pain.
"""

from enum import StrEnum


class VerseStatus(StrEnum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"
