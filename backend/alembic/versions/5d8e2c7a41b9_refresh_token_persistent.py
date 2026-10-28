"""The session of a member remembers whether it must outlive the browser.

The refresh cookie is a **session cookie** by default: it dies with the
browser, so the session ends when the window is closed. A member who
ticks "remember me" gets a cookie that lives 30 days.

The nature of the session lives in the row of the refresh token, not in
the cookie: the browser does not tell the server whether a cookie is a
session cookie, and the server has to re-issue the cookie on every
refresh. Without the column, the first refresh would turn every session
into a persistent one.

The column is added with the default ``false``: the sessions that exist
today keep the behaviour they have now (the cookie is re-issued as a
session cookie after the next refresh).

Revision ID: 5d8e2c7a41b9
Revises: b2e5c7a91d34
Create Date: 2026-10-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5d8e2c7a41b9"
down_revision: str | None = "b2e5c7a91d34"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column(
            "persistent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "persistent")
