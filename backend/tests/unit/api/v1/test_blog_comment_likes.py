"""The likes and notifications of blog comments and replies (BR-86/BR-87)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy import insert, select

from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.models import BlogPost
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification
from app.modules.users.domain.enums.role_name import RoleName
from tests.utils import DEFAULT_PASSWORD, bearer, create_user_direct

POSTS_URL = "/api/v1/blog/posts"
COMMENTS_URL = "/api/v1/blog/comments"


async def _actor(
    client: AsyncClient,
    db_engine,
    *,
    email: str,
) -> tuple[uuid.UUID, dict[str, str]]:
    user_id = await create_user_direct(
        engine=db_engine,
        email=email,
        role_name=RoleName.MEMBER,
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
                title="منشور التعليقات",
                slug=f"comment-likes-{post_id.hex}",
                content="نص المنشور",
                status=PostStatus.PUBLISHED,
                published_at=datetime.now(UTC),
            )
        )
    return post_id


async def _comment(
    client: AsyncClient,
    headers: dict[str, str],
    post_id: uuid.UUID,
    *,
    content: str = "<p>تعليق</p>",
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


async def test_liking_a_comment_is_idempotent_and_taking_the_like_back_is_safe(
    client: AsyncClient,
    db_engine,
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-like-owner@example.com")
    _, liker = await _actor(client, db_engine, email="comment-like-liker@example.com")
    post_id = await _published_post(db_engine, owner_id)
    comment = await _comment(client, liker, post_id)

    first = await client.post(f"{COMMENTS_URL}/{comment['id']}/like", headers=liker)
    second = await client.post(f"{COMMENTS_URL}/{comment['id']}/like", headers=liker)
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert first.json() == {
        "comment_id": comment["id"],
        "likes_count": 1,
        "liked": True,
    }
    assert second.json()["likes_count"] == 1

    read = await client.get(f"{COMMENTS_URL}/{comment['id']}/likes", headers=liker)
    assert read.status_code == 200, read.text
    assert read.json() == {
        "comment_id": comment["id"],
        "likes_count": 1,
        "liked": True,
    }

    unliked = await client.delete(f"{COMMENTS_URL}/{comment['id']}/like", headers=liker)
    unliked_again = await client.delete(f"{COMMENTS_URL}/{comment['id']}/like", headers=liker)
    assert unliked.status_code == 200, unliked.text
    assert unliked_again.status_code == 200, unliked_again.text
    assert unliked.json()["likes_count"] == 0
    assert unliked.json()["liked"] is False


async def test_the_comment_tree_carries_the_count_and_the_callers_like_state(
    client: AsyncClient,
    db_engine,
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-like-tree-owner@example.com")
    _, commenter = await _actor(client, db_engine, email="comment-like-tree-commenter@example.com")
    _, replier = await _actor(client, db_engine, email="comment-like-tree-replier@example.com")
    _, reader = await _actor(client, db_engine, email="comment-like-tree-reader@example.com")
    post_id = await _published_post(db_engine, owner_id)
    root = await _comment(client, commenter, post_id)
    reply = await _comment(
        client,
        replier,
        post_id,
        content="<p>رد</p>",
        parent_comment_id=str(root["id"]),
    )

    await client.post(f"{COMMENTS_URL}/{root['id']}/like", headers=replier)
    await client.post(f"{COMMENTS_URL}/{reply['id']}/like", headers=replier)

    liked_tree = await client.get(f"{POSTS_URL}/{post_id}/comments", headers=replier)
    assert liked_tree.status_code == 200, liked_tree.text
    liked_root = liked_tree.json()["items"][0]
    assert liked_root["likes_count"] == 1
    assert liked_root["liked"] is True
    assert liked_root["replies"][0]["likes_count"] == 1
    assert liked_root["replies"][0]["liked"] is True

    other_tree = await client.get(f"{POSTS_URL}/{post_id}/comments", headers=reader)
    assert other_tree.status_code == 200, other_tree.text
    other_root = other_tree.json()["items"][0]
    assert other_root["likes_count"] == 1
    assert other_root["liked"] is False
    assert other_root["replies"][0]["likes_count"] == 1
    assert other_root["replies"][0]["liked"] is False


async def test_a_comment_like_notifies_the_comment_author_once(
    client: AsyncClient,
    db_engine,
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-notify-owner@example.com")
    comment_author_id, comment_author = await _actor(
        client,
        db_engine,
        email="comment-notify-author@example.com",
    )
    _, liker = await _actor(client, db_engine, email="comment-notify-liker@example.com")
    post_id = await _published_post(db_engine, owner_id)
    comment = await _comment(client, comment_author, post_id)

    assert (
        await client.post(f"{COMMENTS_URL}/{comment['id']}/like", headers=liker)
    ).status_code == 200
    assert (
        await client.delete(f"{COMMENTS_URL}/{comment['id']}/like", headers=liker)
    ).status_code == 200
    assert (
        await client.post(f"{COMMENTS_URL}/{comment['id']}/like", headers=liker)
    ).status_code == 200

    async with db_engine.begin() as connection:
        rows = list(
            (
                await connection.execute(
                    select(Notification.user_id, Notification.data).where(
                        Notification.type == NotificationType.BLOG_LIKE
                    )
                )
            ).all()
        )

    assert len(rows) == 1
    recipient_id, data = rows[0]
    assert recipient_id == comment_author_id
    assert data is not None
    assert data["post_id"] == str(post_id)
    assert data["comment_id"] == comment["id"]
    assert data["slug"] == f"comment-likes-{post_id.hex}"
    assert data["cta_url"] == f"/blog/comment-likes-{post_id.hex}"
    assert data["icon"] == "Heart"


async def test_a_member_does_not_notify_themself_when_they_like_their_comment(
    client: AsyncClient,
    db_engine,
) -> None:
    owner_id, _ = await _actor(client, db_engine, email="comment-self-notify-owner@example.com")
    _, author = await _actor(client, db_engine, email="comment-self-notify-author@example.com")
    post_id = await _published_post(db_engine, owner_id)
    comment = await _comment(client, author, post_id)

    assert (
        await client.post(f"{COMMENTS_URL}/{comment['id']}/like", headers=author)
    ).status_code == 200

    async with db_engine.begin() as connection:
        rows = list(
            (
                await connection.execute(
                    select(Notification.id).where(Notification.type == NotificationType.BLOG_LIKE)
                )
            ).all()
        )
    assert rows == []


async def test_a_missing_comment_and_an_anonymous_member_are_refused(
    client: AsyncClient,
    db_engine,
) -> None:
    _, member = await _actor(client, db_engine, email="comment-like-missing@example.com")
    missing_id = uuid.uuid4()

    liked = await client.post(f"{COMMENTS_URL}/{missing_id}/like", headers=member)
    read = await client.get(f"{COMMENTS_URL}/{missing_id}/likes", headers=member)
    anonymous = await client.post(f"{COMMENTS_URL}/{missing_id}/like")

    assert liked.status_code == 404
    assert read.status_code == 404
    assert anonymous.status_code == 401
