"""API DTOs for the notifications module. Field names are frozen (plan §3.7)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    title_ar: str
    title_en: str
    message_ar: str
    message_en: str
    data: dict[str, Any] | None
    is_read: bool
    is_broadcast: bool
    created_at: datetime


class NotificationTabCounts(BaseModel):
    all: int
    unread: int
    announcements: int
    reminders: int
    system: int


class NotificationSummaryResponse(BaseModel):
    unread_count: int
    tab_counts: NotificationTabCounts


class MarkReadResponse(BaseModel):
    marked: int


class PushNotificationRequest(BaseModel):
    title_ar: str = Field(min_length=3, max_length=255)
    title_en: str = Field(min_length=3, max_length=255)
    message_ar: str = Field(min_length=3, max_length=2000)
    message_en: str = Field(min_length=3, max_length=2000)
    cta_url: str | None = Field(default=None, max_length=500)
    send_email: bool = False


class PushNotificationResponse(BaseModel):
    notification_id: uuid.UUID
    recipients: int
    emails_sent: int
    emails_failed: int
