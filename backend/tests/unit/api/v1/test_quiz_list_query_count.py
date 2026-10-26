"""The manager quiz list must not N+1 (PERF-001).

``GET /api/v1/quizzes`` used to ask for the verse and the question count
of every quiz on the page one by one: 2N+1 statements for a page of N
quizzes (21 statements for 10 quizzes).

The guard has two parts:
* the absolute bound (the list must stay below a handful of statements),
* the *relative* bound: the number of statements must not grow with the
  number of quizzes on the page - that is the property an N+1 breaks.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.core.database import async_session_factory
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.quiz.domain.enums import QuizStatus
from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizQuestion
from tests.query_counter import count_queries

QUIZZ_URL = "/api/v1/quizzes"


async def _seed_quizzes(count: int) -> None:
    """Create ``count`` quizzes, each with its own verse and two questions."""
    async with async_session_factory() as session:
        for index in range(count):
            verse = BibleVerse(
                title=f"Verse {index}",
                verse_reference=f"John {index + 1}:1",
                book="John",
                chapter=index + 1,
                verse_start=1,
                text=f"The text of verse {index}",
            )
            session.add(verse)
            await session.flush()

            quiz = Quiz(
                verse_id=verse.id,
                title=f"Quiz {index}",
                duration_seconds=60,
                total_points=10,
                status=QuizStatus.DRAFT,
            )
            session.add(quiz)
            await session.flush()

            for position in range(2):
                session.add(
                    QuizQuestion(
                        quiz_id=quiz.id,
                        question=f"Question {index}-{position}",
                        points=5,
                        position=position,
                    )
                )
        await session.commit()


@pytest.mark.asyncio
async def test_the_quiz_list_does_not_grow_with_the_page(
    client: AsyncClient, admin_auth_headers: dict[str, str]
):
    """The statement count must be the same for 2 quizzes and for 8."""
    await _seed_quizzes(2)
    async with count_queries() as get_count:
        small = await client.get(f"{QUIZZ_URL}?size=10", headers=admin_auth_headers)
    assert small.status_code == 200
    assert len(small.json()["items"]) == 2
    small_count = get_count()

    await _seed_quizzes(6)
    async with count_queries() as get_count:
        large = await client.get(f"{QUIZZ_URL}?size=10", headers=admin_auth_headers)
    assert large.status_code == 200
    assert len(large.json()["items"]) == 8
    large_count = get_count()

    assert large_count == small_count, (
        f"the quiz list issued {large_count} statements for 8 quizzes "
        f"but {small_count} for 2 - that is an N+1"
    )
    # 2 for the authorisation, 1 for the total, 1 for the page, 1 for the
    # questions of the page, 1 for the verse references, 1 for the counts.
    assert large_count <= 8, f"the quiz list issued {large_count} statements (expected <= 8)"


@pytest.mark.asyncio
async def test_the_quiz_list_reports_the_question_count(
    client: AsyncClient, admin_auth_headers: dict[str, str]
):
    """The batched query must return the same numbers as before."""
    await _seed_quizzes(1)

    response = await client.get(f"{QUIZZ_URL}?size=10", headers=admin_auth_headers)

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["question_count"] == 2
    assert item["verse_reference"].startswith("John ")


@pytest.mark.asyncio
async def test_an_empty_page_asks_for_nothing_extra(
    client: AsyncClient, admin_auth_headers: dict[str, str]
):
    """No quizzes -> no verse lookup and no count query."""
    async with count_queries() as get_count:
        response = await client.get(f"{QUIZZ_URL}?size=10", headers=admin_auth_headers)

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert get_count() <= 4
