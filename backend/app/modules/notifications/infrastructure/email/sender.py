"""Re-export of the mail senders (the code moved to the shared kernel)."""

from app.shared.infrastructure.email.sender import (
    BrevoEmailSender,
    EmailSender,
    GmailEmailSender,
    LoggingEmailSender,
    get_email_sender,
)

__all__ = [
    "BrevoEmailSender",
    "EmailSender",
    "GmailEmailSender",
    "LoggingEmailSender",
    "get_email_sender",
]
