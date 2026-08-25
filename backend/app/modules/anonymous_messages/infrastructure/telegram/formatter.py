"""Renders an anonymous message for its single Telegram destination.

Layout is frozen (plan §14.4). Every interpolated value is HTML-escaped;
absent optional fields render as an explicit "not provided" line, never
as empty space (BR-11: no identity beyond what the sender typed).
"""

import html
import uuid
from datetime import datetime

from app.core.time.clock import to_local
from app.modules.anonymous_messages.infrastructure.persistence.models import AnonymousMessage

_NOT_PROVIDED = "غير مذكور / not provided"


def _esc(value: object) -> str:
    return html.escape(str(value), quote=False)


def format_message(
    *,
    message_id: uuid.UUID,
    body: str,
    sender_name: str | None,
    sender_phone: str | None,
    created_at: datetime,
) -> str:
    # Platform-local wall clock (Africa/Cairo), e.g. "2026-08-20 18:30 EET".
    stamp = to_local(created_at).strftime("%Y-%m-%d %H:%M %Z")
    return (
        "🕊️ <b>رسالة مجهولة جديدة</b> — New anonymous message\n"
        "\n"
        f"{_esc(body)}\n"
        "\n"
        "—\n"
        f"الاسم / Name: {_esc(sender_name or _NOT_PROVIDED)}\n"
        f"الهاتف / Phone: {_esc(sender_phone or _NOT_PROVIDED)}\n"
        f"المعرّف / Ref: {_esc(message_id.hex[:8])}\n"
        f"الوقت / Time: {stamp}"
    )


def format_anonymous_message(message: AnonymousMessage) -> str:
    """Convenience overload taking an ``AnonymousMessage`` row."""
    return format_message(
        message_id=message.id,
        body=message.message,
        sender_name=message.sender_name,
        sender_phone=message.sender_phone,
        created_at=message.created_at,
    )
