"""replace wall-clock quiz deadline with a pause-safe active-time budget

V2 of the quiz take flow (BR-24..BR-30 revised): attempts no longer have an
``expires_at`` deadline and are never auto-finished. Instead each attempt
carries ``budget_remaining_seconds`` (charged only while the member is
actively in the quiz via heartbeats) and ``last_heartbeat_at``.

Revision ID: c9d4e5f6a87b
Revises: f576f03c1949
Create Date: 2026-09-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9d4e5f6a87b"
down_revision: Union[str, None] = "f576f03c1949"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_quiz_attempts_expiry", table_name="quiz_attempts")
    op.drop_column("quiz_attempts", "expires_at")

    op.add_column(
        "quiz_attempts",
        sa.Column("budget_remaining_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute("UPDATE quiz_attempts SET budget_remaining_seconds = duration_seconds")
    op.alter_column("quiz_attempts", "budget_remaining_seconds", server_default=None)

    op.add_column(
        "quiz_attempts",
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.add_column(
        "quiz_attempts",
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_quiz_attempts_expiry",
        "quiz_attempts",
        ["status", "expires_at"],
    )
    op.drop_column("quiz_attempts", "last_heartbeat_at")
    op.drop_column("quiz_attempts", "budget_remaining_seconds")
    op.alter_column("quiz_attempts", "expires_at", server_default=None)