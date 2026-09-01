"""Publication schedule lifecycle (Part 1 §4.3, BR-9..BR-11)."""

from enum import StrEnum


class ScheduleStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    PUBLISHED = "PUBLISHED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"
