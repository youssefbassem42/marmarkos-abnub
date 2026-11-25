"""Add the stable tiny link code of a blog post.

The column is nullable while the migration runs so the unique index can
be installed before the old rows receive their code.  Every existing post
is backfilled with eight letters or digits; the code never changes after
that (BR-87).

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-24
"""

import secrets
import string
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SHORT_CODE_ALPHABET = string.ascii_letters + string.digits


def _new_short_code() -> str:
    return "".join(secrets.choice(_SHORT_CODE_ALPHABET) for _ in range(8))


def upgrade() -> None:
    op.add_column(
        "blog_posts",
        sa.Column("short_code", sa.String(length=16), nullable=True),
    )
    op.create_index(
        "ix_blog_posts_short_code",
        "blog_posts",
        ["short_code"],
        unique=True,
    )

    connection = op.get_bind()
    existing_codes = set(
        connection.execute(
            sa.text("SELECT short_code FROM blog_posts WHERE short_code IS NOT NULL")
        ).scalars()
    )
    rows = connection.execute(
        sa.text("SELECT id FROM blog_posts WHERE short_code IS NULL")
    ).fetchall()
    for (post_id,) in rows:
        code = _new_short_code()
        while code in existing_codes:
            code = _new_short_code()
        existing_codes.add(code)
        connection.execute(
            sa.text("UPDATE blog_posts SET short_code = :code WHERE id = :post_id"),
            {"code": code, "post_id": post_id},
        )


def downgrade() -> None:
    op.drop_index("ix_blog_posts_short_code", table_name="blog_posts")
    op.drop_column("blog_posts", "short_code")
