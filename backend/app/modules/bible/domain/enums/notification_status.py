"""Creator-notification delivery state on a schedule row (BR-11, BR-24)."""

from enum import StrEnum


class NotificationDeliveryStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
