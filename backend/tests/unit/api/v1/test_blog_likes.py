"""API tests for the likes of a blog post (Phase 7.8)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import insert, select

from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.like_repository import BlogPostLikeRepository
from app.modules.blog.infrastructure.persistence.models import BlogPost, BlogPostLike
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification
from app.modules.users.domain.enums.role_name import RoleName
from tests.utils import DEFAULT_PASSWORD, bearer, create_user_direct

POSTS_URL = "/api/v1/blog/posts"


async def _member(
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


async def _published_post(
    db_engine,
    author_id: uuid.UUID,
    *,
    title: str = "موضوع",
) -> uuid.UUID:
    post_id = uuid.uuid4()
    async with db_engine.begin() as connection:
        await connection.execute(
            insert(BlogPost).values(
                id=post_id,
                author_id=author_id,
                title=title,
                slug=f"post-{post_id.hex}",
                content="نص الموضوع",
                status=PostStatus.PUBLISHED,
                published_at=datetime.now(UTC),
            )
        )
    return post_id


async def test_a_member_likes_a_post(client: AsyncClient, db_engine) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-like@example.com")
    post_id = await _published_post(db_engine, member_id)

    response = await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json() == {
        "post_id": str(post_id),
        "likes_count": 1,
        "liked": True,
    }


async def test_liking_twice_keeps_one_like(client: AsyncClient, db_engine) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-like-twice@example.com")
    post_id = await _published_post(db_engine, member_id)

    first = await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)
    second = await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json()["likes_count"] == 1
    assert second.json()["liked"] is True


async def test_a_post_like_notifies_its_author_once_even_after_unliking_and_liking_again(
    client: AsyncClient, db_engine
) -> None:
    author_id, _ = await _member(client, db_engine, email="blog-like-author@example.com")
    _, liker = await _member(client, db_engine, email="blog-like-notified@example.com")
    post_id = await _published_post(db_engine, author_id, title="منشور liked")

    liked = await client.post(f"{POSTS_URL}/{post_id}/like", headers=liker)
    assert liked.status_code == 200, liked.text
    unliked = await client.delete(f"{POSTS_URL}/{post_id}/like", headers=liker)
    assert unliked.status_code == 200, unliked.text
    liked_again = await client.post(f"{POSTS_URL}/{post_id}/like", headers=liker)
    assert liked_again.status_code == 200, liked_again.text

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
    assert recipient_id == author_id
    assert data is not None
    assert data["post_id"] == str(post_id)
    assert data["slug"] == f"post-{post_id.hex}"
    assert data["cta_url"] == f"/blog/post-{post_id.hex}"
    assert data["icon"] == "Heart"


async def test_a_member_does_not_notify_themself_when_they_like_their_post(
    client: AsyncClient, db_engine
) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-like-self-notify@example.com")
    post_id = await _published_post(db_engine, member_id)

    liked = await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)
    assert liked.status_code == 200, liked.text

    async with db_engine.begin() as connection:
        count = (
            await connection.execute(
                select(Notification.id).where(Notification.type == NotificationType.BLOG_LIKE)
            )
        ).all()
    assert count == []


async def test_a_member_takes_the_like_back(client: AsyncClient, db_engine) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-unlike@example.com")
    post_id = await _published_post(db_engine, member_id)
    await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)

    response = await client.delete(f"{POSTS_URL}/{post_id}/like", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json() == {
        "post_id": str(post_id),
        "likes_count": 0,
        "liked": False,
    }


async def test_taking_the_like_back_twice_stays_successful(client: AsyncClient, db_engine) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-unlike-twice@example.com")
    post_id = await _published_post(db_engine, member_id)
    await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)

    first = await client.delete(f"{POSTS_URL}/{post_id}/like", headers=headers)
    second = await client.delete(f"{POSTS_URL}/{post_id}/like", headers=headers)

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert second.json()["likes_count"] == 0
    assert second.json()["liked"] is False


async def test_the_list_of_posts_carries_the_number_of_likes(
    client: AsyncClient, db_engine
) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-list-likes@example.com")
    post_id = await _published_post(db_engine, member_id)

    before = await client.get(POSTS_URL, headers=headers)
    assert before.status_code == 200, before.text
    item = next(item for item in before.json()["items"] if item["id"] == str(post_id))
    assert item["likes_count"] == 0

    await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)

    after = await client.get(POSTS_URL, headers=headers)
    item = next(item for item in after.json()["items"] if item["id"] == str(post_id))
    assert item["likes_count"] == 1


async def test_a_signed_in_member_who_did_not_like_the_post_has_no_like(
    client: AsyncClient, db_engine
) -> None:
    liker_id, liker = await _member(client, db_engine, email="blog-count-liker@example.com")
    _, reader = await _member(client, db_engine, email="blog-count-reader@example.com")
    post_id = await _published_post(db_engine, liker_id)
    await client.post(f"{POSTS_URL}/{post_id}/like", headers=liker)

    response = await client.get(f"{POSTS_URL}/{post_id}/likes", headers=reader)

    assert response.status_code == 200, response.text
    assert response.json() == {
        "post_id": str(post_id),
        "likes_count": 1,
        "liked": False,
    }


async def test_an_anonymous_reader_sees_the_number_without_a_like(
    client: AsyncClient, db_engine
) -> None:
    liker_id, liker = await _member(client, db_engine, email="blog-anonymous-liker@example.com")
    post_id = await _published_post(db_engine, liker_id)
    await client.post(f"{POSTS_URL}/{post_id}/like", headers=liker)

    response = await client.get(f"{POSTS_URL}/{post_id}/likes")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "post_id": str(post_id),
        "likes_count": 1,
        "liked": False,
    }


async def test_the_member_who_liked_the_post_sees_their_like(
    client: AsyncClient, db_engine
) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-liked-reader@example.com")
    post_id = await _published_post(db_engine, member_id)
    await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)

    response = await client.get(f"{POSTS_URL}/{post_id}/likes", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["liked"] is True


async def test_a_missing_post_answers_not_found(client: AsyncClient, db_engine) -> None:
    _, headers = await _member(client, db_engine, email="blog-missing-post@example.com")
    post_id = uuid.uuid4()

    liked = await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)
    unliked = await client.delete(f"{POSTS_URL}/{post_id}/like", headers=headers)
    count = await client.get(f"{POSTS_URL}/{post_id}/likes")

    assert liked.status_code == 404
    assert unliked.status_code == 404
    assert count.status_code == 404


async def test_an_anonymous_member_may_not_like(client: AsyncClient, db_engine) -> None:
    author_id, _ = await _member(client, db_engine, email="blog-anonymous-like@example.com")
    post_id = await _published_post(db_engine, author_id)

    response = await client.post(f"{POSTS_URL}/{post_id}/like")

    assert response.status_code == 401


async def test_a_member_may_like_their_own_post(client: AsyncClient, db_engine) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-self-like@example.com")
    post_id = await _published_post(db_engine, member_id)

    response = await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["liked"] is True


async def test_the_loser_of_a_concurrent_first_like_receives_a_conflict(
    client: AsyncClient,
    db_engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    member_id, headers = await _member(client, db_engine, email="blog-like-race@example.com")
    post_id = await _published_post(db_engine, member_id)
    async with db_engine.begin() as connection:
        await connection.execute(insert(BlogPostLike).values(post_id=post_id, user_id=member_id))

    async def _stale_has_liked(
        self: BlogPostLikeRepository,
        post_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        return False

    monkeypatch.setattr(BlogPostLikeRepository, "has_liked", _stale_has_liked)

    response = await client.post(f"{POSTS_URL}/{post_id}/like", headers=headers)

    assert response.status_code == 409, response.text
    assert response.json()["detail"]["code"] == "conflict"
