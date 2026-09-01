"""phase 5b: quizzes, attempts, answers, points ledger

Revision ID: b8c9d0e1f2a3
Revises: a1b2c3d4e5f6
Create Date: 2026-08-26 12:30:00.000000

Implements Part 1 §4.9 revision p5_b (§4.5/§4.6 tables):
- quizzes / quiz_questions / quiz_options with the one-quiz-per-verse and
  at-most-one-correct-option partial unique indexes (D-12/BR-20);
- quiz_attempts / quiz_answers with attempt uniqueness and answer upsert
  keys (D-4/BR-26) plus snapshot columns for stable history (BR-22);
- the append-only point_transactions ledger unique per attempt (BR-31).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- quizzes (§4.5, D-12 + BR-17) ----------------------------------------
    op.create_table(
        'quizzes',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'verse_id',
            sa.Uuid(),
            sa.ForeignKey('bible_verses.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=False),
        sa.Column('total_points', sa.Integer(), server_default='0', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='DRAFT', nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_by',
            sa.Uuid(),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            'duration_seconds >= 30 AND duration_seconds <= 7200', name='ck_quizzes_duration'
        ),
    )
    op.create_index('uq_quizzes_verse_id', 'quizzes', ['verse_id'], unique=True)
    op.create_index(op.f('ix_quizzes_status'), 'quizzes', ['status'])

    # -- quiz_questions (§4.5, BR-19; non-unique position by design) --------
    op.create_table(
        'quiz_questions',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'quiz_id', sa.Uuid(), sa.ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('points', sa.SmallInteger(), server_default='1', nullable=False),
        sa.Column('position', sa.SmallInteger(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint('points >= 1 AND points <= 100', name='ck_quiz_questions_points'),
    )
    op.create_index('ix_quiz_questions_quiz_position', 'quiz_questions', ['quiz_id', 'position'])

    # -- quiz_options (§4.5, BR-20 partial unique correct answer) -----------
    op.create_table(
        'quiz_options',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'question_id',
            sa.Uuid(),
            sa.ForeignKey('quiz_questions.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('option_text', sa.String(length=500), nullable=False),
        sa.Column('is_correct', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('position', sa.SmallInteger(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        'uq_quiz_options_correct',
        'quiz_options',
        ['question_id'],
        unique=True,
        postgresql_where=sa.text('is_correct'),
    )
    op.create_index(
        'ix_quiz_options_question_position', 'quiz_options', ['question_id', 'position']
    )

    # -- quiz_attempts (§4.6, D-4 + BR-22 snapshots + BR-30 expiry index) ---
    op.create_table(
        'quiz_attempts',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'quiz_id', sa.Uuid(), sa.ForeignKey('quizzes.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column(
            'user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='IN_PROGRESS', nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False),
        sa.Column('total_points', sa.Integer(), nullable=False),
        sa.Column('question_count', sa.SmallInteger(), nullable=False),
        sa.Column('score', sa.Integer(), server_default='0', nullable=False),
        sa.Column('correct_count', sa.SmallInteger(), server_default='0', nullable=False),
        sa.Column('incorrect_count', sa.SmallInteger(), server_default='0', nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        'uq_quiz_attempts_quiz_user', 'quiz_attempts', ['quiz_id', 'user_id'], unique=True
    )
    op.create_index('ix_quiz_attempts_quiz_status', 'quiz_attempts', ['quiz_id', 'status'])
    op.create_index(
        op.f('ix_quiz_attempts_user_finished'), 'quiz_attempts', ['user_id', 'finished_at']
    )
    op.create_index('ix_quiz_attempts_expiry', 'quiz_attempts', ['status', 'expires_at'])

    # -- quiz_answers (§4.6, BR-26 upsert key) -------------------------------
    op.create_table(
        'quiz_answers',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'attempt_id',
            sa.Uuid(),
            sa.ForeignKey('quiz_attempts.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'question_id',
            sa.Uuid(),
            sa.ForeignKey('quiz_questions.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'selected_option_id',
            sa.Uuid(),
            sa.ForeignKey('quiz_options.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('points_awarded', sa.Integer(), server_default='0', nullable=False),
        sa.Column(
            'answered_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column('graded_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        'uq_quiz_answers_attempt_question',
        'quiz_answers',
        ['attempt_id', 'question_id'],
        unique=True,
    )

    # -- point_transactions (§4.6, BR-31 append-only ledger) -----------------
    op.create_table(
        'point_transactions',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column(
            'user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column(
            'quiz_attempt_id',
            sa.Uuid(),
            sa.ForeignKey('quiz_attempts.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('source', sa.String(length=20), server_default='QUIZ', nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column(
            'awarded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column('period_week_start', sa.Date(), nullable=False),
        sa.Column('period_month', sa.Date(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint('points >= 0', name='ck_point_transactions_points'),
    )
    op.create_index(
        'uq_point_transactions_attempt', 'point_transactions', ['quiz_attempt_id'], unique=True
    )
    op.create_index(
        op.f('ix_point_transactions_user_awarded'),
        'point_transactions',
        ['user_id', 'awarded_at'],
    )
    op.create_index(
        op.f('ix_point_transactions_month_user'), 'point_transactions', ['period_month', 'user_id']
    )
    op.create_index(
        op.f('ix_point_transactions_week_user'),
        'point_transactions',
        ['period_week_start', 'user_id'],
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_point_transactions_week_user'), table_name='point_transactions')
    op.drop_index(op.f('ix_point_transactions_month_user'), table_name='point_transactions')
    op.drop_index(op.f('ix_point_transactions_user_awarded'), table_name='point_transactions')
    op.drop_index('uq_point_transactions_attempt', table_name='point_transactions')
    op.drop_constraint('ck_point_transactions_points', 'point_transactions', type_='check')
    op.drop_table('point_transactions')

    op.drop_index('uq_quiz_answers_attempt_question', table_name='quiz_answers')
    op.drop_table('quiz_answers')

    op.drop_index('ix_quiz_attempts_expiry', table_name='quiz_attempts')
    op.drop_index(op.f('ix_quiz_attempts_user_finished'), table_name='quiz_attempts')
    op.drop_index('ix_quiz_attempts_quiz_status', table_name='quiz_attempts')
    op.drop_index('uq_quiz_attempts_quiz_user', table_name='quiz_attempts')
    op.drop_table('quiz_attempts')

    op.drop_index('ix_quiz_options_question_position', table_name='quiz_options')
    op.drop_index('uq_quiz_options_correct', table_name='quiz_options')
    op.drop_table('quiz_options')

    op.drop_index('ix_quiz_questions_quiz_position', table_name='quiz_questions')
    op.drop_constraint('ck_quiz_questions_points', 'quiz_questions', type_='check')
    op.drop_table('quiz_questions')

    op.drop_index(op.f('ix_quizzes_status'), table_name='quizzes')
    op.drop_index('uq_quizzes_verse_id', table_name='quizzes')
    op.drop_constraint('ck_quizzes_duration', 'quizzes', type_='check')
    op.drop_table('quizzes')
