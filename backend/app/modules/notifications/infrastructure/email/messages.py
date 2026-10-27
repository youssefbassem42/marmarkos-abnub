"""Re-export of the mail texts (the code moved to the shared kernel)."""

from app.shared.infrastructure.email.messages import (
    new_post_email,
    notification_email,
    password_reset_email,
    verification_email,
    welcome_email,
)

__all__ = [
    "new_post_email",
    "notification_email",
    "password_reset_email",
    "verification_email",
    "welcome_email",
]
