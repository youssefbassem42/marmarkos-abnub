from enum import StrEnum


class NotificationType(StrEnum):
    BLOG_POST = "BLOG_POST"
    ANNOUNCEMENT = "ANNOUNCEMENT"
    ATTENDANCE = "ATTENDANCE"
    SYSTEM = "SYSTEM"
    # Phase 5: creator-only notification when a scheduled verse publishes.
    BIBLE_VERSE = "BIBLE_VERSE"
