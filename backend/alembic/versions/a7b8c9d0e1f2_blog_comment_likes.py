"""add the likes of blog comments and replies

Each member may like a comment or reply once. The unique pair is the
same idempotency guard used by the likes of a blog post.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "blog_comment_likes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "comment_id",
            sa.Uuid(),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "uq_blog_comment_likes_comment_user",
        "blog_comment_likes",
        ["comment_id", "user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_blog_comment_likes_comment_user", table_name="blog_comment_likes")
    op.drop_table("blog_comment_likes")
