"""pay the author of a published blog post

The points ledger can now carry a blog post as well as a quiz attempt.
The unique post index is the database-level guarantee that a published
post is paid exactly once.

Revision ID: f6a7b8c9d0e1
Revises: d4e5f6a7b8c9
Create Date: 2026-11-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "point_transactions",
        "quiz_attempt_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )
    op.add_column(
        "point_transactions",
        sa.Column(
            "blog_post_id",
            sa.Uuid(),
            sa.ForeignKey("blog_posts.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index(
        "uq_point_transactions_blog_post",
        "point_transactions",
        ["blog_post_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_point_transactions_blog_post", table_name="point_transactions")
    op.drop_column("point_transactions", "blog_post_id")
    op.alter_column(
        "point_transactions",
        "quiz_attempt_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )
