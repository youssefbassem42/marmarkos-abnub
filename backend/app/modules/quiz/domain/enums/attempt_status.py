"""Attempt lifecycle (Part 1 §4.6, BR-24..BR-30).

COMPLETED: submitted by the user inside the server-side window.
AUTO_FINISHED: expired (submit after expiry, lazy touch or scheduler
batch); still graded from the stored answers.
"""

from enum import StrEnum


class AttemptStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    AUTO_FINISHED = "AUTO_FINISHED"
