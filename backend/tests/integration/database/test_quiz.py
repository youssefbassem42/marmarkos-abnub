"""Quiz module persistence tests (P5-006).

Every frozen constraint from Part 1 §4.5/§4.6 gets an explicit test:
one quiz per verse, at most one correct option, one attempt per user
per quiz, duration bounds, and the answer upsert path.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import async_session_factory
from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.quiz.infrastructure.persistence.models import (
    Quiz,
    QuizAnswer,
    QuizAttempt,
    QuizOption,
    QuizQuestion,
)
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.integration.database.conftest import make_user


async def _published_verse(uow: UnitOfWork) -> BibleVerse:
    verse = BibleVerse(
        title="Psalm 23",
        verse_reference="Psalm 23:1",
        book="Psalms",
        chapter=23,
        verse_start=1,
        text="The Lord is my shepherd",
        status=VerseStatus.PUBLISHED,
    )
    await uow.bible_verses.add(verse)
    return verse


async def _quiz(uow: UnitOfWork, **overrides: object) -> Quiz:
    defaults: dict = dict(
        verse_id=(await _published_verse(uow)).id,
        title="Psalm 23 Quiz",
        duration_seconds=120,
    )
    defaults.update(overrides)
    quiz = Quiz(**defaults)
    await uow.quizzes.add(quiz)
    return quiz


async def _question_with_options(
    uow: UnitOfWork, quiz_id: uuid.UUID, *, correct_options: int = 1
) -> QuizQuestion:
    question = QuizQuestion(quiz_id=quiz_id, question="Who is the shepherd?", points=2, position=1)
    await uow.quiz_questions.add(question)
    options = [
        QuizOption(
            question_id=question.id,
            option_text=f"Option {index}",
            is_correct=index <= correct_options,
            position=index,
        )
        for index in range(1, 4)
    ]
    for option in options:
        uow.session.add(option)
    await uow.session.flush()
    return question


async def test_unique_quiz_per_verse_blocks_second(uow: UnitOfWork) -> None:
    """D-12."""
    quiz = await _quiz(uow)
    await uow.commit()

    with pytest.raises(IntegrityError):
        async with UnitOfWork.create(async_session_factory) as second:
            second_quiz = Quiz(
                verse_id=quiz.verse_id,
                title="Another",
                duration_seconds=60,
            )
            await second.quizzes.add(second_quiz)
            await second.commit()


async def test_partial_unique_index_blocks_two_correct_options(uow: UnitOfWork) -> None:
    """BR-20."""
    quiz = await _quiz(uow)
    await uow.commit()
    question = await _question_with_options(uow, quiz.id)
    # Commit so the second session's unique-index check cannot block on
    # our own uncommitted correct option.
    await uow.commit()

    with pytest.raises(IntegrityError):
        async with UnitOfWork.create(async_session_factory) as second:
            second.session.add(
                QuizOption(question_id=question.id, option_text="Extra", is_correct=True, position=4)
            )
            await second.commit()


async def test_duration_check_rejects_out_of_bounds(uow: UnitOfWork) -> None:
    for bad_duration in (10, 8000):
        with pytest.raises(IntegrityError):
            async with UnitOfWork.create(async_session_factory) as second:
                verse = BibleVerse(
                    title=f"V{bad_duration}",
                    verse_reference="Rom 1:1",
                    book="Romans",
                    chapter=1,
                    verse_start=1,
                    text="...",
                )
                await second.bible_verses.add(verse)
                await second.quizzes.add(
                    Quiz(verse_id=verse.id, title="Q", duration_seconds=bad_duration)
                )
                await second.commit()


async def test_unique_attempt_per_user_per_quiz(uow: UnitOfWork) -> None:
    """D-4."""
    user = await make_user(uow, "attempter@example.com")
    quiz = await _quiz(uow)
    await uow.commit()
    started = datetime.now(UTC)
    await uow.quiz_attempts.add(
        QuizAttempt(
            quiz_id=quiz.id,
            user_id=user.id,
            started_at=started,
            expires_at=started + timedelta(seconds=120),
            duration_seconds=120,
            total_points=0,
            question_count=0,
        )
    )
    await uow.commit()

    with pytest.raises(IntegrityError):
        async with UnitOfWork.create(async_session_factory) as second:
            await second.quiz_attempts.add(
                QuizAttempt(
                    quiz_id=quiz.id,
                    user_id=user.id,
                    started_at=started,
                    expires_at=started + timedelta(seconds=120),
                    duration_seconds=120,
                    total_points=0,
                    question_count=0,
                )
            )
            await second.commit()


async def test_answer_upsert_keeps_one_row_per_question(uow: UnitOfWork) -> None:
    """BR-26: the incremental save is an upsert on (attempt, question)."""
    user = await make_user(uow, "answerer@example.com")
    quiz = await _quiz(uow)
    await uow.commit()
    question = await _question_with_options(uow, quiz.id)
    started = datetime.now(UTC)
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        started_at=started,
        expires_at=started + timedelta(seconds=120),
        duration_seconds=120,
        total_points=2,
        question_count=1,
    )
    await uow.quiz_attempts.add(attempt)
    await uow.commit()
    correct_option_id = (
        (
            await uow.session.execute(
                select_correct_option(question.id)
            )
        ).scalar_one()
    )

    first_at = await uow.quiz_answers.upsert(attempt.id, question.id, correct_option_id)
    other_option_id = (
        await uow.session.execute(
            select(QuizOption.id)
            .where(QuizOption.question_id == question.id)
            .where(QuizOption.is_correct.is_(False))
            .limit(1)
        )
    ).scalar_one()
    await uow.quiz_answers.upsert(attempt.id, question.id, other_option_id)
    await uow.commit()

    rows = list(await uow.quiz_answers.list_for_attempt(attempt.id))
    assert len(rows) == 1
    assert rows[0].selected_option_id == other_option_id
    assert rows[0].answered_at >= first_at - timedelta(seconds=1)


def select_correct_option(question_id: uuid.UUID):  # noqa: ANN201 - local helper
    from sqlalchemy import select

    from app.modules.quiz.infrastructure.persistence.models import QuizOption

    return select(QuizOption.id).where(
        QuizOption.question_id == question_id, QuizOption.is_correct.is_(True)
    )


async def test_quiz_answer_requires_existing_question(uow: UnitOfWork) -> None:
    user = await make_user(uow, "fk-answer@example.com")
    quiz = await _quiz(uow)
    await uow.commit()
    started = datetime.now(UTC)
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        started_at=started,
        expires_at=started + timedelta(seconds=120),
        duration_seconds=120,
        total_points=0,
        question_count=0,
    )
    await uow.quiz_attempts.add(attempt)
    await uow.commit()

    with pytest.raises(IntegrityError):
        await uow.quiz_answers.upsert(attempt.id, uuid.uuid4(), uuid.uuid4())
        await uow.commit()
    await uow.rollback()


async def test_reorder_rewrites_positions(uow: UnitOfWork) -> None:
    quiz = await _quiz(uow)
    await uow.commit()
    q1 = QuizQuestion(quiz_id=quiz.id, question="One", points=1, position=1)
    q2 = QuizQuestion(quiz_id=quiz.id, question="Two", points=1, position=2)
    q3 = QuizQuestion(quiz_id=quiz.id, question="Three", points=1, position=3)
    for question in (q1, q2, q3):
        await uow.quiz_questions.add(question)
    await uow.commit()

    await uow.quiz_questions.reorder(quiz.id, [q3.id, q1.id, q2.id])
    await uow.commit()

    ordered = list(await uow.quiz_questions.list_for_quiz(quiz.id))
    positions = {question.id: question.position for question in ordered}
    assert positions[q3.id] == 1
    assert positions[q1.id] == 2
    assert positions[q2.id] == 3


async def test_total_points_recompute(uow: UnitOfWork) -> None:
    quiz = await _quiz(uow)
    await uow.commit()
    await _question_with_options(uow, quiz.id)
    await uow.quiz_questions.add(
        QuizQuestion(quiz_id=quiz.id, question="Second", points=5, position=2)
    )
    await uow.commit()

    total = await uow.quizzes.recompute_total_points(quiz.id)
    assert total == 7
