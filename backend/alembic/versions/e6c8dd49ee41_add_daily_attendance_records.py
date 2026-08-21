"""add_daily_attendance_records

Revision ID: e6c8dd49ee41
Revises: 60db6157691a
Create Date: 2026-08-21 11:35:46.835957

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6c8dd49ee41'
down_revision: Union[str, None] = '60db6157691a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create daily_attendance_records table for Phase 2 simplified attendance
    op.create_table(
        'daily_attendance_records',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('attendance_date', sa.Date(), nullable=False),
        sa.Column('check_in_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('recorded_by', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recorded_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for performance
    op.create_index('ix_daily_attendance_user_id', 'daily_attendance_records', ['user_id'])
    op.create_index('ix_daily_attendance_date', 'daily_attendance_records', ['attendance_date'])
    op.create_index('ix_daily_attendance_status', 'daily_attendance_records', ['status'])
    
    # Create unique constraint to prevent duplicate attendance per day
    op.create_index(
        'uq_daily_attendance_user_date',
        'daily_attendance_records',
        ['user_id', 'attendance_date'],
        unique=True
    )


def downgrade() -> None:
    op.drop_index('uq_daily_attendance_user_date', table_name='daily_attendance_records')
    op.drop_index('ix_daily_attendance_status', table_name='daily_attendance_records')
    op.drop_index('ix_daily_attendance_date', table_name='daily_attendance_records')
    op.drop_index('ix_daily_attendance_user_id', table_name='daily_attendance_records')
    op.drop_table('daily_attendance_records')