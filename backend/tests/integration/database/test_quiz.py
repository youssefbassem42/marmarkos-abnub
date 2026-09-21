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
from app.core.exceptions import AttemptExistsError
from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.quiz.application.commands.attempt_commands import start_attempt
from app.modules.quiz.domain.enums import AttemptStatus, QuizStatus
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


async def _takeable_quiz(uow: UnitOfWork, user) -> tuple[Quiz, uuid.UUID]:
    """Published quiz with one question + verse read; returns (quiz, option_id)."""
    quiz = await _quiz(uow, status=QuizStatus.PUBLISHED)
    question = await _question_with_options(uow, quiz.id)
    await uow.verse_reads.mark_read(quiz.verse_id, user.id)
    await uow.commit()
    option_id = (
        await uow.session.execute(
            select(QuizOption.id).where(QuizOption.question_id == question.id).limit(1)
        )
    ).scalar_one()
    return quiz, option_id


async def _attempt(
    uow: UnitOfWork,
    *,
    quiz_id: uuid.UUID,
    user_id: uuid.UUID,
    status: AttemptStatus,
    expires_at: datetime | None = None,
) -> QuizAttempt:
    started_at = datetime.now(UTC) - timedelta(seconds=60)
    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=user_id,
        started_at=started_at,
        expires_at=expires_at or (started_at + timedelta(seconds=120)),
        duration_seconds=120,
        total_points=2,
        question_count=1,
        status=status,
    )
    if status is not AttemptStatus.IN_PROGRESS:
        attempt.finished_at = started_at
        attempt.score = 0
        if status is AttemptStatus.COMPLETED:
            attempt.submitted_at = started_at
    await uow.quiz_attempts.add(attempt)
    await uow.commit()
    return attempt


async def test_ghost_expired_attempt_is_restarted_in_place(uow: UnitOfWork) -> None:
    """An abandoned (expired, never submitted) attempt must not block a take."""
    user = await make_user(uow, "ghost-expired@example.com")
    quiz, _ = await _takeable_quiz(uow, user)
    ghost = await _attempt(
        uow,
        quiz_id=quiz.id,
        user_id=user.id,
        status=AttemptStatus.IN_PROGRESS,
        expires_at=datetime.now(UTC) - timedelta(seconds=5),
    )

    result = await start_attempt(uow, user, quiz.id)

    assert result.id == ghost.id  # same row reused, no unique-index violation
    assert result.remaining_seconds == 120
    refreshed = await uow.quiz_attempts.get_for_user_and_quiz(quiz.id, user.id)
    assert refreshed is not None
    assert refreshed.status is AttemptStatus.IN_PROGRESS
    assert refreshed.expires_at > datetime.now(UTC)


async def test_ghost_auto_finished_empty_attempt_is_restarted(uow: UnitOfWork) -> None:
    """A lazy-expired ghost (finished, zero real selections) restarts too."""
    user = await make_user(uow, "ghost-empty@example.com")
    quiz, _ = await _takeable_quiz(uow, user)
    ghost = await _attempt(
        uow,
        quiz_id=quiz.id,
        user_id=user.id,
        status=AttemptStatus.AUTO_FINISHED,
    )
    # Lazy auto-finish writes one row per question with no selection (BR-30).
    uow.session.add(
        QuizAnswer(
            attempt_id=ghost.id,
            question_id=(await uow.quiz_questions.list_for_quiz(quiz.id))[0].id,
            selected_option_id=None,
            is_correct=False,
            points_awarded=0,
        )
    )
    await uow.commit()

    result = await start_attempt(uow, user, quiz.id)

    assert result.id == ghost.id
    refreshed = await uow.quiz_attempts.get_for_user_and_quiz(quiz.id, user.id)
    assert refreshed is not None
    assert refreshed.status is AttemptStatus.IN_PROGRESS
    assert refreshed.finished_at is None
    # Ghost's empty answers were wiped.
    assert not (await uow.quiz_answers.list_for_attempt(ghost.id))


async def test_real_finished_attempt_is_one_shot(uow: UnitOfWork) -> None:
    """A COMPLETED attempt (user pressed submit) keeps the D-4 block."""
    user = await make_user(uow, "one-shot@example.com")
    quiz, option_id = await _takeable_quiz(uow, user)
    done = await _attempt(
        uow,
        quiz_id=quiz.id,
        user_id=user.id,
        status=AttemptStatus.COMPLETED,
    )
    uow.session.add(
        QuizAnswer(
            attempt_id=done.id,
            question_id=(await uow.quiz_questions.list_for_quiz(quiz.id))[0].id,
            selected_option_id=option_id,
            is_correct=True,
            points_awarded=2,
        )
    )
    await uow.commit()

    with pytest.raises(AttemptExistsError):
        await start_attempt(uow, user, quiz.id)


async def test_partial_selection_auto_finished_ghost_is_restarted(uow: UnitOfWork) -> None:
    """Broken-era ghosts carried partial auto-saved answers; a quiz is only
    completed once submitted, so an AUTO_FINISHED row (submitted_at NULL)
    resets even when it has real selections."""
    user = await make_user(uow, "partial-ghost@example.com")
    quiz, option_id = await _takeable_quiz(uow, user)
    ghost = await _attempt(
        uow,
        quiz_id=quiz.id,
        user_id=user.id,
        status=AttemptStatus.AUTO_FINISHED,
    )
    # Auto-save persisted a selection before the broken submit 500'd.
    uow.session.add(
        QuizAnswer(
            attempt_id=ghost.id,
            question_id=(await uow.quiz_questions.list_for_quiz(quiz.id))[0].id,
            selected_option_id=option_id,
            is_correct=True,
            points_awarded=2,
        )
    )
    await uow.commit()

    result = await start_attempt(uow, user, quiz.id)

    assert result.id == ghost.id
    refreshed = await uow.quiz_attempts.get_for_user_and_quiz(quiz.id, user.id)
    assert refreshed is not None
    assert refreshed.status is AttemptStatus.IN_PROGRESS
    assert refreshed.score == 0
    assert not (await uow.quiz_answers.list_for_attempt(ghost.id))


async def test_live_in_progress_attempt_resumes_not_restarts(uow: UnitOfWork) -> None:
    """An in-flight attempt with the clock running resumes (BR-27)."""
    user = await make_user(uow, "live-session@example.com")
    quiz, _ = await _takeable_quiz(uow, user)
    await _attempt(
        uow,
        quiz_id=quiz.id,
        user_id=user.id,
        status=AttemptStatus.IN_PROGRESS,
        expires_at=datetime.now(UTC) + timedelta(seconds=120),
    )

    with pytest.raises(AttemptExistsError):
        await start_attempt(uow, user, quiz.id)


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
