"""The shared vocabulary of the quiz module.

``QuizStatus`` and ``AttemptStatus`` are spoken by the quiz module (which
writes them) and by the bible module (the feed shows the state of the
quiz of a verse). Both used to import each other for them - the cycle
ARCH-001 proves.
"""

from enum import StrEnum


class AttemptStatus(StrEnum):
    """Attempt lifecycle (Part 1 §4.6, V2 timing).

    COMPLETED: submitted by the user — the only way an attempt ends (V2).
    AUTO_FINISHED: legacy rows from the removed auto-finish logic (expiry
    lazy-touch / scheduler batch). Kept as a terminal read-only status so
    existing analytics/result pages still understand them.
    """

    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    AUTO_FINISHED = "AUTO_FINISHED"


class QuizStatus(StrEnum):
    """Quiz content lifecycle (Part 1 §4.5, BR-21)."""

    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"
