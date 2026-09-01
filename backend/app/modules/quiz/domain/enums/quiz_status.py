"""Quiz content lifecycle (Part 1 §4.5, BR-21)."""

from enum import StrEnum


class QuizStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"
