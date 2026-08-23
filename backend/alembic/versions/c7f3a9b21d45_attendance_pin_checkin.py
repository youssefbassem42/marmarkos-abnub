"""attendance PIN check-in

Adds the offline fallback identity: a member-configured numeric PIN that
an ADMIN/SERVANT can type on the check-in screen when the member has no
way to show their QR code (e.g. no internet on their phone):

* ``users.attendance_pin_hash`` -- nullable, globally UNIQUE. Uniqueness
  is what makes a PIN-only lookup unambiguous: the server hashes the
  typed PIN and finds exactly one account or none.
* ``method`` CHECK now also accepts ``PIN`` next to QR_SCAN / MANUAL.

Revision ID: c7f3a9b21d45
Revises: d9e2f4a61b37
Create Date: 2026-08-23 03:00:00.000000

"""
from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7f3a9b21d45'
down_revision: Union[str, None] = 'd9e2f4a61b37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('attendance_pin_hash', sa.String(length=64), nullable=True),
    )
    op.create_index(
        'ix_users_attendance_pin_hash',
        'users',
        ['attendance_pin_hash'],
        unique=True,
    )
    op.drop_constraint(
        'ck_weekly_attendance_method', 'weekly_attendance_records', type_='check'
    )
    op.create_check_constraint(
        'ck_weekly_attendance_method',
        'weekly_attendance_records',
        "method IN ('QR_SCAN', 'MANUAL', 'PIN')",
    )


def downgrade() -> None:
    # Records made via PIN are not deleted by the downgrade; they simply
    # become unconstrained varchar values once the CHECK is relaxed.
    op.drop_constraint(
        'ck_weekly_attendance_method', 'weekly_attendance_records', type_='check'
    )
    op.create_check_constraint(
        'ck_weekly_attendance_method',
        'weekly_attendance_records',
        "method IN ('QR_SCAN', 'MANUAL')",
    )
    op.drop_index('ix_users_attendance_pin_hash', table_name='users')
    op.drop_column('users', 'attendance_pin_hash')
