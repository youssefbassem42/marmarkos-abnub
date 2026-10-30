"""Blog-post API tests (Phase 7.2)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.modules.blog.infrastructure.persistence.models import BlogPost
from app.modules.users.domain.enums.role_name import RoleName
from tests.utils import DEFAULT_PASSWORD, bearer, create_user_direct

PUBLIC_URL = "/api/v1/blog/posts"
ADMIN_URL = "/api/v1/admin/blog/posts"


async def _auth_headers(
    client: AsyncClient,
    db_engine,
    *,
    email: str,
    role: RoleName,
) -> dict[str, str]:
    await create_user_direct(engine=db_engine, email=email, role_name=role)
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return bearer(response.json()["access_token"])


def _post_payload(
    title: str = "موضوع",
    *,
    tags: list[str] | None = None,
    excerpt: str | None = "مقتطف",
    published_at: datetime | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "title": title,
        "excerpt": excerpt,
        "body": "نص الموضوع",
        "cover_image": "https://res.cloudinary.com/demo/image/upload/post.jpg",
        "tags": tags or [],
    }
    if published_at is not None:
        payload["published_at"] = published_at.isoformat()
    return payload


async def _create_post(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    title: str = "موضوع",
    tags: list[str] | None = None,
    published_at: datetime | None = None,
) -> dict[str, object]:
    response = await client.post(
        ADMIN_URL,
        json=_post_payload(title, tags=tags, published_at=published_at),
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_admin_creates_a_draft_and_the_public_list_hides_it(
    client: AsyncClient, db_engine
) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-create@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-create@example.com",
        role=RoleName.MEMBER,
    )

    created = await _create_post(client, admin, title="مسودة جديدة", tags=["الشباب"])
    assert created["status"] == "DRAFT"
    assert created["title"] == "مسودة جديدة"
    assert [tag["name"] for tag in created["tags"]] == ["الشباب"]
    assert created["published_at"] is None

    public = await client.get(PUBLIC_URL, headers=member)
    assert public.status_code == 200
    assert public.json()["items"] == []


async def test_servant_can_write_but_member_cannot(client: AsyncClient, db_engine) -> None:
    servant = await _auth_headers(
        client,
        db_engine,
        email="blog-servant@example.com",
        role=RoleName.SERVANT,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-write@example.com",
        role=RoleName.MEMBER,
    )

    created = await client.post(
        ADMIN_URL,
        json=_post_payload("موضوع الخادم"),
        headers=servant,
    )
    assert created.status_code == 201, created.text

    refused = await client.post(
        ADMIN_URL,
        json=_post_payload("موضوع العضو"),
        headers=member,
    )
    assert refused.status_code == 403

    admin_list = await client.get(ADMIN_URL, headers=member)
    assert admin_list.status_code == 403


async def test_the_author_admin_and_servant_can_update_but_a_member_cannot(
    client: AsyncClient, db_engine
) -> None:
    author = await _auth_headers(
        client,
        db_engine,
        email="blog-author@example.com",
        role=RoleName.SERVANT,
    )
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-update@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-update@example.com",
        role=RoleName.MEMBER,
    )
    created = await _create_post(client, author, title="قبل التعديل")
    post_id = created["id"]

    by_author = await client.patch(
        f"{ADMIN_URL}/{post_id}",
        json={"title": "تعديل صاحب الموضوع"},
        headers=author,
    )
    assert by_author.status_code == 200, by_author.text
    assert by_author.json()["title"] == "تعديل صاحب الموضوع"

    by_admin = await client.patch(
        f"{ADMIN_URL}/{post_id}",
        json={"excerpt": "تعديل الإدارة"},
        headers=admin,
    )
    assert by_admin.status_code == 200, by_admin.text

    by_member = await client.patch(
        f"{ADMIN_URL}/{post_id}",
        json={"title": "ممنوع"},
        headers=member,
    )
    assert by_member.status_code == 403


async def test_a_past_date_publishes_the_post_at_once(client: AsyncClient, db_engine) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-past@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-past@example.com",
        role=RoleName.MEMBER,
    )
    moment = datetime.now(UTC) - timedelta(minutes=1)

    created = await _create_post(
        client,
        admin,
        title="منشور الآن",
        published_at=moment,
    )
    assert created["status"] == "PUBLISHED"
    assert created["published_at"] is not None

    public = await client.get(PUBLIC_URL, headers=member)
    assert [item["id"] for item in public.json()["items"]] == [created["id"]]

    detail = await client.get(f"{PUBLIC_URL}/{created['id']}", headers=member)
    assert detail.status_code == 200
    assert detail.json()["body"] == "نص الموضوع"


async def test_a_future_date_is_scheduled_and_hidden_from_the_public(
    client: AsyncClient, db_engine
) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-future@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-future@example.com",
        role=RoleName.MEMBER,
    )
    tomorrow = datetime.now(UTC) + timedelta(days=1)

    created = await _create_post(
        client,
        admin,
        title="موضوع غد",
        published_at=tomorrow,
    )
    assert created["status"] == "DRAFT"
    assert created["published_at"] is not None

    public = await client.get(PUBLIC_URL, headers=member)
    assert public.json()["items"] == []
    detail = await client.get(f"{PUBLIC_URL}/{created['id']}", headers=member)
    assert detail.status_code == 404

    administration = await client.get(ADMIN_URL, headers=admin)
    assert [item["id"] for item in administration.json()["items"]] == [created["id"]]
    assert administration.json()["items"][0]["status"] == "DRAFT"


async def test_explicit_publish_and_schedule_commands_change_the_state(
    client: AsyncClient, db_engine
) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-actions@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-actions@example.com",
        role=RoleName.MEMBER,
    )
    created = await _create_post(client, admin, title="أوامر الموضوع")
    post_id = created["id"]

    tomorrow = datetime.now(UTC) + timedelta(days=1)
    scheduled = await client.post(
        f"{ADMIN_URL}/{post_id}/schedule",
        json={"published_at": tomorrow.isoformat()},
        headers=admin,
    )
    assert scheduled.status_code == 200, scheduled.text
    assert scheduled.json()["status"] == "DRAFT"
    assert scheduled.json()["published_at"] is not None

    published = await client.post(
        f"{ADMIN_URL}/{post_id}/publish",
        headers=admin,
    )
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "PUBLISHED"

    public = await client.get(PUBLIC_URL, headers=member)
    assert [item["id"] for item in public.json()["items"]] == [post_id]


async def test_delete_is_soft_and_the_archived_post_stays_in_the_administration(
    client: AsyncClient, db_engine
) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-delete@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-delete@example.com",
        role=RoleName.MEMBER,
    )
    created = await _create_post(
        client,
        admin,
        title="موضوع محذوف",
        published_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    post_id = created["id"]

    deleted = await client.delete(f"{ADMIN_URL}/{post_id}", headers=admin)
    assert deleted.status_code == 204

    public = await client.get(PUBLIC_URL, headers=member)
    assert public.json()["items"] == []
    detail = await client.get(f"{PUBLIC_URL}/{post_id}", headers=member)
    assert detail.status_code == 404

    administration = await client.get(ADMIN_URL, headers=admin)
    assert administration.json()["items"][0]["id"] == post_id
    assert administration.json()["items"][0]["status"] == "ARCHIVED"


async def test_the_public_list_filters_by_tag_and_searches_the_title(
    client: AsyncClient, db_engine
) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-filter@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-filter@example.com",
        role=RoleName.MEMBER,
    )
    published_at = datetime.now(UTC) - timedelta(minutes=1)
    youth = await _create_post(
        client,
        admin,
        title="نشاط الشباب",
        tags=["الشباب"],
        published_at=published_at,
    )
    await _create_post(
        client,
        admin,
        title="نشاط الخدام",
        tags=["الخدام"],
        published_at=published_at,
    )

    by_tag = await client.get(PUBLIC_URL, params={"tag": "الشباب"}, headers=member)
    assert [item["id"] for item in by_tag.json()["items"]] == [youth["id"]]

    by_title = await client.get(PUBLIC_URL, params={"q": "الشباب"}, headers=member)
    assert [item["id"] for item in by_title.json()["items"]] == [youth["id"]]


async def test_the_public_list_is_paginated(client: AsyncClient, db_engine) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-page@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-page@example.com",
        role=RoleName.MEMBER,
    )
    published_at = datetime.now(UTC) - timedelta(minutes=1)
    for number in range(3):
        await _create_post(
            client,
            admin,
            title=f"موضوع {number}",
            published_at=published_at,
        )

    first = await client.get(
        PUBLIC_URL,
        params={"page": 1, "size": 2},
        headers=member,
    )
    assert first.status_code == 200
    assert first.json()["total"] == 3
    assert first.json()["pages"] == 2
    assert first.json()["has_next"] is True
    assert len(first.json()["items"]) == 2

    second = await client.get(
        PUBLIC_URL,
        params={"page": 2, "size": 2},
        headers=member,
    )
    assert len(second.json()["items"]) == 1
    assert second.json()["has_next"] is False


async def test_the_cover_upload_uses_the_one_megabyte_limit(
    client: AsyncClient,
    db_engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-upload@example.com",
        role=RoleName.ADMIN,
    )
    calls: list[dict[str, object]] = []

    async def _fake_upload(
        data: bytes,
        content_type: str,
        folder: str = "avatars",
        max_bytes: int = 2 * 1024 * 1024,
    ) -> str:
        calls.append(
            {
                "size": len(data),
                "content_type": content_type,
                "folder": folder,
                "max_bytes": max_bytes,
            }
        )
        return "https://res.cloudinary.com/demo/image/upload/blog.jpg"

    monkeypatch.setattr(
        "app.modules.blog.presentation.router.upload_image",
        _fake_upload,
    )
    response = await client.post(
        f"{ADMIN_URL}/cover",
        files={"file": ("cover.jpg", b"x" * 16, "image/jpeg")},
        headers=admin,
    )

    assert response.status_code == 201, response.text
    assert response.json()["url"].endswith("/blog.jpg")
    assert calls == [
        {
            "size": 16,
            "content_type": "image/jpeg",
            "folder": "blog-covers",
            "max_bytes": 1 * 1024 * 1024,
        }
    ]


async def test_openapi_declares_the_blog_answers(client: AsyncClient) -> None:
    from app.core.openapi import build_openapi_schema
    from app.main import create_app

    schema = build_openapi_schema(create_app())
    public = schema["paths"]["/api/v1/blog/posts"]["get"]
    admin = schema["paths"]["/api/v1/admin/blog/posts"]["get"]
    create = schema["paths"]["/api/v1/admin/blog/posts"]["post"]

    assert "200" in public["responses"]
    assert "200" in admin["responses"]
    assert "201" in create["responses"]
    assert public["responses"]["200"]["content"]["application/json"]["schema"]
    assert create["responses"]["201"]["content"]["application/json"]["schema"]


async def test_the_tick_publishes_the_scheduled_post_when_its_date_comes(
    client: AsyncClient, db_engine
) -> None:
    """A scheduled post goes live by itself when the date passes (BR-64).

    The shared scheduler tick publishes it; the public list shows it after
    the tick, and a second tick does not publish it twice.
    """
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-tick@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-tick@example.com",
        role=RoleName.MEMBER,
    )
    tomorrow = datetime.now(UTC) + timedelta(days=1)
    created = await _create_post(client, admin, title="موضوع غد", published_at=tomorrow)
    assert created["status"] == "DRAFT"

    # The date passes: the row keeps its schedule, the tick finds it.
    async with db_engine.begin() as conn:
        await conn.execute(
            update(BlogPost)
            .where(BlogPost.id == uuid.UUID(str(created["id"])))
            .values(published_at=datetime.now(UTC) - timedelta(minutes=2))
        )

    before = await client.get(PUBLIC_URL, headers=member)
    assert before.json()["items"] == []

    from app.core.database import async_session_factory
    from app.modules.blog.application.services.publication_service import publish_due

    result = await publish_due(async_session_factory)
    assert result["published"] == 1

    after = await client.get(PUBLIC_URL, headers=member)
    assert [item["id"] for item in after.json()["items"]] == [created["id"]]

    # The runner is idempotent: a second tick publishes nothing.
    again = await publish_due(async_session_factory)
    assert again["published"] == 0
    assert again["skipped"] == 0


async def test_the_administration_reads_one_post_with_its_fields(
    client: AsyncClient, db_engine
) -> None:
    """The form of the administration needs the post it edits (a draft too)."""
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-one@example.com",
        role=RoleName.ADMIN,
    )
    created = await _create_post(client, admin, title="موضوع واحد")

    response = await client.get(f"{ADMIN_URL}/{created['id']}", headers=admin)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == created["id"]
    assert body["title"] == "موضوع واحد"
    assert body["status"] == "DRAFT"
    assert body["author_id"]


async def test_a_member_does_not_read_the_post_of_the_administration(
    client: AsyncClient, db_engine
) -> None:
    admin = await _auth_headers(
        client,
        db_engine,
        email="blog-admin-two@example.com",
        role=RoleName.ADMIN,
    )
    member = await _auth_headers(
        client,
        db_engine,
        email="blog-member-two@example.com",
        role=RoleName.MEMBER,
    )
    created = await _create_post(client, admin, title="موضوع محمي")

    response = await client.get(f"{ADMIN_URL}/{created['id']}", headers=member)

    assert response.status_code == 403
