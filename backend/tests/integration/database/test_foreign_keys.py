"""Foreign key integrity and cascade behavior tests."""

import uuid
from datetime import date

import pytest
from sqlalchemy import delete, insert, select
from sqlalchemy.exc import IntegrityError

from app.modules.attendance.infrastructure.persistence.models import AttendanceRecord
from app.modules.blog.domain.enums.post_status import PostStatus
from app.modules.blog.infrastructure.persistence.models import BlogPost, BlogPostLike
from app.modules.comments.infrastructure.persistence.models import Comment
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import Role, User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def _role_id(db_engine, name: RoleName = RoleName.MEMBER) -> int:
    async with db_engine.connect() as conn:
        return (await conn.execute(select(Role.id).where(Role.name == name))).scalar_one()


async def test_user_cannot_be_inserted_without_role(db_engine) -> None:
    with pytest.raises(IntegrityError):
        async with db_engine.begin() as conn:
            await conn.execute(
                insert(User).values(
                    id=uuid.uuid4(),
                    email="norole@example.com",
                    password_hash="h",
                    public_id="USR_NOROLE",
                    role_id=99999,
                )
            )


async def test_comment_fk_requires_post(db_engine) -> None:
    role_id = await _role_id(db_engine)
    with pytest.raises(IntegrityError):
        async with db_engine.begin() as conn:
            user_id = uuid.uuid4()
            await conn.execute(
                insert(User).values(
                    id=user_id,
                    email="orphan@example.com",
                    password_hash="h",
                    public_id="USR_ORPHAN",
                    role_id=role_id,
                )
            )
            await conn.execute(
                insert(Comment).values(
                    id=uuid.uuid4(),
                    post_id=uuid.uuid4(),
                    user_id=user_id,
                    content="orphan",
                )
            )


async def test_deleting_user_cascades_owned_content(uow: UnitOfWork, db_session) -> None:
    """User deletion cascades to blog posts/comments/likes (user-owned content).

    Note: users are normally only ever banned (status lifecycle), so this
    cascade is a safety net, not the primary workflow.
    """
    author = await make_user(uow, "cascade@example.com")
    await uow.commit()

    post = BlogPost(
        author_id=author.id,
        title="To delete",
        slug="to-delete",
        content="x",
        status=PostStatus.PUBLISHED,
    )
    await uow.blog_posts.add(post)
    comment = Comment(post_id=post.id, user_id=author.id, content="c")
    await uow.comments.add(comment)
    await uow.commit()

    await db_session.execute(delete(User).where(User.id == author.id))
    await db_session.commit()

    rows = (await db_session.execute(select(BlogPost))).scalars().all()
    assert rows == []


async def test_attendance_requires_valid_session(db_engine) -> None:
    role_id = await _role_id(db_engine)
    with pytest.raises(IntegrityError):
        async with db_engine.begin() as conn:
            user_id = uuid.uuid4()
            await conn.execute(
                insert(User).values(
                    id=user_id,
                    email="ghost@example.com",
                    password_hash="h",
                    public_id="USR_GHOST",
                    role_id=role_id,
                )
            )
            await conn.execute(
                insert(AttendanceRecord).values(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    session_id=uuid.uuid4(),
                    attendance_date=date(2026, 8, 20),
                )
            )


async def test_like_requires_existing_post_and_user(db_engine) -> None:
    with pytest.raises(IntegrityError):
        async with db_engine.begin() as conn:
            await conn.execute(
                insert(BlogPostLike).values(
                    id=uuid.uuid4(),
                    post_id=uuid.uuid4(),
                    user_id=uuid.uuid4(),
                )
            )
