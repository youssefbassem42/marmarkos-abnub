"""The mail client - now a shared service (ARCH-001).

The e-mail client is infrastructure, not the business of the
notifications module: the auth module and the users module send mails
too. It therefore lives in ``app/shared/infrastructure/email`` and this
package only re-exports the names, so every import path keeps working.
"""

from app.shared.infrastructure.email.messages import (
    notification_email,
    password_reset_email,
    verification_email,
    welcome_email,
)
from app.shared.infrastructure.email.sender import (
    BrevoEmailSender,
    EmailSender,
    GmailEmailSender,
    LoggingEmailSender,
    get_email_sender,
)
from app.shared.infrastructure.email.service import EmailService
from app.shared.infrastructure.email.templates import (
    BrandEmailContent,
    EmailSection,
    render_brand_email,
)

__all__ = [
    "BrevoEmailSender",
    "BrandEmailContent",
    "EmailSection",
    "EmailSender",
    "EmailService",
    "GmailEmailSender",
    "LoggingEmailSender",
    "get_email_sender",
    "notification_email",
    "password_reset_email",
    "render_brand_email",
    "verification_email",
    "welcome_email",
]
