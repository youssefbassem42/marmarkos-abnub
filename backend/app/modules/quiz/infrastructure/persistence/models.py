"""SQLAlchemy ORM models for the quiz module (Part 1 §4.5–§4.6).

Grading fields on ``quiz_attempts``/``quiz_answers`` are snapshots:
editing a published quiz never mutates historical attempts (BR-22).
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.quiz.domain.enums import AttemptStatus, QuizStatus
from app.shared.infrastructure.persistence.base import (
    Base,
    CreatedAtMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.bible.infrastructure.persistence.models import BibleVerse
    from app.modules.users.infrastructure.persistence.models import User


class Quiz(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quizzes"
    __table_args__ = (
        # D-12: exactly one quiz per verse.
        Index("uq_quizzes_verse_id", "verse_id", unique=True),
        CheckConstraint(
            "duration_seconds >= 30 AND duration_seconds <= 7200",
            name="ck_quizzes_duration",
        ),
        Index("ix_quizzes_status", "status"),
    )

    verse_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bible_verses.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    # Derived from sum(question.points) on every question mutation (BR-18);
    # read-only through the API.
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[QuizStatus] = mapped_column(
        SAEnum(QuizStatus, native_enum=False, length=20),
        default=QuizStatus.DRAFT,
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    verse: Mapped["BibleVerse"] = relationship(back_populates="quiz")
    questions: Mapped[list["QuizQuestion"]] = relationship(
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.position",
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizQuestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quiz_questions"
    __table_args__ = (
        CheckConstraint("points >= 1 AND points <= 100", name="ck_quiz_questions_points"),
        # Non-unique on purpose: drag-reorder rewrites all positions in one
        # transaction and a unique index would deadlock on transient
        # duplicates. Deterministic order is position, created_at, id.
        Index("ix_quiz_questions_quiz_position", "quiz_id", "position"),
    )

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")
    options: Mapped[list["QuizOption"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuizOption.position",
    )
    answers: Mapped[list["QuizAnswer"]] = relationship(back_populates="question")


class QuizOption(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "quiz_options"
    __table_args__ = (
        # "At most one" correct answer at the database level (BR-20);
        # "exactly one" is enforced by validation before the write.
        Index(
            "uq_quiz_options_correct",
            "question_id",
            unique=True,
            postgresql_where=text("is_correct"),
        ),
        Index("ix_quiz_options_question_position", "question_id", "position"),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False
    )
    option_text: Mapped[str] = mapped_column(String(500), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    question: Mapped[QuizQuestion] = relationship(back_populates="options")
    selected_by_answers: Mapped[list["QuizAnswer"]] = relationship()


class QuizAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One member attempt with a pause-safe active-time budget.

    BR-24..BR-30 revised (V2): there is no wall-clock deadline. The quiz
    only ever finishes when the member submits. ``budget_remaining_seconds``
    holds the remaining active time; it is charged only while the member is
    in the quiz (client heartbeats), so it freezes whenever they leave.
    """

    __tablename__ = "quiz_attempts"
    __table_args__ = (
        # D-4: one attempt per user per quiz.
        Index("uq_quiz_attempts_quiz_user", "quiz_id", "user_id", unique=True),
        Index("ix_quiz_attempts_quiz_status", "quiz_id", "status"),
        Index("ix_quiz_attempts_user_finished", "user_id", "finished_at"),
    )

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    budget_remaining_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[AttemptStatus] = mapped_column(
        SAEnum(AttemptStatus, native_enum=False, length=20),
        default=AttemptStatus.IN_PROGRESS,
        nullable=False,
    )
    # Snapshots taken at start so later quiz edits never rewrite history.
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, nullable=False)
    question_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_count: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    incorrect_count: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    quiz: Mapped[Quiz] = relationship(back_populates="attempts")
    user: Mapped["User"] = relationship(back_populates="quiz_attempts")
    answers: Mapped[list["QuizAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class QuizAnswer(UUIDPrimaryKeyMixin, Base):
    """One stored selection; grading fields are written only on submit."""

    __tablename__ = "quiz_answers"
    __table_args__ = (
        # BR-26 incremental upsert of the current selection per question.
        Index(
            "uq_quiz_answers_attempt_question",
            "attempt_id",
            "question_id",
            unique=True,
        ),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False
    )
    selected_option_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("quiz_options.id", ondelete="SET NULL")
    )
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    points_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    attempt: Mapped[QuizAttempt] = relationship(back_populates="answers")
    question: Mapped[QuizQuestion] = relationship(back_populates="answers")
