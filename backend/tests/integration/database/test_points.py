"""Points ledger persistence tests (P5-007, BR-31..BR-35)."""

import uuid
from datetime import UTC, date, datetime, timedelta

from app.core.time.periods import iso_week_start, month_start
from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.points.infrastructure.persistence.models import PointTransaction
from app.modules.quiz.infrastructure.persistence.models import (
    Quiz,
    QuizAttempt,
    QuizQuestion,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def _attempt(
    uow: UnitOfWork,
    user_id: uuid.UUID,
    *,
    finished: bool = True,
) -> QuizAttempt:
    verse = BibleVerse(
        title="V",
        verse_reference="Mark 1:1",
        book="Mark",
        chapter=1,
        verse_start=1,
        text="...",
        status=VerseStatus.PUBLISHED,
    )
    await uow.bible_verses.add(verse)
    quiz = Quiz(verse_id=verse.id, title="Q", duration_seconds=60, total_points=2)
    await uow.quizzes.add(quiz)
    question = QuizQuestion(quiz_id=quiz.id, question="?", points=2, position=1)
    await uow.quiz_questions.add(question)
    started = datetime.now(UTC)
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user_id,
        started_at=started,
        expires_at=started + timedelta(seconds=60),
        status="COMPLETED" if finished else "IN_PROGRESS",
        submitted_at=started if finished else None,
        finished_at=started if finished else None,
        duration_seconds=60,
        total_points=question.points,
        question_count=1,
    )
    await uow.quiz_attempts.add(attempt)
    return attempt


async def test_award_is_idempotent_per_attempt(uow: UnitOfWork) -> None:
    """BR-31/BR-29: a repeated award cannot create a second ledger row."""
    user = await make_user(uow, "earner@example.com")
    attempt = await _attempt(uow, user.id)
    await uow.commit()

    awarded_at = datetime.now(UTC)
    row_one, inserted_one = await uow.point_transactions.award(
        user_id=user.id,
        quiz_attempt_id=attempt.id,
        points=attempt.score + 2,
        period_week_start=iso_week_start(awarded_at.date()),
        period_month=month_start(awarded_at.date()),
        awarded_at=awarded_at,
    )
    await uow.commit()
    assert inserted_one is True
    assert row_one.points == 2

    row_two, inserted_two = await uow.point_transactions.award(
        user_id=user.id,
        quiz_attempt_id=attempt.id,
        points=attempt.score + 2,
        period_week_start=iso_week_start(awarded_at.date()),
        period_month=month_start(awarded_at.date()),
        awarded_at=awarded_at,
    )
    await uow.commit()
    assert inserted_two is False
    assert row_two.id == row_one.id
    assert row_two.points == 2

    items, _total = await uow.point_transactions.history_page(user.id, limit=10, offset=0)
    assert len(items) == 1


async def test_negative_points_rejected_by_check(uow: UnitOfWork) -> None:
    user = await make_user(uow, "negative@example.com")
    attempt = await _attempt(uow, user.id)
    await uow.commit()

    try:
        await uow.session.add(
            PointTransaction(
                user_id=user.id,
                quiz_attempt_id=attempt.id,
                points=-1,
                period_week_start=date(2026, 8, 24),
                period_month=date(2026, 8, 1),
            )
        )
        await uow.session.flush()
    except Exception:
        await uow.session.rollback()
    else:
        raise AssertionError("negative points must violate ck_point_transactions_points")


async def test_period_keys_persist_for_cairo_midnight_boundary(uow: UnitOfWork) -> None:
    """BR-33: a Cairo-local Sunday 23:59 finish still lands in the right week/month."""
    user = await make_user(uow, "midnight@example.com")
    attempt = await _attempt(uow, user.id)
    await uow.commit()

    # Cairo is UTC+3 in summer: 2026-08-30 23:59 Cairo == 20:59 UTC.
    cairo_sunday_evening = datetime(2026, 8, 30, 20, 59, tzinfo=UTC)
    row, inserted = await uow.point_transactions.award(
        user_id=user.id,
        quiz_attempt_id=attempt.id,
        points=1,
        period_week_start=iso_week_start(cairo_sunday_evening.date()),
        period_month=month_start(cairo_sunday_evening.date()),
        awarded_at=cairo_sunday_evening,
    )
    await uow.commit()
    assert inserted is True
    # Sunday finishes the ISO week that began Monday 2026-08-24.
    assert row.period_week_start == date(2026, 8, 24)
    assert row.period_month == date(2026, 8, 1)


async def test_totals_split_by_periods(uow: UnitOfWork) -> None:
    from datetime import date as date_cls

    user = await make_user(uow, "totals@example.com")
    attempt = await _attempt(uow, user.id)
    await uow.commit()

    await uow.point_transactions.award(
        user_id=user.id,
        quiz_attempt_id=attempt.id,
        points=4,
        period_week_start=date_cls(2026, 8, 24),
        period_month=date_cls(2026, 8, 1),
    )
    await uow.commit()
    totals = await uow.point_transactions.totals_for_user(user.id, today=date_cls(2026, 8, 26))
    assert totals == {"lifetime": 4, "this_week": 4, "this_month": 4}

    # After the month rolls over: this_week/this_month reset, lifetime keeps.
    later_totals = await uow.point_transactions.totals_for_user(user.id, today=date_cls(2026, 9, 3))
    assert later_totals == {"lifetime": 4, "this_week": 0, "this_month": 0}
