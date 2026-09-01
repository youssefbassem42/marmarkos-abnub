"""SQLAlchemy ORM model for the points module (Part 1 §4.6).

The ledger is append-only and immutable (BR-32): one row per completed
attempt, unique on ``quiz_attempt_id`` so double-awarding is impossible
at the database level (BR-31). Historical weekly/monthly reporting uses
the stored ``period_week_start``/``period_month`` columns so August stays
August when September begins (BR-33).
"""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.points.domain.enums import PointSource
from app.shared.infrastructure.persistence.base import (
    Base,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.quiz.infrastructure.persistence.models import QuizAttempt
    from app.modules.users.infrastructure.persistence.models import User


class PointTransaction(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "point_transactions"
    __table_args__ = (
        # BR-31: one award per completed attempt, ever.
        Index("uq_point_transactions_attempt", "quiz_attempt_id", unique=True),
        CheckConstraint("points >= 0", name="ck_point_transactions_points"),
        Index("ix_point_transactions_user_awarded", "user_id", "awarded_at"),
        Index("ix_point_transactions_month_user", "period_month", "user_id"),
        Index("ix_point_transactions_week_user", "period_week_start", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    quiz_attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False
    )
    source: Mapped[PointSource] = mapped_column(
        String(20), default=PointSource.QUIZ.value, nullable=False
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Platform-local period keys (D-5/BR-33), computed at award time.
    period_week_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_month: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="point_transactions")
    quiz_attempt: Mapped["QuizAttempt"] = relationship()
