"""email verification + auth_tokens

Revision ID: f8a2c4e61b90
Revises: c7f3a9b21d45
Create Date: 2026-08-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a2c4e61b90'
down_revision: Union[str, None] = 'c7f3a9b21d45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing members are grandfathered in as verified: they pre-date the
    # verification step and must not be locked out of their accounts.
    op.add_column(
        'users',
        sa.Column(
            'email_verified',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true'),
        ),
    )
    op.execute('ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false')

    op.create_table(
        'auth_tokens',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column(
            'purpose',
            sa.Enum(
                'EMAIL_VERIFICATION',
                'PASSWORD_RESET',
                name='authtokenpurpose',
                native_enum=False,
                length=30,
            ),
            nullable=False,
        ),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_auth_tokens_user_id'), 'auth_tokens', ['user_id'])
    op.create_index(op.f('ix_auth_tokens_token_hash'), 'auth_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_auth_tokens_purpose'), 'auth_tokens', ['purpose'])


def downgrade() -> None:
    op.drop_index(op.f('ix_auth_tokens_purpose'), table_name='auth_tokens')
    op.drop_index(op.f('ix_auth_tokens_token_hash'), table_name='auth_tokens')
    op.drop_index(op.f('ix_auth_tokens_user_id'), table_name='auth_tokens')
    op.drop_table('auth_tokens')
    op.drop_column('users', 'email_verified')
