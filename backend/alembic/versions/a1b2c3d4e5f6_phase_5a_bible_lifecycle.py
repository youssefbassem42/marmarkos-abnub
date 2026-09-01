"""phase 5a: bible verse lifecycle, publication schedules, engagement

Revision ID: a1b2c3d4e5f6
Revises: e3b7d1c95f42
Create Date: 2026-08-26 12:00:00.000000

Implements Part 1 §4.9 revision p5_a:
- bible_verses gains the Phase 5 content/lifecycle columns (D-2), with a
  deterministic backfill from the legacy shape, and loses ``is_published``
  plus the weekly unique index (BR-5).
- verse_publication_schedules / verse_views / verse_reads are created
  (§4.3/§4.4) including both partial unique indexes (BR-9/BR-14).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e3b7d1c95f42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- bible_verses: new columns (nullable first, then backfilled) --------
    op.add_column(
        'bible_verses',
        sa.Column('status', sa.String(length=20), nullable=True),
    )
    op.add_column('bible_verses', sa.Column('title', sa.String(length=100), nullable=True))
    op.add_column('bible_verses', sa.Column('subtitle', sa.String(length=200), nullable=True))
    op.add_column('bible_verses', sa.Column('book', sa.String(length=60), nullable=True))
    op.add_column('bible_verses', sa.Column('chapter', sa.SmallInteger(), nullable=True))
    op.add_column('bible_verses', sa.Column('verse_start', sa.SmallInteger(), nullable=True))
    op.add_column('bible_verses', sa.Column('verse_end', sa.SmallInteger(), nullable=True))
    op.add_column('bible_verses', sa.Column('reflection', sa.Text(), nullable=True))

    # Deterministic backfill (D-2): published rows become PUBLISHED,
    # everything else DRAFT; title falls back to the reference; book is
    # the first word of the reference.
    op.execute(
        """
        UPDATE bible_verses SET status = CASE WHEN is_published THEN 'PUBLISHED' ELSE 'DRAFT' END
        """
    )
    op.execute("UPDATE bible_verses SET title = substring(verse_reference FROM 1 FOR 100)")
    op.execute(
        """
        UPDATE bible_verses SET book = CASE
            WHEN nullif(split_part(verse_reference, ' ', 1), '') IS NOT NULL
            THEN split_part(verse_reference, ' ', 1)
            ELSE 'Unknown'
        END
        """
    )
    op.execute('UPDATE bible_verses SET chapter = 1, verse_start = 1')

    op.alter_column('bible_verses', 'status', existing_type=sa.String(length=20), nullable=False,
                    server_default='DRAFT')
    op.alter_column('bible_verses', 'title', existing_type=sa.String(length=100), nullable=False)
    op.alter_column('bible_verses', 'book', existing_type=sa.String(length=60), nullable=False)
    op.alter_column('bible_verses', 'chapter', existing_type=sa.SmallInteger(), nullable=False)
    op.alter_column('bible_verses', 'verse_start', existing_type=sa.SmallInteger(), nullable=False)

    # -- bible_verses: drop the weekly uniqueness regime (D-2) --------------
    op.drop_index('uq_bible_verses_published_week', table_name='bible_verses')
    op.alter_column('bible_verses', 'week_start_date', existing_type=sa.Date(), nullable=True)
    op.drop_column('bible_verses', 'is_published')

    # -- bible_verses: checks + new indexes (§4.2) --------------------------
    op.create_check_constraint(
        'ck_bible_verses_chapter', 'bible_verses', 'chapter >= 1 AND chapter <= 150'
    )
    op.create_check_constraint(
        'ck_bible_verses_verse_range',
        'bible_verses',
        'verse_end IS NULL OR verse_end >= verse_start',
    )
    op.create_index(
        'ix_bible_verses_status_published_at',
        'bible_verses',
        ['status', sa.text('published_at DESC')],
    )
    op.create_index(op.f('ix_bible_verses_created_by'), 'bible_verses', ['created_by'])

    # -- verse_publication_schedules (§4.3) ---------------------------------
    op.create_table(
        'verse_publication_schedules',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'verse_id',
            sa.Uuid(),
            sa.ForeignKey('bible_verses.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='SCHEDULED', nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('attempts', sa.SmallInteger(), server_default='0', nullable=False),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('notification_status', sa.String(length=20), server_default='PENDING',
                  nullable=False),
        sa.Column('notification_attempts', sa.SmallInteger(), server_default='0', nullable=False),
        sa.Column('notified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_by',
            sa.Uuid(),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
    )
    op.create_index(
        'uq_verse_publication_schedules_active',
        'verse_publication_schedules',
        ['verse_id'],
        unique=True,
        postgresql_where=sa.text("status = 'SCHEDULED'"),
    )
    op.create_index(
        'ix_verse_publication_schedules_due',
        'verse_publication_schedules',
        ['status', 'scheduled_at'],
    )

    # -- verse_views (§4.4) --------------------------------------------------
    op.create_table(
        'verse_views',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'verse_id',
            sa.Uuid(),
            sa.ForeignKey('bible_verses.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('opened_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
    )
    op.create_index('ix_verse_views_verse_opened', 'verse_views', ['verse_id', 'opened_at'])
    op.create_index('ix_verse_views_verse_user', 'verse_views', ['verse_id', 'user_id'])
    op.create_index(op.f('ix_verse_views_user_opened'), 'verse_views', ['user_id', 'opened_at'])

    # -- verse_reads (§4.4) --------------------------------------------------
    op.create_table(
        'verse_reads',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'verse_id',
            sa.Uuid(),
            sa.ForeignKey('bible_verses.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.func.now(),
                  nullable=False),
    )
    op.create_index(
        'uq_verse_reads_verse_user', 'verse_reads', ['verse_id', 'user_id'], unique=True
    )
    op.create_index('ix_verse_reads_verse_read_at', 'verse_reads', ['verse_id', 'read_at'])


def downgrade() -> None:
    # -- drop the engagement tables -----------------------------------------
    op.drop_index('ix_verse_reads_verse_read_at', table_name='verse_reads')
    op.drop_index('uq_verse_reads_verse_user', table_name='verse_reads')
    op.drop_table('verse_reads')

    op.drop_index(op.f('ix_verse_views_user_opened'), table_name='verse_views')
    op.drop_index('ix_verse_views_verse_user', table_name='verse_views')
    op.drop_index('ix_verse_views_verse_opened', table_name='verse_views')
    op.drop_table('verse_views')

    op.drop_index('ix_verse_publication_schedules_due', table_name='verse_publication_schedules')
    op.drop_index(
        'uq_verse_publication_schedules_active', table_name='verse_publication_schedules'
    )
    op.drop_table('verse_publication_schedules')

    # -- restore the pre-Phase-5 bible_verses shape -------------------------
    op.drop_index(op.f('ix_bible_verses_created_by'), table_name='bible_verses')
    op.drop_index('ix_bible_verses_status_published_at', table_name='bible_verses')
    op.drop_constraint('ck_bible_verses_verse_range', 'bible_verses', type_='check')
    op.drop_constraint('ck_bible_verses_chapter', 'bible_verses', type_='check')

    op.add_column(
        'bible_verses',
        sa.Column('is_published', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )
    op.execute("UPDATE bible_verses SET is_published = (status = 'PUBLISHED')")
    # The old schema required exactly one published verse per week; keep the
    # newest per week when several were published under Phase 5 rules (D-2).
    op.execute(
        """
        UPDATE bible_verses SET is_published = false
        WHERE id NOT IN (
            SELECT DISTINCT ON (week_start_date) id FROM bible_verses
            WHERE is_published AND week_start_date IS NOT NULL
            ORDER BY week_start_date, published_at DESC
        )
        """
    )
    op.create_index(
        'uq_bible_verses_published_week',
        'bible_verses',
        ['week_start_date'],
        unique=True,
        postgresql_where=sa.text('is_published'),
    )
    op.drop_column('bible_verses', 'reflection')
    op.drop_column('bible_verses', 'verse_end')
    op.drop_column('bible_verses', 'verse_start')
    op.drop_column('bible_verses', 'chapter')
    op.drop_column('bible_verses', 'book')
    op.drop_column('bible_verses', 'subtitle')
    op.drop_column('bible_verses', 'title')
    op.drop_column('bible_verses', 'status')
