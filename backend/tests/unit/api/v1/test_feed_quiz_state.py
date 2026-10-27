"""The quiz badge of the member feed (the ``quiz_state`` of a verse card).

The feed tells the member what to do with the quiz of a verse: nothing
yet, read first, start it, or it is done. The state is built from the
quiz of the verse and the attempt of the member - and the attempt is
looked up by the **quiz** id while the query returns it by the **verse**
id. The badge therefore never showed "in progress" or "completed".
"""

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import async_session_factory
from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.quiz.domain.enums import AttemptStatus, QuizStatus
from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizAttempt
from app.modules.users.infrastructure.persistence.models import User
from app.shared.contracts.users import RoleName
from tests.utils import login, register_user

FEED_URL = "/api/v1/bible-verses/published"


@pytest.fixture
async def member_token(client: AsyncClient) -> str:
    """A member with a verified account."""
    await register_user(
        client,
        email="feed-member@example.com",
        password="StrongPass123!",
        first_name="Feed",
        last_name="Member",
        phone="01000000001",
        date_of_birth="2000-01-01",
        address="Cairo",
    )
    response = await login(client, email="feed-member@example.com", password="StrongPass123!")
    return response["access_token"]


async def _seed_verse_with_quiz(
    *, quiz_status: QuizStatus, attempt_status: AttemptStatus | None
) -> tuple[uuid.UUID, uuid.UUID]:
    """A published verse with a quiz and (optionally) an attempt."""
    async with async_session_factory() as session:
        verse = BibleVerse(
            title="A verse for the feed",
            verse_reference="John 3:16",
            book="John",
            chapter=3,
            verse_start=16,
            text="For God so loved the world...",
            status=VerseStatus.PUBLISHED,
            published_at=datetime.now(UTC),
        )
        session.add(verse)
        await session.flush()

        quiz = Quiz(
            verse_id=verse.id,
            title="The quiz of the verse",
            duration_seconds=60,
            total_points=10,
            status=quiz_status,
            published_at=datetime.now(UTC) if quiz_status is QuizStatus.PUBLISHED else None,
        )
        session.add(quiz)
        await session.flush()

        if attempt_status is not None:
            member = await session.scalar(
                select(User).where(User.email == "feed-member@example.com")
            )
            assert member is not None
            session.add(
                QuizAttempt(
                    quiz_id=quiz.id,
                    user_id=member.id,
                    started_at=datetime.now(UTC),
                    budget_remaining_seconds=600,
                    duration_seconds=60,
                    total_points=10,
                    question_count=1,
                    score=10,
                    status=attempt_status,
                    submitted_at=datetime.now(UTC),
                    finished_at=datetime.now(UTC),
                )
            )
        await session.commit()
        return verse.id, quiz.id


async def _feed_card(client: AsyncClient, token: str) -> dict:
    response = await client.get(FEED_URL, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    cards = response.json()["items"]
    assert cards, "the feed is empty"
    return cards[0]


async def test_a_completed_attempt_is_shown_as_completed(
    client: AsyncClient, member_token: str
) -> None:
    """The member finished the quiz: the badge says so."""
    await _seed_verse_with_quiz(
        quiz_status=QuizStatus.PUBLISHED, attempt_status=AttemptStatus.COMPLETED
    )

    card = await _feed_card(client, member_token)

    assert card["has_quiz"] is True
    assert card["quiz_state"] == "completed"


async def test_an_open_attempt_is_shown_as_in_progress(
    client: AsyncClient, member_token: str
) -> None:
    await _seed_verse_with_quiz(
        quiz_status=QuizStatus.PUBLISHED, attempt_status=AttemptStatus.IN_PROGRESS
    )

    card = await _feed_card(client, member_token)

    assert card["quiz_state"] == "in_progress"


async def test_without_an_attempt_the_badge_is_not_started(
    client: AsyncClient, member_token: str
) -> None:
    """No attempt yet: the quiz is available (or locked behind the read)."""
    await _seed_verse_with_quiz(quiz_status=QuizStatus.PUBLISHED, attempt_status=None)

    card = await _feed_card(client, member_token)

    assert card["has_quiz"] is True
    assert card["quiz_state"] in {"available", "locked_read_required"}


async def test_a_draft_quiz_has_no_badge(client: AsyncClient, member_token: str) -> None:
    """A quiz that is not published is invisible in the member feed."""
    await _seed_verse_with_quiz(quiz_status=QuizStatus.DRAFT, attempt_status=None)

    card = await _feed_card(client, member_token)

    assert card["has_quiz"] is False
    assert card["quiz_state"] is None


def test_the_role_of_a_member_is_still_readable() -> None:
    """The shared contract kept the enumeration (ARCH-002)."""
    assert RoleName.MEMBER.value == "MEMBER"
