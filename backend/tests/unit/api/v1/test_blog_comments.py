"""Blog-comment API and content-policy tests (Phase 7.6)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy import insert, select

from app.core.database import async_session_factory
from app.modules.admin.infrastructure.persistence.models import AuditLog
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.models import BlogPost
from app.modules.comments.application.services.comment_content import (
    count_comment_words,
    sanitize_comment_html,
)
from app.modules.comments.infrastructure.persistence.models import Comment
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification
from app.modules.users.domain.enums.role_name import RoleName
from app.shared.application.outbox_dispatcher import dispatch_pending
from tests.utils import DEFAULT_PASSWORD, bearer, create_user_direct

POSTS_URL = "/api/v1/blog/posts"
COMMENTS_URL = "/api/v1/blog/comments"


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
        '<a href="//evil.example/path">خارجي</a>'
        '<span style="background:url(https://example.com/image)">ملون</span>'
    )

    sanitized = sanitize_comment_html(value)

    assert sanitized == "<p>نص</p><a>رابط</a><a>خارجي</a><span>ملون</span>"
    assert "javascript" not in sanitized
    assert "onclick" not in sanitized
    assert "onmouseover" not in sanitized
    assert "background" not in sanitized


def test_the_comment_policy_removes_an_unclosed_script_to_the_end() -> None:
    assert sanitize_comment_html('<p>آمن</p><script>alert("xss")') == "<p>آمن</p>"


def test_the_comment_word_count_counts_visible_words_and_emojis() -> None:
    value = "<p>مرحبا بالعالم</p><ul><li>رمز 😀</li><li>كلمة</li></ul>"

    assert count_comment_words(sanitize_comment_html(value)) == 5


async def _actor(
    client: AsyncClient,
    db_engine,
    *,
    email: str,
    role: RoleName = RoleName.MEMBER,
) -> tuple[uuid.UUID, dict[str, str]]:
    user_id = await create_user_direct(
        engine=db_engine,
        email=email,
        role_name=role,
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return user_id, bearer(response.json()["access_token"])


async def _published_post(db_engine, author_id: uuid.UUID) -> uuid.UUID:
    post_id = uuid.uuid4()
    async with db_engine.begin() as connection:
        await connection.execute(
            insert(BlogPost).values(
                id=post_id,
                author_id=author_id,
                title="موضوع التعليقات",
                slug=f"comments-{post_id.hex}",
                content="نص الموضوع",
                status=PostStatus.PUBLISHED,
                published_at=datetime.now(UTC),
            )
        )
    return post_id


async def _draft_post(db_engine, author_id: uuid.UUID) -> uuid.UUID:
    post_id = uuid.uuid4()
    async with db_engine.begin() as connection:
        await connection.execute(
            insert(BlogPost).values(
                id=post_id,
                author_id=author_id,
                title="مسودة بلا نشر",
                slug=f"draft-{post_id.hex}",
                content="نص المسودة",
                status=PostStatus.DRAFT,
            )
        )
    return post_id


async def _create_comment(
    client: AsyncClient,
    headers: dict[str, str],
    post_id: uuid.UUID,
    content: str,
    *,
    parent_comment_id: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {"content": content}
    if parent_comment_id is not None:
        payload["parent_comment_id"] = parent_comment_id
    response = await client.post(
        f"{POSTS_URL}/{post_id}/comments",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_the_comments_of_a_post_are_returned_as_a_nested_tree(
    client: AsyncClient, db_engine
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-tree-owner@example.com")
    _, commenter = await _actor(client, db_engine, email="comment-tree-writer@example.com")
    _, replier = await _actor(client, db_engine, email="comment-tree-replier@example.com")
    post_id = await _published_post(db_engine, owner_id)

    top = await _create_comment(client, commenter, post_id, "<p>تعليق رئيسي</p>")
    reply = await _create_comment(
        client,
        replier,
        post_id,
        "<p>رد متداخل</p>",
        parent_comment_id=str(top["id"]),
    )

    response = await client.get(f"{POSTS_URL}/{post_id}/comments", headers=commenter)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert len(body["items"]) == 1
    root = body["items"][0]
    assert root["id"] == top["id"]
    assert root["parent_comment_id"] is None
    assert len(root["replies"]) == 1
    assert root["replies"][0]["id"] == reply["id"]
    assert root["replies"][0]["parent_comment_id"] == top["id"]


async def test_the_backend_sanitizes_the_comment_before_it_is_stored(
    client: AsyncClient, db_engine
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-safe-owner@example.com")
    _, member = await _actor(client, db_engine, email="comment-safe-member@example.com")
    post_id = await _published_post(db_engine, owner_id)

    created = await _create_comment(
        client,
        member,
        post_id,
        '<p onclick="alert(1)">نص آمن</p><script>alert("xss")</script>'
        '<a href="javascript:alert(2)">رابط</a>',
    )

    assert created["content"] == "<p>نص آمن</p><a>رابط</a>"
    async with db_engine.begin() as connection:
        stored = (
            await connection.execute(
                select(Comment.content).where(Comment.id == uuid.UUID(str(created["id"])))
            )
        ).scalar_one()
    assert stored == "<p>نص آمن</p><a>رابط</a>"
    assert "script" not in stored
    assert "onclick" not in stored
    assert "javascript" not in stored


async def test_the_backend_rejects_more_than_five_hundred_words(
    client: AsyncClient, db_engine
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-limit-owner@example.com")
    _, member = await _actor(client, db_engine, email="comment-limit-member@example.com")
    post_id = await _published_post(db_engine, owner_id)

    accepted = await client.post(
        f"{POSTS_URL}/{post_id}/comments",
        json={"content": " ".join(["كلمة"] * 500)},
        headers=member,
    )
    refused = await client.post(
        f"{POSTS_URL}/{post_id}/comments",
        json={"content": " ".join(["كلمة"] * 501)},
        headers=member,
    )

    assert accepted.status_code == 201, accepted.text
    assert refused.status_code == 422, refused.text
    assert refused.json()["detail"]["code"] == "validation_error"


async def test_only_the_owner_edits_a_comment_but_a_servant_may_delete_it(
    client: AsyncClient, db_engine
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-permission-owner@example.com")
    _, member = await _actor(client, db_engine, email="comment-permission-member@example.com")
    _, other_member = await _actor(
        client,
        db_engine,
        email="comment-permission-other@example.com",
    )
    _, admin = await _actor(
        client,
        db_engine,
        email="comment-permission-admin@example.com",
        role=RoleName.ADMIN,
    )
    _, servant = await _actor(
        client,
        db_engine,
        email="comment-permission-servant@example.com",
        role=RoleName.SERVANT,
    )
    post_id = await _published_post(db_engine, owner_id)
    created = await _create_comment(client, member, post_id, "<p>قبل التعديل</p>")
    comment_id = str(created["id"])

    by_other_member = await client.patch(
        f"{COMMENTS_URL}/{comment_id}",
        json={"content": "<p>ممنوع</p>"},
        headers=other_member,
    )
    by_admin = await client.patch(
        f"{COMMENTS_URL}/{comment_id}",
        json={"content": "<p>ممنوع</p>"},
        headers=admin,
    )
    by_servant = await client.patch(
        f"{COMMENTS_URL}/{comment_id}",
        json={"content": "<p>ممنوع</p>"},
        headers=servant,
    )
    assert by_other_member.status_code == 403
    assert by_admin.status_code == 403
    assert by_servant.status_code == 403

    by_owner = await client.patch(
        f"{COMMENTS_URL}/{comment_id}",
        json={"content": "<p>بعد التعديل</p>"},
        headers=member,
    )
    assert by_owner.status_code == 200, by_owner.text
    assert by_owner.json()["content"] == "<p>بعد التعديل</p>"

    refused_delete = await client.delete(f"{COMMENTS_URL}/{comment_id}", headers=other_member)
    assert refused_delete.status_code == 403

    admin_delete = await client.delete(f"{COMMENTS_URL}/{comment_id}", headers=admin)
    assert admin_delete.status_code == 204

    another = await _create_comment(client, member, post_id, "<p>تعليق آخر</p>")
    servant_delete = await client.delete(f"{COMMENTS_URL}/{another['id']}", headers=servant)
    assert servant_delete.status_code == 204


async def test_deleting_a_comment_removes_its_whole_reply_subtree(
    client: AsyncClient, db_engine
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-delete-owner@example.com")
    member_id, member = await _actor(client, db_engine, email="comment-delete-member@example.com")
    _, replier = await _actor(client, db_engine, email="comment-delete-replier@example.com")
    post_id = await _published_post(db_engine, owner_id)
    other_post_id = await _published_post(db_engine, owner_id)
    top = await _create_comment(client, member, post_id, "<p>نص سرّي</p>")
    reply = await _create_comment(
        client,
        replier,
        post_id,
        "<p>رد</p>",
        parent_comment_id=str(top["id"]),
    )
    nested_reply = await _create_comment(
        client,
        member,
        post_id,
        "<p>رد الرد</p>",
        parent_comment_id=str(reply["id"]),
    )
    other_comment = await _create_comment(client, member, other_post_id, "<p>تعليق آخر</p>")

    deleted = await client.delete(f"{COMMENTS_URL}/{top['id']}", headers=member)
    assert deleted.status_code == 204

    response = await client.get(f"{POSTS_URL}/{post_id}/comments", headers=member)
    assert response.status_code == 200, response.text
    assert response.json()["items"] == []

    async with db_engine.begin() as connection:
        remaining = set(
            (
                await connection.execute(
                    select(Comment.id).where(
                        Comment.id.in_([top["id"], reply["id"], nested_reply["id"]])
                    )
                )
            ).scalars()
        )
        audit_actor = (
            await connection.execute(
                select(AuditLog.actor_user_id).where(
                    AuditLog.action == "comment.delete",
                    AuditLog.entity_type == "comment",
                    AuditLog.entity_id == str(top["id"]),
                )
            )
        ).scalar_one()

    assert remaining == set()
    assert audit_actor == member_id

    other_tree = await client.get(f"{POSTS_URL}/{other_post_id}/comments", headers=member)
    assert other_tree.status_code == 200, other_tree.text
    assert [item["id"] for item in other_tree.json()["items"]] == [other_comment["id"]]


async def test_the_post_owner_and_the_parent_comment_owner_are_notified(
    client: AsyncClient, db_engine
) -> None:
    post_owner_id, _ = await _actor(
        client,
        db_engine,
        email="comment-notify-post-owner@example.com",
    )
    parent_owner_id, parent_owner = await _actor(
        client,
        db_engine,
        email="comment-notify-parent-owner@example.com",
    )
    _, replier = await _actor(
        client,
        db_engine,
        email="comment-notify-replier@example.com",
    )
    post_id = await _published_post(db_engine, post_owner_id)
    top = await _create_comment(client, parent_owner, post_id, "<p>تعليق أصلي</p>")

    first_dispatch = await dispatch_pending(async_session_factory)
    assert first_dispatch == {"processed": 1, "failed": 0}

    await _create_comment(
        client,
        replier,
        post_id,
        "<p>رد جديد</p>",
        parent_comment_id=str(top["id"]),
    )
    second_dispatch = await dispatch_pending(async_session_factory)
    assert second_dispatch == {"processed": 1, "failed": 0}

    async with db_engine.begin() as connection:
        rows = list(
            (
                await connection.execute(
                    select(Notification.user_id, Notification.data).where(
                        Notification.type == NotificationType.BLOG_COMMENT
                    )
                )
            ).all()
        )

    by_user: dict[uuid.UUID, list[dict[str, object] | None]] = {}
    for user_id, data in rows:
        assert user_id is not None
        by_user.setdefault(user_id, []).append(data)

    assert len(by_user[post_owner_id]) == 2
    assert len(by_user[parent_owner_id]) == 1
    parent_notification = by_user[parent_owner_id][0]
    assert parent_notification is not None
    assert parent_notification["post_id"] == str(post_id)
    assert parent_notification["cta_url"] == f"/blog/comments-{post_id.hex}"


async def test_a_missing_post_and_an_anonymous_member_are_refused(
    client: AsyncClient, db_engine
) -> None:
    _, member = await _actor(client, db_engine, email="comment-missing-member@example.com")

    missing = await client.get(f"{POSTS_URL}/{uuid.uuid4()}/comments", headers=member)
    anonymous = await client.get(f"{POSTS_URL}/{uuid.uuid4()}/comments")

    assert missing.status_code == 404
    assert anonymous.status_code == 401


async def test_the_manager_of_a_draft_is_told_the_truth(client: AsyncClient, db_engine) -> None:
    """A draft cannot be commented on, but its author deserves the truth.

    The author of the post and the administration see the draft, so
    "not found" would be a lie: they are told that the post is not
    published yet (409).
    """
    author_id, author = await _actor(client, db_engine, email="comment-draft-author@example.com")
    _, admin = await _actor(
        client, db_engine, email="comment-draft-admin@example.com", role=RoleName.ADMIN
    )
    _, member = await _actor(client, db_engine, email="comment-draft-member@example.com")
    post_id = await _draft_post(db_engine, author_id)

    for headers in (author, admin):
        response = await client.post(
            f"{POSTS_URL}/{post_id}/comments",
            json={"content": "تعليق على المسودة"},
            headers=headers,
        )
        assert response.status_code == 409, response.text
        assert response.json()["detail"]["message"] == "The post is not published yet"

    # A member who does not manage the post learns nothing about it.
    hidden = await client.post(
        f"{POSTS_URL}/{post_id}/comments",
        json={"content": "تعليق على المسودة"},
        headers=member,
    )
    assert hidden.status_code == 404
