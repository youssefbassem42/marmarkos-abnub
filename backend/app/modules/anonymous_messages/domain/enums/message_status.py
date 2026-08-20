from enum import StrEnum


class MessageStatus(StrEnum):
    """Lifecycle of an anonymous message submission."""

    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class TelegramStatus(StrEnum):
    """Delivery status of the Telegram forwarding step."""

    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
