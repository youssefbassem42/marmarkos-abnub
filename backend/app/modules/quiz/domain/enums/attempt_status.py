"""Attempt lifecycle (Part 1 §4.6, V2 timing).

COMPLETED: submitted by the user — the only way an attempt ends (V2).
AUTO_FINISHED: legacy rows from the removed auto-finish logic (expiry
lazy-touch / scheduler batch). Kept as a terminal read-only status so
existing analytics/result pages still understand them.
"""

from enum import StrEnum


class AttemptStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    AUTO_FINISHED = "AUTO_FINISHED"
