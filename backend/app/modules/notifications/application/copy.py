"""Bilingual notification copy builders.

Copy is code, not i18n: every notification stores all four strings at
creation time (D-6), so the feed and the emails always agree. Keep the
exact strings from plan §14.3. Arabic first.
"""

from dataclasses import dataclass
from datetime import date

from app.shared.contracts.attendance import AttendanceStatus


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


def blog_post_liked_copy(*, actor_name: str) -> NotificationCopy:
    """The bell card for a member who liked a blog post."""
    return NotificationCopy(
        title_ar="تم الإعجاب بمنشورك",
        title_en="Your post was liked",
        message_ar=f"أعجب {actor_name} بمنشورك.",
        message_en=f"{actor_name} liked your post.",
    )


def blog_comment_liked_copy(*, actor_name: str) -> NotificationCopy:
    """The bell card for a member who liked a comment or a reply."""
    return NotificationCopy(
        title_ar="تم الإعجاب بتعليقك",
        title_en="Your comment was liked",
        message_ar=f"أعجب {actor_name} بتعليقك.",
        message_en=f"{actor_name} liked your comment.",
    )


def blog_post_published_copy(
    *, title_ar: str, title_en: str, excerpt: str | None = None
) -> NotificationCopy:
    """BR-73: the Arabic notice announcing a new blog post."""
    if excerpt:
        message_ar = f"تم نشر موضوع جديد: {excerpt} اقرأه الآن."
        message_en = f"A new post has been published: {excerpt} Read it now."
    else:
        message_ar = "تم نشر موضوع جديد. اقرأه الآن."
        message_en = "A new post has been published. Read it now."
    return NotificationCopy(
        title_ar=f"منشور جديد: {title_ar}",
        title_en=f"New post: {title_en}",
        message_ar=message_ar,
        message_en=message_en,
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
