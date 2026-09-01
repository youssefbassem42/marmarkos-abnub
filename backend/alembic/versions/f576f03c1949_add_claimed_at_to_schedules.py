"""add claimed_at to verse_publication_schedules for atomic claim pattern

Revision ID: f576f03c1949
Revises: b8c9d0e1f2a3
Create Date: 2026-08-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f576f03c1949"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "verse_publication_schedules",
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("verse_publication_schedules", "claimed_at")
