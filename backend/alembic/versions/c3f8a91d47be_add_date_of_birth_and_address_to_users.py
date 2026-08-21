"""add date_of_birth and address to users

Revision ID: c3f8a91d47be
Revises: b7d41c0f92aa
Create Date: 2026-08-22 10:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f8a91d47be'
down_revision: Union[str, None] = 'b7d41c0f92aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('address', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'address')
    op.drop_column('users', 'date_of_birth')
