"""Bilingual notification copy builders.

Copy is code, not i18n: every notification stores all four strings at
creation time (D-6), so the feed and the emails always agree. Keep the
exact strings from plan §14.3. Arabic first.
"""

from dataclasses import dataclass
from datetime import date

from app.modules.attendance.domain.enums import AttendanceStatus


@dataclass(frozen=True)
class NotificationCopy:
    title_ar: str
    title_en: str
    message_ar: str
    message_en: str


def attendance_recorded_copy(*, meeting_date: date, status: AttendanceStatus) -> NotificationCopy:
    """BR-10: the per-user reminder sent when attendance is recorded."""
    if status is AttendanceStatus.LATE:
        return NotificationCopy(
            title_ar="تم تسجيل الحضور",
            title_en="Attendance Recorded",
            message_ar=f"تم تسجيل حضورك في اجتماع {meeting_date.isoformat()} كمتأخر.",
            message_en=(
                "Your attendance for the meeting on "
                f"{meeting_date.isoformat()} has been recorded as late."
            ),
        )
    return NotificationCopy(
        title_ar="تم تسجيل الحضور",
        title_en="Attendance Recorded",
        message_ar=f"تم تسجيل حضورك في اجتماع {meeting_date.isoformat()}.",
        message_en=(
            f"Your attendance for the meeting on {meeting_date.isoformat()} has been recorded."
        ),
    )


def blog_post_published_copy(*, title_ar: str, title_en: str) -> NotificationCopy:
    """BR-9: the broadcast announcing a new blog post (dormant, D-13)."""
    return NotificationCopy(
        title_ar=f"منشور جديد: {title_ar}",
        title_en=f"New post: {title_en}",
        message_ar="تم نشر موضوع جديد. اقرأه الآن.",
        message_en="A new post has been published. Read it now.",
    )


def verse_published_copy(*, verse_reference: str, published_at: date) -> NotificationCopy:
    """Phase 5 (US-028): creator-only notice that the scheduled verse went live."""
    return NotificationCopy(
        title_ar="تم نشر الآية المجدولة",
        title_en="Your scheduled Bible Verse is live",
        message_ar=(
            f"تم نشر آية الكتاب المقدس ({verse_reference}) تلقائيًا بتاريخ "
            f"{published_at.isoformat()}."
        ),
        message_en=(
            f"Your scheduled Bible Verse ({verse_reference}) was automatically "
            f"published on {published_at.isoformat()}."
        ),
    )
