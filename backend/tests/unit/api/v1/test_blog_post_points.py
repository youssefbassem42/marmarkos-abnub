"""The points earned by publishing a blog post (BR-85)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import update

from app.core.database import async_session_factory
from app.core.time.clock import today_local
from app.modules.blog.infrastructure.persistence.models import BlogPost
from app.modules.users.domain.enums.role_name import RoleName
from tests.utils import DEFAULT_PASSWORD, bearer, create_user_direct

ADMIN_POSTS_URL = "/api/v1/admin/blog/posts"
POINTS_URL = "/api/v1/users/me/points"


async def _author(
    client: AsyncClient,
    db_engine,
    *,
    email: str,
) -> tuple[uuid.UUID, dict[str, str]]:
    user_id = await create_user_direct(
        engine=db_engine,
        email=email,
        role_name=RoleName.ADMIN,
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return user_id, bearer(response.json()["access_token"])


async def _create_draft(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    title: str,
    published_at: datetime | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "title": title,
        "excerpt": "مقتطف",
        "body": "نص الموضوع",
        "tags": [],
    }
    if published_at is not None:
        payload["published_at"] = published_at.isoformat()
    response = await client.post(ADMIN_POSTS_URL, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def _points(client: AsyncClient, headers: dict[str, str]) -> dict[str, object]:
    response = await client.get(POINTS_URL, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def test_publishing_a_post_awards_three_points_once_and_shows_the_post_title(
    client: AsyncClient,
    db_engine,
) -> None:
    author_id, headers = await _author(client, db_engine, email="post-points-author@example.com")
    created = await _create_draft(client, headers, title="موضوع earns نقاط")

    published = await client.post(
        f"{ADMIN_POSTS_URL}/{created['id']}/publish",
        headers=headers,
    )
    assert published.status_code == 200, published.text

    # Publishing the same post again never pays a second award.
    published_again = await client.post(
        f"{ADMIN_POSTS_URL}/{created['id']}/publish",
        headers=headers,
    )
    assert published_again.status_code == 200, published_again.text

    totals = await _points(client, headers)
    assert totals["lifetime"] == 3
    assert totals["this_week"] == 3
    assert totals["this_month"] == 3

    monthly = await client.get(f"{POINTS_URL}/monthly", headers=headers)
    assert monthly.status_code == 200, monthly.text
    current_month = today_local().replace(day=1)
    current_item = next(
        item
        for item in monthly.json()["items"]
        if item["period_month"] == current_month.isoformat()
    )
    assert current_item["points"] == 3

    history = await client.get(f"{POINTS_URL}/history", headers=headers)
    assert history.status_code == 200, history.text
    item = history.json()["items"][0]
    assert item["points"] == 3
    assert item["source"] == "BLOG_POST"
    assert item["post_id"] == created["id"]
    assert item["post_title"] == "موضوع earns نقاط"

    leaderboard = await client.get(
        "/api/v1/quiz-analytics/monthly",
        params={"month": today_local().strftime("%Y-%m")},
        headers=headers,
    )
    assert leaderboard.status_code == 200, leaderboard.text
    assert (
        next(user for user in leaderboard.json()["top"] if user["user_id"] == str(author_id))[
            "points"
        ]
        == 3
    )


async def test_a_scheduled_post_awards_its_points_when_the_tick_publishes_it(
    client: AsyncClient,
    db_engine,
) -> None:
    _, headers = await _author(client, db_engine, email="post-points-scheduled@example.com")
    created = await _create_draft(
        client,
        headers,
        title="موضوع مجدول",
        published_at=datetime.now(UTC) + timedelta(days=1),
    )

    async with db_engine.begin() as connection:
        await connection.execute(
            update(BlogPost)
            .where(BlogPost.id == uuid.UUID(str(created["id"])))
            .values(published_at=datetime.now(UTC) - timedelta(minutes=1))
        )

    from app.modules.blog.application.services.publication_service import publish_due

    result = await publish_due(async_session_factory)
    assert result["published"] == 1

    totals = await _points(client, headers)
    assert totals["lifetime"] == 3
    assert totals["this_month"] == 3


async def test_archiving_a_published_post_does_not_take_its_points_back(
    client: AsyncClient,
    db_engine,
) -> None:
    _, headers = await _author(client, db_engine, email="post-points-archive@example.com")
    created = await _create_draft(client, headers, title="موضوع مؤرشف")
    await client.post(f"{ADMIN_POSTS_URL}/{created['id']}/publish", headers=headers)

    archived = await client.delete(f"{ADMIN_POSTS_URL}/{created['id']}", headers=headers)
    assert archived.status_code == 204

    totals = await _points(client, headers)
    assert totals["lifetime"] == 3
    assert totals["this_month"] == 3
