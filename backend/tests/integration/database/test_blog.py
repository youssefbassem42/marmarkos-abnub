"""Blog post, category, like and search/filter persistence tests."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError

from app.core.database import async_session_factory
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.models import (
    BlogCategory,
    BlogPost,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import Role, User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def make_post(
    uow: UnitOfWork,
    author_id: uuid.UUID,
    title: str = "Hello Church",
    slug: str = "hello-church",
) -> BlogPost:
    post = BlogPost(
        author_id=author_id,
        title=title,
        slug=slug,
        content="Body",
        status=PostStatus.PUBLISHED,
        published_at=datetime.now(UTC),
    )
    await uow.blog_posts.add(post)
    return post


async def test_blog_post_creation(uow: UnitOfWork) -> None:
    author = await make_user(uow, "author@example.com")
    await make_post(uow, author.id)
    await uow.commit()

    stored = await uow.blog_posts.get_by_slug("hello-church")
    assert stored is not None
    assert stored.author_id == author.id
    assert stored.status is PostStatus.PUBLISHED


async def test_unique_blog_slug(uow: UnitOfWork) -> None:
    author = await make_user(uow, "slug@example.com")
    await make_post(uow, author.id, slug="shared-slug")
    await uow.commit()

    with pytest.raises(IntegrityError):
        async with UnitOfWork.create(async_session_factory) as second:
            await make_post(second, author.id, title="Another", slug="shared-slug")
            await second.commit()


async def test_blog_search_and_category_filter(uow: UnitOfWork) -> None:
    author = await make_user(uow, "search@example.com")
    await make_post(uow, author.id, title="Youth Sunday", slug="youth-sunday")
    await make_post(uow, author.id, title="Ladies Meeting", slug="ladies-meeting")
    category = BlogCategory(name="Youth", slug="youth", description="For the youth")
    await uow.blog_categories.add(category)
    await uow.commit()

    search_hits = await uow.blog_posts.list_published(search="youth")
    assert {post.slug for post in search_hits} == {"youth-sunday"}

    youth_post = await uow.blog_posts.get_by_slug("youth-sunday")
    assert youth_post is not None
    youth_post.categories.append(category)
    await uow.commit()

    filtered = await uow.blog_posts.list_published(category_slug="youth")
    assert [post.slug for post in filtered] == ["youth-sunday"]


async def test_like_uniqueness_and_toggle(uow: UnitOfWork) -> None:
    author = await make_user(uow, "like-author@example.com")
    liker = await make_user(uow, "liker@example.com")
    post = await make_post(uow, author.id)
    await uow.commit()

    liked = await uow.blog_likes.toggle(post.id, liker.id)
    await uow.commit()
    assert liked is True
    assert await uow.blog_likes.count_for_post(post.id) == 1

    # Second toggle unlikes.
    liked_again = await uow.blog_likes.toggle(post.id, liker.id)
    await uow.commit()
    assert liked_again is False
    assert await uow.blog_likes.count_for_post(post.id) == 0


async def test_like_unique_constraint(db_engine) -> None:
    from app.modules.blog.infrastructure.persistence.models import BlogPostLike as LikeModel

    async with db_engine.begin() as conn:
        role_id = (
            await conn.execute(select(Role.id).where(Role.name == RoleName.MEMBER))
        ).scalar_one()
        author_id = uuid.uuid4()
        liker_id = uuid.uuid4()
        post_id = uuid.uuid4()
        await conn.execute(
            insert(User).values(
                id=author_id,
                email="a@example.com",
                password_hash="h",
                public_id="USR_AA1",
                role_id=role_id,
            )
        )
        await conn.execute(
            insert(User).values(
                id=liker_id,
                email="l@example.com",
                password_hash="h",
                public_id="USR_AA2",
                role_id=role_id,
            )
        )
        await conn.execute(
            insert(BlogPost).values(
                id=post_id,
                author_id=author_id,
                title="t",
                slug="s-unique",
                content="c",
                status="PUBLISHED",
            )
        )
        await conn.execute(insert(LikeModel).values(post_id=post_id, user_id=liker_id))

    with pytest.raises(IntegrityError):
        async with db_engine.begin() as conn:
            await conn.execute(insert(LikeModel).values(post_id=post_id, user_id=liker_id))
