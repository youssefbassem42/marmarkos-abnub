"""attendance late status and method

Adds the LATE status (BR-2) and the scan method to weekly attendance:

* ``method`` column (QR_SCAN / MANUAL), back-filled with QR_SCAN
* CHECK constraints mirroring the domain enums on ``status`` and
  ``method``
* composite index (meeting_date, check_in_at) for the meeting roster

No data back-fill: existing rows keep status PRESENT and method QR_SCAN.

Revision ID: d9e2f4a61b37
Revises: a4f7c2d91e83
Create Date: 2026-08-22 12:00:00.000000

"""
from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9e2f4a61b37'
down_revision: Union[str, None] = 'a4f7c2d91e83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'weekly_attendance_records',
        sa.Column('method', sa.String(length=20), nullable=False, server_default='QR_SCAN'),
    )
    op.create_check_constraint(
        'ck_weekly_attendance_status',
        'weekly_attendance_records',
        "status IN ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED')",
    )
    op.create_check_constraint(
        'ck_weekly_attendance_method',
        'weekly_attendance_records',
        "method IN ('QR_SCAN', 'MANUAL')",
    )
    op.create_index(
        'ix_weekly_attendance_meeting_check_in',
        'weekly_attendance_records',
        ['meeting_date', 'check_in_at'],
    )


def downgrade() -> None:
    # LATE rows are not reclassified; they simply become unconstrained
    # varchar values once the CHECK constraint is dropped.
    op.drop_index(
        'ix_weekly_attendance_meeting_check_in', table_name='weekly_attendance_records'
    )
    op.drop_constraint(
        'ck_weekly_attendance_method', 'weekly_attendance_records', type_='check'
    )
    op.drop_constraint(
        'ck_weekly_attendance_status', 'weekly_attendance_records', type_='check'
    )
    op.drop_column('weekly_attendance_records', 'method')
