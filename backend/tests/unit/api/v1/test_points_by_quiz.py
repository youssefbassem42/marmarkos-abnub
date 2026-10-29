"""The points of the member per quiz (the point 2 of the plan).

The page of the member shows the ledger one transaction at a time; the
summary per quiz answers the question of the owner: "my points in each
quiz I have solved".

The rules these numbers obey are in `docs/business-rules.md`
("The points of each quiz", `BR-56` to `BR-60`):

* the points of a quiz are the **sum of the ledger** of the member on that
  quiz - one line per quiz;
* the average is the average of the scores **out of ten** of the graded
  attempts, rounded to one decimal; an attempt that was not graded is not
  in the average;
* a quiz whose title changed shows its **current** title;
* a member never sees the points of another member;
* the attempts deleted with their quiz do not appear.

The dataset is built by hand and every expected number is written down as
a literal.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import async_session_factory
from app.modules.auth.infrastructure.security import hash_password
from app.modules.bible.domain.enums.verse_status import VerseStatus
from app.modules.bible.infrastructure.persistence.models import BibleVerse
from app.modules.points.infrastructure.persistence.models import PointTransaction
from app.modules.quiz.domain.enums import AttemptStatus
from app.modules.quiz.domain.enums.quiz_status import QuizStatus
from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizAttempt
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import Role, User
from app.modules.users.infrastructure.services import generate_public_id
from tests.utils import DEFAULT_PASSWORD, login

URL = "/api/v1/users/me/points/by-quiz"

MONTH = date(2026, 3, 1)
QUIZ_1_TOTAL = 10
QUIZ_2_TOTAL = 20
QUIZ_3_TOTAL = 0  # a quiz that was never graded (the total is zero)


async def _seed() -> dict[str, uuid.UUID]:
    """Two members, three quizzes, three attempts and the ledger that pays them.

    * `t1` member A / quiz 1 / `COMPLETED` / 10 of 10 -> 10 points
    * `t2` member A / quiz 2 / `COMPLETED` / 15 of 20 -> 15 points
    * `t3` member A / quiz 3 / `COMPLETED` / 0 of 0  -> 4 points (never graded)
    * `t4` member B / quiz 1 / `IN_PROGRESS`      -> never paid

    Member B therefore has **no line at all**: the ledger is the truth, an
    attempt that never finished was never paid.
    """
    ids: dict[str, uuid.UUID] = {}
    async with async_session_factory() as session:
        role_admin = (
            await session.execute(select(Role).where(Role.name == RoleName.ADMIN))
        ).scalar_one()
        role_member = (
            await session.execute(select(Role).where(Role.name == RoleName.MEMBER))
        ).scalar_one()

        def add_user(email: str, first: str, last: str, role: Role) -> User:
            user = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hash_password(DEFAULT_PASSWORD),
                public_id=generate_public_id(),
                status=UserStatus.ACTIVE,
                role_id=role.id,
                email_verified=True,
                first_name=first,
                last_name=last,
            )
            session.add(user)
            return user

        admin = add_user("points-admin@c.com", "Admin", "P", role_admin)
        member_a = add_user("points-a@c.com", "Amr", "A", role_member)
        member_b = add_user("points-b@c.com", "Basma", "B", role_member)
        await session.flush()
        ids["admin"] = admin.id
        ids["a"] = member_a.id
        ids["b"] = member_b.id

        verses = []
        for index in (1, 2, 3):
            verse = BibleVerse(
                id=uuid.uuid4(),
                title=f"الآية {index}",
                verse_reference=f"الفاتحة {index}:1",
                book="الفاتحة",
                chapter=index,
                verse_start=1,
                verse_end=1,
                text="بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
                status=VerseStatus.PUBLISHED,
                published_at=datetime(2026, 2, 28, 12, 0, tzinfo=UTC),
            )
            session.add(verse)
            verses.append(verse)
        await session.flush()

        def quiz(index: int, total: int, title: str) -> Quiz:
            row = Quiz(
                id=uuid.uuid4(),
                verse_id=verses[index - 1].id,
                title=title,
                description=None,
                duration_seconds=300,
                total_points=total,
                status=QuizStatus.PUBLISHED,
                published_at=datetime(2026, 3, 1, 12, 0, tzinfo=UTC),
                created_by=ids["admin"],
            )
            session.add(row)
            return row

        quiz_1 = quiz(1, QUIZ_1_TOTAL, "اختبار الفاتحة")
        quiz_2 = quiz(2, QUIZ_2_TOTAL, "اختبار البقرة")
        quiz_3 = quiz(3, QUIZ_3_TOTAL, "اختبار بلا نقاط")
        await session.flush()
        ids["q1"] = quiz_1.id
        ids["q2"] = quiz_2.id
        ids["q3"] = quiz_3.id

        def attempt(
            id: uuid.UUID,
            target: Quiz,
            user: uuid.UUID,
            status: AttemptStatus,
            score: int,
            finished: datetime | None,
        ) -> QuizAttempt:
            return QuizAttempt(
                id=id,
                quiz_id=target.id,
                user_id=user,
                started_at=datetime(2026, 3, 14, 9, 0, tzinfo=UTC),
                budget_remaining_seconds=0,
                submitted_at=finished,
                finished_at=finished,
                status=status,
                duration_seconds=300,
                total_points=target.total_points,
                question_count=1,
                score=score,
                correct_count=score,
                incorrect_count=max(target.total_points - score, 0),
            )

        t1 = attempt(
            uuid.uuid4(),
            quiz_1,
            member_a.id,
            AttemptStatus.COMPLETED,
            10,
            datetime(2026, 3, 15, 10, 0, tzinfo=UTC),
        )
        t2 = attempt(
            uuid.uuid4(),
            quiz_2,
            member_a.id,
            AttemptStatus.COMPLETED,
            15,
            datetime(2026, 3, 16, 10, 0, tzinfo=UTC),
        )
        t3 = attempt(
            uuid.uuid4(),
            quiz_3,
            member_a.id,
            AttemptStatus.COMPLETED,
            0,
            datetime(2026, 3, 17, 10, 0, tzinfo=UTC),
        )
        t4 = attempt(
            uuid.uuid4(),
            quiz_1,
            member_b.id,
            AttemptStatus.IN_PROGRESS,
            0,
            None,
        )
        session.add_all([t1, t2, t3, t4])
        await session.flush()

        def ledger(user: uuid.UUID, attempt_row: QuizAttempt, points: int) -> None:
            session.add(
                PointTransaction(
                    id=uuid.uuid4(),
                    user_id=user,
                    quiz_attempt_id=attempt_row.id,
                    points=points,
                    period_month=MONTH,
                    period_week_start=MONTH,
                    awarded_at=attempt_row.finished_at,
                )
            )

        ledger(member_a.id, t1, 10)
        ledger(member_a.id, t2, 15)
        ledger(member_a.id, t3, 4)
        # t4 is never paid: the attempt never finished.

        await session.commit()
    return ids


async def _auth(client: AsyncClient, email: str) -> dict[str, str]:
    result = await login(client, email=email, password=DEFAULT_PASSWORD)
    return {"Authorization": f"Bearer {result['access_token']}"}


@pytest.mark.asyncio
async def test_the_points_of_the_member_are_one_line_per_quiz(client: AsyncClient):
    ids = await _seed()
    auth = await _auth(client, "points-a@c.com")

    response = await client.get(URL, headers=auth)

    assert response.status_code == 200, response.text
    body = response.json()

    # The order: the points descending.
    assert [item["quiz_id"] for item in body["items"]] == [
        str(ids["q2"]),
        str(ids["q1"]),
        str(ids["q3"]),
    ]
    assert [item["points"] for item in body["items"]] == [15, 10, 4]
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["size"] == 20
    assert body["pages"] == 1
    assert body["has_next"] is False
    # The lifetime total of the member travels with the page: the frontend
    # never adds the lines itself.
    assert body["total_points"] == 29


@pytest.mark.asyncio
async def test_the_average_is_the_score_out_of_ten(client: AsyncClient):
    await _seed()
    auth = await _auth(client, "points-a@c.com")

    body = (await client.get(URL, headers=auth)).json()

    by_quiz = {item["quiz_title"]: item for item in body["items"]}
    # 15 of 20 -> 7.5 out of ten
    assert by_quiz["اختبار البقرة"]["average_score_out_of_10"] == 7.5
    # 10 of 10 -> 10 out of ten
    assert by_quiz["اختبار الفاتحة"]["average_score_out_of_10"] == 10.0
    # The third quiz was never graded (its total is zero): the average is
    # zero, the attempt is not in any average.
    assert by_quiz["اختبار بلا نقاط"]["average_score_out_of_10"] == 0.0
    assert by_quiz["اختبار بلا نقاط"]["attempts"] == 1


@pytest.mark.asyncio
async def test_the_member_never_sees_the_points_of_another_member(client: AsyncClient):
    await _seed()
    auth = await _auth(client, "points-b@c.com")

    body = (await client.get(URL, headers=auth)).json()

    # The attempt of member B was never finished, so the ledger has nothing
    # for him: the endpoint answers an empty page, not the lines of A.
    assert body["items"] == []
    assert body["total"] == 0
    assert body["total_points"] == 0


@pytest.mark.asyncio
async def test_the_page_of_the_points_is_paginated(client: AsyncClient):
    ids = await _seed()
    auth = await _auth(client, "points-a@c.com")

    first = (await client.get(f"{URL}?page=1&size=2", headers=auth)).json()

    assert len(first["items"]) == 2
    assert first["total"] == 3
    assert first["size"] == 2
    assert first["pages"] == 2
    assert first["has_next"] is True
    assert first["items"][0]["quiz_id"] == str(ids["q2"])

    second = (await client.get(f"{URL}?page=2&size=2", headers=auth)).json()

    assert len(second["items"]) == 1
    assert second["has_next"] is False
    assert second["items"][0]["quiz_id"] == str(ids["q3"])


@pytest.mark.asyncio
async def test_a_quiz_whose_title_changed_shows_its_current_title(client: AsyncClient):
    ids = await _seed()
    auth = await _auth(client, "points-a@c.com")

    async with async_session_factory() as session:
        quiz = await session.get(Quiz, ids["q1"])
        assert quiz is not None
        quiz.title = "اختبار الفاتحة (العنوان الجديد)"
        await session.commit()

    body = (await client.get(URL, headers=auth)).json()

    titles = [item["quiz_title"] for item in body["items"]]
    assert "اختبار الفاتحة (العنوان الجديد)" in titles
    assert "اختبار الفاتحة" not in titles


@pytest.mark.asyncio
async def test_the_endpoint_needs_a_member(client: AsyncClient):
    response = await client.get(URL)

    assert response.status_code == 401
