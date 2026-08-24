"""Mail service component for Marmarkos Abnub.

One branded layout (``templates``), dynamic per-case copy
(``messages``) and pluggable delivery (``sender``), orchestrated by
``EmailService``.
"""

from app.modules.notifications.infrastructure.email.messages import (
    notification_email,
    password_reset_email,
    verification_email,
    welcome_email,
)
from app.modules.notifications.infrastructure.email.sender import (
    BrevoEmailSender,
    EmailSender,
    GmailEmailSender,
    LoggingEmailSender,
    get_email_sender,
)
from app.modules.notifications.infrastructure.email.service import EmailService
from app.modules.notifications.infrastructure.email.templates import (
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
