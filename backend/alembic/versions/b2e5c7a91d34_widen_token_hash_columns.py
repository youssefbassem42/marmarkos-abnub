"""widen the token hash columns for the keyed (v2) token hashes

The refresh tokens and the single-use action tokens are stored as a hash.
The hash format changes from a plain SHA-256 (64 hex characters) to a
keyed HMAC-SHA-256 with a ``v2:`` prefix (67 characters), so both
columns have to grow.

This migration only *widens* the columns - it rewrites nothing, so the
deployment is safe in both directions and the old rows keep working
while the application reads both formats (dual read).

Revision ID: b2e5c7a91d34
Revises: c9d4e5f6a87b
Create Date: 2026-10-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2e5c7a91d34"
down_revision: Union[str, None] = "c9d4e5f6a87b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "refresh_tokens",
        "token_hash",
        existing_type=sa.String(length=64),
        type_=sa.String(length=128),
        existing_nullable=False,
    )
    op.alter_column(
        "auth_tokens",
        "token_hash",
        existing_type=sa.String(length=64),
        type_=sa.String(length=128),
        existing_nullable=False,
    )


def downgrade() -> None:
    # A v2 hash is 67 characters and does not fit into 64. The downgrade
    # therefore only works while no v2 row exists; after the first v2
    # token was issued it fails loudly instead of truncating a hash.
    op.alter_column(
        "refresh_tokens",
        "token_hash",
        existing_type=sa.String(length=128),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
    op.alter_column(
        "auth_tokens",
        "token_hash",
        existing_type=sa.String(length=128),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
