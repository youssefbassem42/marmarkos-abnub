"""Comment/reply and moderation persistence tests."""

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.modules.comments.domain.enums.comment_status import CommentStatus
from app.modules.comments.infrastructure.persistence.models import Comment
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user
from tests.integration.database.test_blog import make_post


async def test_comment_and_reply_relationship(uow: UnitOfWork, db_session) -> None:
    author = await make_user(uow, "post-author@example.com")
    commenter = await make_user(uow, "commenter@example.com")
    replier = await make_user(uow, "replier@example.com")
    post = await make_post(uow, author.id)
    await uow.commit()

    top = Comment(post_id=post.id, user_id=commenter.id, content="First!")
    await uow.comments.add(top)
    await uow.commit()

    reply = Comment(
        post_id=post.id,
        user_id=replier.id,
        parent_comment_id=top.id,
        content="Reply to first",
    )
    await uow.comments.add(reply)
    await uow.commit()

    # Eager-load relationships to avoid async lazy-load (MissingGreenlet).
    stmt = (
        select(Comment)
        .options(selectinload(Comment.replies), selectinload(Comment.parent))
        .order_by(Comment.created_at)
    )
    rows = list((await db_session.execute(stmt)).scalars().unique().all())
    assert len(rows) == 2

    top_row = next(c for c in rows if c.id == top.id)
    assert top_row.parent is None
    assert len(top_row.replies) == 1
    assert top_row.replies[0].id == reply.id

    reply_row = next(c for c in rows if c.id == reply.id)
    assert reply_row.parent is not None
    assert reply_row.parent.id == top.id


async def test_comment_moderation_status(uow: UnitOfWork) -> None:
    author = await make_user(uow, "mod-author@example.com")
    commenter = await make_user(uow, "mod-commenter@example.com")
    post = await make_post(uow, author.id)
    comment = Comment(post_id=post.id, user_id=commenter.id, content="Suspicious")
    await uow.comments.add(comment)
    await uow.commit()

    stored = await uow.comments.get_by_id(comment.id)
    assert stored is not None
    assert stored.status is CommentStatus.VISIBLE

    await uow.comments.set_status(stored, CommentStatus.HIDDEN)
    await uow.commit()

    visible = await uow.comments.list_by_post(post.id)
    assert visible == []
    moderated = await uow.comments.list_by_post(post.id, include_hidden=True)
    assert len(moderated) == 1


async def test_comment_never_physically_deleted(uow: UnitOfWork, db_session) -> None:
    author = await make_user(uow, "del-author@example.com")
    commenter = await make_user(uow, "del-commenter@example.com")
    post = await make_post(uow, author.id)
    comment = Comment(post_id=post.id, user_id=commenter.id, content="Remove me")
    await uow.comments.add(comment)
    await uow.commit()

    await uow.comments.set_status(comment, CommentStatus.DELETED)
    await uow.commit()

    rows = list((await db_session.execute(select(Comment))).scalars().all())
    assert len(rows) == 1
    assert rows[0].status is CommentStatus.DELETED


async def test_reply_depth_is_free(uow: UnitOfWork) -> None:
    """Replies may nest (threaded conversation) without schema changes."""
    author = await make_user(uow, "deep-author@example.com")
    commenter = await make_user(uow, "deep-commenter@example.com")
    post = await make_post(uow, author.id)
    await uow.commit()

    c1 = Comment(post_id=post.id, user_id=commenter.id, content="L1")
    await uow.comments.add(c1)
    await uow.commit()
    c2 = Comment(post_id=post.id, user_id=commenter.id, parent_comment_id=c1.id, content="L2")
    await uow.comments.add(c2)
    await uow.commit()
    c3 = Comment(post_id=post.id, user_id=commenter.id, parent_comment_id=c2.id, content="L3")
    await uow.comments.add(c3)
    await uow.commit()

    assert c3.parent_comment_id == c2.id
    assert c2.parent_comment_id == c1.id
