"""The payload of the QR code of the member.

The check-in validates the **hash** of the payload, but the owner of the
code must be able to see **the same** code again (the member saves it
once and shows it to the servant without opening the platform). The
payload is therefore stored beside its hash.

The column is nullable: the rows created before this migration hold only
the hash, and the next visit of their owner creates the first readable
payload (the old code is replaced once, and only once).

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2026-11-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_qr_codes",
        sa.Column("payload", sa.String(length=128), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_qr_codes", "payload")
