"""Presentation grouping over NotificationType for the feed tabs.

Frozen mapping (plan §3.4): ``announcements`` covers ANNOUNCEMENT and
BLOG_POST, ``reminders`` is ATTENDANCE, ``system`` is SYSTEM. The enum
itself never gains a new notification type.
"""

from enum import StrEnum


class NotificationTab(StrEnum):
    ALL = "all"
    UNREAD = "unread"
    ANNOUNCEMENTS = "announcements"
    REMINDERS = "reminders"
    SYSTEM = "system"
