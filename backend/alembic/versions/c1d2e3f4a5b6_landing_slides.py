"""The slides of the landing page.

Adds the ``landing_slides`` table so the admin can change the images of the
landing-page slider from the admin panel.

The active flag defaults to ``true``: a newly created slide is visible to
the members until the admin deactivates or deletes it.

Revision ID: c1d2e3f4a5b6
Revises: 5d8e2c7a41b9
Create Date: 2026-10-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "5d8e2c7a41b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "landing_slides",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("image", sa.String(length=1000), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("subtitle", sa.String(length=300), nullable=True),
        sa.Column(
            "order",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "active",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_landing_slides_order"), "landing_slides", ["order"])
    op.create_index(op.f("ix_landing_slides_active"), "landing_slides", ["active"])


def downgrade() -> None:
    op.drop_index(op.f("ix_landing_slides_active"), table_name="landing_slides")
    op.drop_index(op.f("ix_landing_slides_order"), table_name="landing_slides")
    op.drop_table("landing_slides")
