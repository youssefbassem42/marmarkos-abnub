"""The notification and mail fan-out of a published blog post (BR-72..BR-76)."""

import asyncio
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.database import async_session_factory
from app.modules.blog.application.handlers.blog_post_published_handler import (  # noqa: F401
    handle_blog_post_published,
)
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.domain.events.blog_post_published import BlogPostPublished
from app.modules.blog.infrastructure.persistence.models import BlogPost
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.email.service import EmailService
from app.modules.notifications.infrastructure.persistence.models import Notification
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.services import generate_public_id
from app.shared.infrastructure.persistence.outbox import OutboxEvent
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


@pytest_asyncio.fixture()
async def uow() -> AsyncIterator[UnitOfWork]:
    async with UnitOfWork.create(async_session_factory) as unit_of_work:
        yield unit_of_work


async def _make_user(
    uow: UnitOfWork,
    email: str,
    *,
    role: RoleName = RoleName.MEMBER,
    status: UserStatus = UserStatus.ACTIVE,
    email_verified: bool = True,
) -> User:
    role_row = await uow.roles.get_by_name(role)
    assert role_row is not None
    user = User(
        email=email,
        password_hash="x",
        public_id=generate_public_id(),
        role=role_row,
        status=status,
        email_verified=email_verified,
    )
    await uow.users.add(user)
    return user


async def _make_post(
    uow: UnitOfWork,
    author: User,
    *,
    status: PostStatus = PostStatus.PUBLISHED,
    published_at: datetime | None = None,
    title: str = "موضوع جديد",
    excerpt: str | None = "مقتطف الموضوع",
) -> BlogPost:
    post = BlogPost(
        author_id=author.id,
        title=title,
        slug=f"post-{uuid.uuid4().hex}",
        excerpt=excerpt,
        content="محتوى الموضوع",
        status=status,
        published_at=published_at or datetime.now(UTC) - timedelta(minutes=1),
    )
    await uow.blog_posts.add(post)
    return post


def _published_event(post: BlogPost) -> OutboxEvent:
    return OutboxEvent.from_domain_event(
        BlogPostPublished(
            aggregate_id=post.id,
            author_id=post.author_id,
            title=post.title,
            slug=post.slug,
        )
    )


async def _notifications(uow: UnitOfWork) -> list[Notification]:
    result = await uow.session.execute(
        select(Notification).where(Notification.type == NotificationType.BLOG_POST)
    )
    return list(result.scalars().all())


async def test_published_event_creates_one_notification_per_active_member(
    uow: UnitOfWork, captured_emails: list
) -> None:
    author = await _make_user(uow, "blog-author@test.com", role=RoleName.SERVANT)
    first = await _make_user(uow, "blog-first@test.com")
    second = await _make_user(uow, "blog-second@test.com")
    post = await _make_post(uow, author, title="عنوان الموضوع", excerpt="مقتطف عربي")
    await uow.commit()

    await handle_blog_post_published(uow, _published_event(post))

    rows = await _notifications(uow)
    assert {row.user_id for row in rows} == {first.id, second.id}
    assert all(row.title == "منشور جديد: عنوان الموضوع" for row in rows)
    assert all("مقتطف عربي" in row.message for row in rows)
    assert all(row.data is not None for row in rows)
    assert all(row.data is not None and row.data["post_id"] == str(post.id) for row in rows)
    assert all(
        row.data is not None and row.data["cta_url"].endswith(f"/blog/{post.slug}") for row in rows
    )

    assert {to for to, _ in captured_emails} == {"blog-first@test.com", "blog-second@test.com"}
    for _, content in captured_emails:
        assert "عنوان الموضوع" in content.subject
        assert content.cta_url is not None
        assert content.cta_url.endswith(f"/blog/{post.slug}")


async def test_the_author_receives_neither_a_notification_nor_a_mail(
    uow: UnitOfWork, captured_emails: list
) -> None:
    author = await _make_user(uow, "only-author@test.com", role=RoleName.ADMIN)
    await _make_user(uow, "other-member@test.com")
    post = await _make_post(uow, author)
    await uow.commit()

    await handle_blog_post_published(uow, _published_event(post))

    rows = await _notifications(uow)
    assert all(row.user_id != author.id for row in rows)
    assert "only-author@test.com" not in {to for to, _ in captured_emails}


async def test_member_who_did_not_opt_in_to_mail_gets_the_notification_without_a_mail(
    uow: UnitOfWork, captured_emails: list
) -> None:
    author = await _make_user(uow, "mail-pref-author@test.com", role=RoleName.SERVANT)
    opted_out = await _make_user(
        uow,
        "mail-opted-out@test.com",
        email_verified=False,
    )
    post = await _make_post(uow, author)
    await uow.commit()

    await handle_blog_post_published(uow, _published_event(post))

    rows = await _notifications(uow)
    assert [row.user_id for row in rows] == [opted_out.id]
    assert "mail-opted-out@test.com" not in {to for to, _ in captured_emails}


async def test_replaying_the_event_does_not_duplicate_the_notification_or_the_mail(
    uow: UnitOfWork, captured_emails: list
) -> None:
    author = await _make_user(uow, "replay-author@test.com", role=RoleName.SERVANT)
    member = await _make_user(uow, "replay-member@test.com")
    post = await _make_post(uow, author)
    await uow.commit()

    event = _published_event(post)
    await handle_blog_post_published(uow, event)
    await handle_blog_post_published(uow, event)

    rows = await _notifications(uow)
    assert len(rows) == 1
    assert rows[0].user_id == member.id
    assert [to for to, _ in captured_emails] == ["replay-member@test.com"]


async def test_a_suspended_member_receives_nothing(uow: UnitOfWork, captured_emails: list) -> None:
    author = await _make_user(uow, "suspended-author@test.com", role=RoleName.SERVANT)
    suspended = await _make_user(
        uow,
        "suspended-member@test.com",
        status=UserStatus.SUSPENDED,
    )
    post = await _make_post(uow, author)
    await uow.commit()

    await handle_blog_post_published(uow, _published_event(post))

    rows = await _notifications(uow)
    assert all(row.user_id != suspended.id for row in rows)
    assert "suspended-member@test.com" not in {to for to, _ in captured_emails}


async def test_one_mail_failure_does_not_stop_the_other_members(
    uow: UnitOfWork, monkeypatch: pytest.MonkeyPatch
) -> None:
    author = await _make_user(uow, "failure-author@test.com", role=RoleName.SERVANT)
    failed = await _make_user(uow, "mail-fails@test.com")
    delivered = await _make_user(uow, "mail-delivered@test.com")
    post = await _make_post(uow, author)
    await uow.commit()
    sent: list[str] = []

    async def _fail_one(self: EmailService, *, to_email: str, content: object) -> bool:
        del self, content
        if to_email == failed.email:
            raise RuntimeError("mail provider failed")
        sent.append(to_email)
        return True

    monkeypatch.setattr(EmailService, "send", _fail_one)

    await handle_blog_post_published(uow, _published_event(post))

    rows = await _notifications(uow)
    assert {row.user_id for row in rows} == {failed.id, delivered.id}
    assert sent == [delivered.email]


@pytest.mark.parametrize(
    ("status", "published_at"),
    [
        (PostStatus.DRAFT, datetime.now(UTC) - timedelta(minutes=1)),
        (PostStatus.DRAFT, datetime.now(UTC) + timedelta(days=1)),
        (PostStatus.ARCHIVED, datetime.now(UTC) - timedelta(minutes=1)),
        (PostStatus.PUBLISHED, datetime.now(UTC) + timedelta(days=1)),
    ],
)
async def test_a_post_that_is_not_published_and_due_notifies_nobody(
    uow: UnitOfWork,
    captured_emails: list,
    status: PostStatus,
    published_at: datetime,
) -> None:
    author = await _make_user(uow, f"not-due-{status.value}-{published_at.timestamp()}@test.com")
    post = await _make_post(
        uow,
        author,
        status=status,
        published_at=published_at,
    )
    await uow.commit()

    await handle_blog_post_published(uow, _published_event(post))

    assert await _notifications(uow) == []
    assert captured_emails == []


async def test_the_mail_fan_out_respects_the_configured_concurrency(
    uow: UnitOfWork, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "NOTIFICATION_EMAIL_CONCURRENCY", 2)
    author = await _make_user(uow, "concurrency-author@test.com", role=RoleName.SERVANT)
    for index in range(5):
        await _make_user(uow, f"concurrency-member-{index}@test.com")
    post = await _make_post(uow, author)
    await uow.commit()

    active = 0
    maximum_active = 0
    sent: list[str] = []

    async def _track_send(self: EmailService, *, to_email: str, content: object) -> bool:
        nonlocal active, maximum_active
        del self, content
        active += 1
        maximum_active = max(maximum_active, active)
        await asyncio.sleep(0.01)
        active -= 1
        sent.append(to_email)
        return True

    monkeypatch.setattr(EmailService, "send", _track_send)

    await handle_blog_post_published(uow, _published_event(post))

    assert len(sent) == 5
    assert maximum_active <= 2
