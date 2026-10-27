"""Re-export of the mail templates (the code moved to the shared kernel)."""

from app.shared.infrastructure.email.templates import (
    BrandEmailContent,
    EmailSection,
    render_brand_email,
)

__all__ = ["BrandEmailContent", "EmailSection", "render_brand_email"]
