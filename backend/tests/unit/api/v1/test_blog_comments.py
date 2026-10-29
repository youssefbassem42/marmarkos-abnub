"""Blog-comment API and content-policy tests (Phase 7.6)."""

from __future__ import annotations

from app.modules.comments.application.services.comment_content import (
    count_comment_words,
    sanitize_comment_html,
)


def test_the_comment_policy_keeps_the_small_safe_html_vocabulary() -> None:
    value = (
        "<p>مرحبا <strong>بالعالم</strong> "
        '<span style="color: var(--brand-navy)">وملون</span></p>'
        "<ul><li>عنصر</li></ul>"
        '<a href="https://example.com/path">رابط</a>'
    )

    assert sanitize_comment_html(value) == (
        "<p>مرحبا <strong>بالعالم</strong> "
        '<span style="color: var(--brand-navy)">وملون</span></p>'
        "<ul><li>عنصر</li></ul>"
        '<a href="https://example.com/path">رابط</a>'
    )


def test_the_comment_policy_removes_a_script_and_its_contents() -> None:
    value = '<p>نص آمن</p><script>alert("xss")</script>'

    sanitized = sanitize_comment_html(value)

    assert sanitized == "<p>نص آمن</p>"
    assert "script" not in sanitized
    assert "alert" not in sanitized


def test_the_comment_policy_removes_dangerous_attributes_and_urls() -> None:
    value = (
        '<p onclick="alert(1)">نص</p>'
        '<a href="javascript:alert(1)" onmouseover="alert(2)">رابط</a>'
        '<span style="background:url(https://example.com/image)">ملون</span>'
    )

    sanitized = sanitize_comment_html(value)

    assert sanitized == "<p>نص</p><a>رابط</a><span>ملون</span>"
    assert "javascript" not in sanitized
    assert "onclick" not in sanitized
    assert "onmouseover" not in sanitized
    assert "background" not in sanitized


def test_the_comment_word_count_counts_visible_words_and_emojis() -> None:
    value = "<p>مرحبا بالعالم</p><ul><li>رمز 😀</li><li>كلمة</li></ul>"

    assert count_comment_words(sanitize_comment_html(value)) == 5
