"""Telegram formatter: escaping, placeholders, layout (plan §14.4)."""

import uuid
from datetime import UTC, datetime

from app.modules.anonymous_messages.infrastructure.telegram.formatter import (
    format_message,
)

WHEN = datetime(2026, 8, 20, 18, 30, tzinfo=UTC)
MID = uuid.UUID("12345678-90ab-cdef-1234-567890abcdef")


def test_layout_matches_frozen_format() -> None:
    text = format_message(
        message_id=MID,
        body="Please pray for us",
        sender_name="Mina",
        sender_phone="+201234567890",
        created_at=WHEN,
    )
    assert text.startswith("🕊️ <b>رسالة مجهولة جديدة</b> — New anonymous message")
    assert "Please pray for us" in text
    assert "الاسم / Name: Mina" in text
    assert "الهاتف / Phone: +201234567890" in text
    assert f"المعرّف / Ref: {MID.hex[:8]}" in text
    assert "الوقت / Time:" in text


def test_absent_fields_render_not_provided() -> None:
    text = format_message(
        message_id=MID,
        body="Hello",
        sender_name=None,
        sender_phone=None,
        created_at=WHEN,
    )
    assert "غير مذكور / not provided" in text
    assert "Name: غير مذكور / not provided" in text
    assert "Phone: غير مذكور / not provided" in text


def test_every_field_is_html_escaped() -> None:
    text = format_message(
        message_id=MID,
        body="<b>bold</b> & <script>alert(1)</script>",
        sender_name="A<b> & ",
        sender_phone=None,
        created_at=WHEN,
    )
    assert "<b>bold</b>" not in text.replace("<b>رسالة مجهولة جديدة</b>", "")
    assert "&lt;b&gt;bold&lt;/b&gt;" in text
    assert "&amp;" in text
    assert "<script>" not in text


def test_long_message_is_kept_intact() -> None:
    body = "x" * 1000
    text = format_message(
        message_id=MID, body=body, sender_name=None, sender_phone=None, created_at=WHEN
    )
    assert body in text
