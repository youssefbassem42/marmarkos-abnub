"""Notification copy builders (BR-5, BR-9, BR-10; plan §14.3)."""

from datetime import date

from app.modules.attendance.domain.enums import AttendanceStatus
from app.modules.notifications.application.copy import (
    attendance_recorded_copy,
    blog_comment_liked_copy,
    blog_post_liked_copy,
    blog_post_published_copy,
)

MEETING = date(2026, 8, 20)


def test_attendance_present_copy_is_bilingual() -> None:
    copy = attendance_recorded_copy(meeting_date=MEETING, status=AttendanceStatus.PRESENT)
    assert copy.title_ar == "تم تسجيل الحضور"
    assert copy.title_en == "Attendance Recorded"
    assert copy.message_ar == f"تم تسجيل حضورك في اجتماع {MEETING.isoformat()}."
    assert copy.message_en == (
        f"Your attendance for the meeting on {MEETING.isoformat()} has been recorded."
    )


def test_attendance_late_copy_mentions_late() -> None:
    copy = attendance_recorded_copy(meeting_date=MEETING, status=AttendanceStatus.LATE)
    assert "كمتأخر" in copy.message_ar
    assert "as late" in copy.message_en


def test_blog_like_copies_are_bilingual() -> None:
    post_copy = blog_post_liked_copy(actor_name="مريم")
    comment_copy = blog_comment_liked_copy(actor_name="مريم")

    assert post_copy.title_ar == "تم الإعجاب بمنشورك"
    assert post_copy.title_en == "Your post was liked"
    assert "مريم" in post_copy.message_ar
    assert "مريم" in post_copy.message_en
    assert comment_copy.title_ar == "تم الإعجاب بتعليقك"
    assert comment_copy.title_en == "Your comment was liked"
    assert "مريم" in comment_copy.message_ar
    assert "مريم" in comment_copy.message_en


def test_blog_post_published_copy_embeds_titles() -> None:
    copy = blog_post_published_copy(title_ar="قصة", title_en="A Story")
    assert copy.title_ar == "منشور جديد: قصة"
    assert copy.title_en == "New post: A Story"
    assert copy.message_ar == "تم نشر موضوع جديد. اقرأه الآن."
    assert copy.message_en == "A new post has been published. Read it now."


def test_every_copy_field_is_non_empty() -> None:
    for copy in (
        attendance_recorded_copy(meeting_date=MEETING, status=AttendanceStatus.PRESENT),
        attendance_recorded_copy(meeting_date=MEETING, status=AttendanceStatus.LATE),
        blog_post_published_copy(title_ar="ت", title_en="t"),
        blog_post_liked_copy(actor_name="عضو"),
        blog_comment_liked_copy(actor_name="عضو"),
    ):
        assert all([copy.title_ar, copy.title_en, copy.message_ar, copy.message_en])
