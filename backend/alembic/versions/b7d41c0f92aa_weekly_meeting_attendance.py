"""weekly_meeting_attendance

Attendance moves from daily check-ins to one weekly meeting (Thursday):

* ``daily_attendance_records`` -> ``weekly_attendance_records``
* ``attendance_date`` -> ``meeting_date``
* existing rows are snapped back to the Thursday of their meeting week
  (a meeting week runs Thursday -> Wednesday), keeping the earliest
  check-in when snapping would collide on (user_id, meeting_date)
* the unique index still guarantees a user cannot be recorded twice for
  the same meeting

Revision ID: b7d41c0f92aa
Revises: e6c8dd49ee41
Create Date: 2026-08-21 14:55:00.000000

"""
from collections.abc import Sequence
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7d41c0f92aa'
down_revision: Union[str, None] = 'e6c8dd49ee41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Old indexes reference the old table/column names.
    op.drop_index('uq_daily_attendance_user_date', table_name='daily_attendance_records')
    op.drop_index('ix_daily_attendance_status', table_name='daily_attendance_records')
    op.drop_index('ix_daily_attendance_date', table_name='daily_attendance_records')
    op.drop_index('ix_daily_attendance_user_id', table_name='daily_attendance_records')

    op.rename_table('daily_attendance_records', 'weekly_attendance_records')
    op.alter_column(
        'weekly_attendance_records', 'attendance_date', new_column_name='meeting_date'
    )

    # Snap every existing date to the Thursday of its meeting week.
    # Postgres EXTRACT(DOW) is 0=Sunday..6=Saturday, so Thursday is 4.
    op.execute(
        """
        UPDATE weekly_attendance_records
        SET meeting_date = meeting_date
            - (((EXTRACT(DOW FROM meeting_date)::int - 4 + 7) % 7) * INTERVAL '1 day')
        """
    )

    # Snapping can merge several daily rows into one meeting; keep the
    # earliest check-in per (user, meeting) so the unique index holds.
    op.execute(
        """
        DELETE FROM weekly_attendance_records w
        USING weekly_attendance_records keep
        WHERE w.user_id = keep.user_id
          AND w.meeting_date = keep.meeting_date
          AND (
                keep.check_in_at < w.check_in_at
                OR (keep.check_in_at = w.check_in_at AND keep.id < w.id)
              )
        """
    )

    op.create_index('ix_weekly_attendance_user_id', 'weekly_attendance_records', ['user_id'])
    op.create_index(
        'ix_weekly_attendance_meeting_date', 'weekly_attendance_records', ['meeting_date']
    )
    op.create_index('ix_weekly_attendance_status', 'weekly_attendance_records', ['status'])
    op.create_index(
        'uq_weekly_attendance_user_meeting',
        'weekly_attendance_records',
        ['user_id', 'meeting_date'],
        unique=True,
    )


def downgrade() -> None:
    # Note: dates stay snapped to Thursdays; the original per-day values
    # cannot be reconstructed.
    op.drop_index('uq_weekly_attendance_user_meeting', table_name='weekly_attendance_records')
    op.drop_index('ix_weekly_attendance_status', table_name='weekly_attendance_records')
    op.drop_index('ix_weekly_attendance_meeting_date', table_name='weekly_attendance_records')
    op.drop_index('ix_weekly_attendance_user_id', table_name='weekly_attendance_records')

    op.alter_column(
        'weekly_attendance_records', 'meeting_date', new_column_name='attendance_date'
    )
    op.rename_table('weekly_attendance_records', 'daily_attendance_records')

    op.create_index('ix_daily_attendance_user_id', 'daily_attendance_records', ['user_id'])
    op.create_index('ix_daily_attendance_date', 'daily_attendance_records', ['attendance_date'])
    op.create_index('ix_daily_attendance_status', 'daily_attendance_records', ['status'])
    op.create_index(
        'uq_daily_attendance_user_date',
        'daily_attendance_records',
        ['user_id', 'attendance_date'],
        unique=True,
    )
