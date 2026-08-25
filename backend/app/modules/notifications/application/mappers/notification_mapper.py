"""Explicit mappers from notification entities to API DTOs."""

import uuid
from typing import Any

from app.modules.notifications.application.dto.notification_dto import NotificationResponse
from app.modules.notifications.infrastructure.persistence.models import Notification

_ALLOWED_DATA_KEYS = frozenset({"icon", "cta_url", "post_id", "slug", "meeting_date"})

# data.icon may override the glyph only within the type's accent, and only
# from this allowlist (plan §3.5); anything else is dropped before the
# payload can reach the DOM.
_ICON_ALLOWLIST = frozenset(
    {
        "Megaphone",
        "BookOpen",
        "CalendarCheck",
        "ShieldAlert",
        "Bell",
        "Users",
        "MessageSquare",
        "Trophy",
        "Heart",
        "Clock",
    }
)


def sanitise_notification_data(data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Keep only the known-safe keys; drop arbitrary JSONB payloads."""
    if not data:
        return None
    cleaned = {key: value for key, value in data.items() if key in _ALLOWED_DATA_KEYS}
    if "icon" in cleaned and cleaned["icon"] not in _ICON_ALLOWLIST:
        del cleaned["icon"]
    return cleaned or None


def map_notification_to_response(
    notification: Notification, *, read_ids: set[uuid.UUID]
) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        type=notification.type.value,
        title_ar=notification.title,
        title_en=notification.title_en,
        message_ar=notification.message,
        message_en=notification.message_en,
        data=sanitise_notification_data(notification.data),
        is_read=notification.id in read_ids,
        is_broadcast=notification.user_id is None,
        created_at=notification.created_at,
    )
