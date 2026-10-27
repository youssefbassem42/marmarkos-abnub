"""Re-export of the mail service (the code moved to the shared kernel)."""

from app.shared.infrastructure.email.service import EmailService

__all__ = ["EmailService"]
