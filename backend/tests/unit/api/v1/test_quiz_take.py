"""A member may take a quiz - and never sees the correctness (the E2E found it).

The page of the attempt asked the manager endpoint
``GET /api/v1/quizzes/{id}``, which is reserved for the servants: every
member received a 403 and **could not answer a quiz at all**.

The member path is now ``GET /api/v1/quizzes/{id}/take``:
* a member receives the questions and the options,
* the correctness of the options never leaves the server,
* a draft or an archived quiz is invisible to a member (404, like a quiz
  that does not exist),
* the manager endpoint stays reserved for the servants.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.core.database import async_session_factory
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.quiz.domain.enums import QuizStatus
from app.modules.quiz.infrastructure.persistence.models import (
    Quiz,
    QuizOption,
    QuizQuestion,
)
from tests.utils import register_and_login


async def _seed_quiz(*, status: QuizStatus = QuizStatus.PUBLISHED) -> uuid.UUID:
    async with async_session_factory() as session:
        verse = BibleVerse(
            title="Take verse",
            verse_reference="John 1:1",
            book="John",
            chapter=1,
            verse_start=1,
            text="In the beginning was the Word",
        )
        session.add(verse)
        await session.flush()

        quiz = Quiz(
            verse_id=verse.id,
            title="Take quiz",
            duration_seconds=300,
            total_points=10,
            status=status,
        )
        session.add(quiz)
        await session.flush()

        question = QuizQuestion(
            quiz_id=quiz.id,
            question="Who is the Word?",
            points=10,
            position=1,
        )
        session.add(question)
        await session.flush()

        session.add_all(
            [
                QuizOption(
                    question_id=question.id,
                    option_text="God",
                    is_correct=True,
                    position=1,
                ),
                QuizOption(
                    question_id=question.id,
                    option_text="A prophet",
                    is_correct=False,
                    position=2,
                ),
            ]
        )
        await session.commit()
        return quiz.id


@pytest.mark.asyncio
async def test_a_member_receives_the_questions_without_the_correctness(
    client: AsyncClient,
):
    quiz_id = await _seed_quiz()
    auth, _ = await register_and_login(client, email="take-member@test.com")

    response = await client.get(
        f"/api/v1/quizzes/{quiz_id}/take",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Take quiz"
    assert body["question_count"] == 1
    question = body["questions"][0]
    assert question["question"] == "Who is the Word?"
    assert [option["option_text"] for option in question["options"]] == [
        "God",
        "A prophet",
    ]
    # The correctness must not be in the answer of the server.
    assert "is_correct" not in question["options"][0]
    assert "correct" not in str(question).lower()


@pytest.mark.asyncio
async def test_the_manager_endpoint_stays_reserved_for_the_servants(
    client: AsyncClient,
):
    quiz_id = await _seed_quiz()
    auth, _ = await register_and_login(client, email="take-member-2@test.com")

    response = await client.get(
        f"/api/v1/quizzes/{quiz_id}",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_a_draft_quiz_is_invisible_to_a_member(client: AsyncClient):
    quiz_id = await _seed_quiz(status=QuizStatus.DRAFT)
    auth, _ = await register_and_login(client, email="take-member-3@test.com")

    response = await client.get(
        f"/api/v1/quizzes/{quiz_id}/take",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_an_anonymous_visitor_receives_nothing(client: AsyncClient):
    quiz_id = await _seed_quiz()

    response = await client.get(f"/api/v1/quizzes/{quiz_id}/take")

    assert response.status_code == 401
