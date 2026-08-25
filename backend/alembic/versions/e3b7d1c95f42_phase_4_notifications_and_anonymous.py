"""phase 4: bilingual notifications, per-user read state, anonymous message delivery

Revision ID: e3b7d1c95f42
Revises: f8a2c4e61b90
Create Date: 2026-08-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3b7d1c95f42'
down_revision: Union[str, None] = 'f8a2c4e61b90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Notifications become bilingual: `title`/`message` hold the Arabic
    # copy, `title_en`/`message_en` the English copy (BR-5). Existing rows
    # are grandfathered with their Arabic text as English so the column can
    # be made NOT NULL without a data loss window.
    op.add_column(
        'notifications',
        sa.Column('title_en', sa.String(length=255), nullable=True),
    )
    op.add_column(
        'notifications',
        sa.Column('message_en', sa.Text(), nullable=True),
    )
    op.execute('UPDATE notifications SET title_en = title, message_en = message')
    op.alter_column('notifications', 'title_en', existing_type=sa.String(length=255), nullable=False)
    op.alter_column('notifications', 'message_en', existing_type=sa.Text(), nullable=False)

    # Read state becomes per user for every notification, broadcast rows
    # included (BR-2). `notifications.read_at` is legacy from here on.
    op.create_table(
        'notification_reads',
        sa.Column('notification_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column(
            'read_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('notification_id', 'user_id'),
    )
    op.create_index(op.f('ix_notification_reads_user'), 'notification_reads', ['user_id'])

    # Feed ordering for broadcast rows needs a plain created_at index.
    op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'])

    # Anonymous messages: optional self-declared contact fields (never
    # account-derived, D-1/BR-11) and delivery bookkeeping for the admin
    # retry action (BR-14).
    op.add_column(
        'anonymous_messages',
        sa.Column('sender_name', sa.String(length=120), nullable=True),
    )
    op.add_column(
        'anonymous_messages',
        sa.Column('sender_phone', sa.String(length=32), nullable=True),
    )
    op.add_column(
        'anonymous_messages',
        sa.Column(
            'attempts',
            sa.Integer(),
            server_default='0',
            nullable=False,
        ),
    )
    op.add_column(
        'anonymous_messages',
        sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('anonymous_messages', 'last_attempt_at')
    op.drop_column('anonymous_messages', 'attempts')
    op.drop_column('anonymous_messages', 'sender_phone')
    op.drop_column('anonymous_messages', 'sender_name')
    op.drop_index(op.f('ix_notifications_created_at'), table_name='notifications')
    op.drop_index(op.f('ix_notification_reads_user'), table_name='notification_reads')
    op.drop_table('notification_reads')
    op.drop_column('notifications', 'message_en')
    op.drop_column('notifications', 'title_en')
