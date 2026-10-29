"""The numbers of the three report pages, pinned with a hand-built dataset.

The administration shows numbers on three pages:

* `/admin/analytics/monthly`   -> `GET /quiz-analytics/monthly`,
                                  `GET /quiz-analytics/monthly/users`,
                                  `GET /quiz-analytics/monthly/export`
* `/admin/analytics/quizzes`   -> `GET /quizzes/analytics/overview`,
                                  `GET /quizzes/{id}/analytics`,
                                  `GET /quizzes/{id}/analytics/users`,
                                  `GET /quizzes/{id}/analytics/export`
* `/admin/analytics/verses`    -> `GET /bible-verses/analytics/*` (the bible module)

The dataset is built by hand: two members, two quizzes, four attempts
(`COMPLETED`, `AUTO_FINISHED`, `IN_PROGRESS` and a month-boundary
`COMPLETED` that belongs to the next month) and the ledger rows that pay
them out. Every expected number is written down as a literal: if a
calculation changes, this test fails.

The rules these numbers obey are in `docs/business-rules.md`
("The calculations of the reports", `BR-41` to `BR-50`).
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import async_session_factory
from app.modules.auth.infrastructure.security import hash_password
from app.modules.bible.domain.enums.verse_status import VerseStatus
from app.modules.bible.infrastructure.persistence.models import BibleVerse, VerseView
from app.modules.points.infrastructure.persistence.models import PointTransaction
from app.modules.quiz.domain.enums import AttemptStatus
from app.modules.quiz.domain.enums.quiz_status import QuizStatus
from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizAttempt
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import Role, User
from app.modules.users.infrastructure.services import generate_public_id
from tests.utils import DEFAULT_PASSWORD, login

MONTH = date(2026, 3, 1)  # the month under analysis
NEXT_MONTH = date(2026, 4, 1)  # the month after (the month boundary)

QUIZ_1_TOTAL = 10
QUIZ_2_TOTAL = 20


async def _seed() -> dict[str, uuid.UUID]:
    """Build the dataset by hand and return the ids the assertions need.

    Two members, two quizzes, four attempts (one attempt per member and quiz,
    `D-4`):

    * `t1` member A / quiz 1 / `COMPLETED` / 10 of 10, finished in March
    * `t2` member B / quiz 2 / `AUTO_FINISHED` / 10 of 20, finished in March
    * `t3` member B / quiz 1 / `IN_PROGRESS` / 0 of 10, never finished
    * `t4` member A / quiz 2 / `COMPLETED` / 10 of 20, finished in April
      (the month boundary: it belongs to April, not to March)

    The ledger pays `t1`, `t2` and `t4` (`t3` is never paid because it never
    finishes), keyed by the local month of the award moment.
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

        admin = add_user("analytics-admin@c.com", "Admin", "C", role_admin)
        member_a = add_user("member-a@c.com", "Amr", "A", role_member)
        member_b = add_user("member-b@c.com", "Basma", "B", role_member)
        await session.flush()
        ids["admin"] = admin.id
        ids["a"] = member_a.id
        ids["b"] = member_b.id

        verse_1 = BibleVerse(
            id=uuid.uuid4(),
            title="الآية الأولى",
            verse_reference="الفاتحة ١:١",
            book="الفاتحة",
            chapter=1,
            verse_start=1,
            verse_end=1,
            text="بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
            status=VerseStatus.PUBLISHED,
            published_at=datetime(2026, 2, 28, 12, 0, tzinfo=UTC),
        )
        verse_2 = BibleVerse(
            id=uuid.uuid4(),
            title="الآية الثانية",
            verse_reference="البقرة ٢:١",
            book="البقرة",
            chapter=2,
            verse_start=1,
            verse_end=1,
            text="الم * ذَٰلِكَ الْكِتَابُ لَا رَيْبَ",
            status=VerseStatus.PUBLISHED,
            published_at=datetime(2026, 2, 28, 12, 0, tzinfo=UTC),
        )
        session.add_all([verse_1, verse_2])
        await session.flush()

        quiz_1 = Quiz(
            id=uuid.uuid4(),
            verse_id=verse_1.id,
            title="اختبار الفاتحة",
            description=None,
            duration_seconds=300,
            total_points=QUIZ_1_TOTAL,
            status=QuizStatus.PUBLISHED,
            published_at=datetime(2026, 3, 1, 12, 0, tzinfo=UTC),
            created_by=ids["admin"],
        )
        quiz_2 = Quiz(
            id=uuid.uuid4(),
            verse_id=verse_2.id,
            title="اختبار البقرة",
            description=None,
            duration_seconds=600,
            total_points=QUIZ_2_TOTAL,
            status=QuizStatus.PUBLISHED,
            published_at=datetime(2026, 3, 10, 12, 0, tzinfo=UTC),
            created_by=ids["admin"],
        )
        session.add_all([quiz_1, quiz_2])
        await session.flush()

        def attempt(
            id: uuid.UUID,
            quiz: Quiz,
            user: uuid.UUID,
            status: AttemptStatus,
            score: int,
            finished: datetime | None,
        ) -> QuizAttempt:
            return QuizAttempt(
                id=id,
                quiz_id=quiz.id,
                user_id=user,
                started_at=finished - timedelta(hours=1)
                if finished
                else datetime(2026, 3, 25, 9, 0, tzinfo=UTC),
                budget_remaining_seconds=0,
                submitted_at=finished,
                finished_at=finished,
                status=status,
                duration_seconds=300,
                total_points=quiz.total_points,
                question_count=1,
                score=score,
                correct_count=score,
                incorrect_count=quiz.total_points - score,
            )

        ids["q1"] = quiz_1.id
        ids["q2"] = quiz_2.id
        # One attempt per (member, quiz) (D-4):
        #  t1  member A / quiz 1 / COMPLETED  / 10 of 10, finished in March
        #  t2  member B / quiz 2 / AUTO_FINISHED / 10 of 20, finished in March
        #  t3  member B / quiz 1 / IN_PROGRESS / 0 of 10, never finished   (never counts)
        #  t4  member A / quiz 2 / COMPLETED  / 10 of 20, finished in April (the month boundary)
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
            member_b.id,
            AttemptStatus.AUTO_FINISHED,
            10,
            datetime(2026, 3, 20, 10, 0, tzinfo=UTC),
        )
        t3 = attempt(uuid.uuid4(), quiz_1, member_b.id, AttemptStatus.IN_PROGRESS, 0, None)
        t4 = attempt(
            uuid.uuid4(),
            quiz_2,
            member_a.id,
            AttemptStatus.COMPLETED,
            10,
            datetime(2026, 4, 5, 10, 0, tzinfo=UTC),
        )
        session.add_all([t1, t2, t3, t4])
        await session.flush()

        ids["t1"] = t1.id
        ids["t2"] = t2.id
        ids["t3"] = t3.id
        ids["t4"] = t4.id

        def ledger(user: uuid.UUID, attempt: QuizAttempt, points: int, month: date) -> None:
            session.add(
                PointTransaction(
                    id=uuid.uuid4(),
                    user_id=user,
                    quiz_attempt_id=attempt.id,
                    points=points,
                    period_month=month,
                    period_week_start=month,
                    awarded_at=attempt.finished_at,
                )
            )

        ledger(member_a.id, t1, QUIZ_1_TOTAL, MONTH)
        ledger(member_b.id, t2, QUIZ_2_TOTAL // 2, MONTH)
        ledger(member_a.id, t4, QUIZ_2_TOTAL // 2, NEXT_MONTH)

        # Two published verses; member A opens the first one twice and member B
        # once: 3 opens, 2 distinct readers (BR-13, BR-16).
        session.add_all(
            [
                VerseView(
                    id=uuid.uuid4(),
                    verse_id=verse_1.id,
                    user_id=member_a.id,
                    opened_at=datetime(2026, 3, 1, 9, 0, tzinfo=UTC),
                ),
                VerseView(
                    id=uuid.uuid4(),
                    verse_id=verse_1.id,
                    user_id=member_a.id,
                    opened_at=datetime(2026, 3, 2, 9, 0, tzinfo=UTC),
                ),
                VerseView(
                    id=uuid.uuid4(),
                    verse_id=verse_1.id,
                    user_id=member_b.id,
                    opened_at=datetime(2026, 3, 3, 9, 0, tzinfo=UTC),
                ),
            ]
        )

        await session.commit()
    return ids


async def _admin_auth(client: AsyncClient) -> dict[str, str]:
    auth = await login(client, email="analytics-admin@c.com", password=DEFAULT_PASSWORD)
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _month_param(month: date) -> str:
    """The canonical ``YYYY-MM`` shape the endpoint accepts (not ``YYYY-MM-DD``)."""
    return f"{month.year}-{month.month:02d}"


async def _monthly(client: AsyncClient, auth: dict[str, str], month: date):
    return await client.get(
        "/api/v1/quiz-analytics/monthly",
        params={"month": _month_param(month)},
        headers=auth,
    )


async def _monthly_users(client: AsyncClient, auth: dict[str, str], month: date):
    return await client.get(
        "/api/v1/quiz-analytics/monthly/users",
        params={"month": _month_param(month), "page": 1, "size": 20},
        headers=auth,
    )


async def _monthly_export(client: AsyncClient, auth: dict[str, str], month: date):
    return await client.get(
        "/api/v1/quiz-analytics/monthly/export",
        params={"month": _month_param(month)},
        headers=auth,
    )


def _parse_csv(body: bytes) -> list[list[str]]:
    text = body.decode("utf-8-sig")
    return list(csv.reader(io.StringIO(text)))


@pytest.mark.asyncio
async def test_the_monthly_kpis_of_march_are_pinned(client: AsyncClient):
    await _seed()
    auth = await _admin_auth(client)

    response = await _monthly(client, auth, MONTH)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["month"] == "2026-03-01"
    # BR-45 / BR-46: two distinct members with a finished attempt in March.
    assert body["participants"] == 2
    # BR-41: t1 COMPLETED and t2 AUTO_FINISHED count; t3 IN_PROGRESS never counts.
    assert body["quizzes_completed"] == 2
    # BR-42: the paid points (10 + 10).
    assert body["total_points"] == 20
    # BR-42: the average of the scores out of ten (10.0 and 5.0) = 7.5.
    assert body["average_score_out_of_10"] == 7.5
    # BR-43 denominator: two quizzes published in March.
    assert body["quizzes_published"] == 2


@pytest.mark.asyncio
async def test_the_monthly_trend_and_distribution_of_march_are_pinned(
    client: AsyncClient,
):
    ids = await _seed()
    auth = await _admin_auth(client)

    response = await _monthly(client, auth, MONTH)
    assert response.status_code == 200, response.text
    body = response.json()

    # BR-44: the last three months, oldest -> newest, anchored on March.
    assert body["trend"] == [
        {
            "period_month": "2026-01-01",
            "total_points": 0,
            "participants": 0,
            "average_score_out_of_10": 0.0,
        },
        {
            "period_month": "2026-02-01",
            "total_points": 0,
            "participants": 0,
            "average_score_out_of_10": 0.0,
        },
        {
            "period_month": "2026-03-01",
            "total_points": 20,
            "participants": 2,
            "average_score_out_of_10": 7.5,
        },
    ]
    # BR-43: each member finished one of the two published quizzes -> "<50%".
    # The query returns only the buckets that are non-zero (v > 0).
    assert body["completion_distribution"] == [
        {"bucket": "<50%", "users": 2, "percentage": 100.0},
    ]

    # BR-45 / BR-46: the two members tie on 10 points, dense rank 1.
    # The leaderboard orders by points desc with no tiebreak, so compare as a set.
    top = body["top"]
    assert len(top) == 2
    assert {(row["user_id"], row["rank"], row["full_name"], row["points"]) for row in top} == {
        (str(ids["a"]), 1, "Amr A", 10),
        (str(ids["b"]), 1, "Basma B", 10),
    }


@pytest.mark.asyncio
async def test_the_monthly_users_table_of_march_is_pinned(client: AsyncClient):
    ids = await _seed()
    auth = await _admin_auth(client)

    response = await _monthly_users(client, auth, MONTH)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["total"] == 2
    assert body["page"] == 1
    assert body["size"] == 20
    assert body["pages"] == 1
    assert body["has_next"] is False

    # BR-43: completion rate = finished ÷ published × 100 = 1 ÷ 2 × 100 = 50.0.
    expected = [
        {
            "rank": 1,
            "user_id": str(ids["a"]),
            "full_name": "Amr A",
            "avatar": None,
            "quizzes_completed": 1,
            "average_score_out_of_10": 10.0,
            "total_points": 10,
            "completion_rate": 50.0,
            "sparkline": [0, 0, 0, 0, 0, 10],
        },
        {
            "rank": 1,
            "user_id": str(ids["b"]),
            "full_name": "Basma B",
            "avatar": None,
            "quizzes_completed": 1,
            "average_score_out_of_10": 5.0,
            "total_points": 10,
            "completion_rate": 50.0,
            "sparkline": [0, 0, 0, 0, 0, 10],
        },
    ]
    assert body["items"] == expected


@pytest.mark.asyncio
async def test_the_monthly_export_march_carries_the_same_numbers(client: AsyncClient):
    ids = await _seed()
    auth = await _admin_auth(client)

    response = await _monthly_export(client, auth, MONTH)
    assert response.status_code == 200, response.text
    rows = _parse_csv(response.content)

    # BR-47: the header and the two data rows (one per member).
    assert rows[0] == [
        "user_id",
        "full_name",
        "total_points",
        "quizzes_completed",
        "average_score_out_of_10",
        "completion_rate",
    ]
    assert len(rows) == 3  # header + 2 members
    assert rows[1] == [
        str(ids["a"]),
        "Amr A",
        "10",
        "1",
        "10.0",
        "50.0",
    ]
    assert rows[2] == [
        str(ids["b"]),
        "Basma B",
        "10",
        "1",
        "5.0",
        "50.0",
    ]


@pytest.mark.asyncio
async def test_the_month_of_the_month_boundary_is_april(client: AsyncClient):
    ids = await _seed()
    auth = await _admin_auth(client)

    # t4 (finished 2026-04-05) must not leak into March and must appear in April.
    march = await _monthly(client, auth, MONTH)
    assert march.json()["total_points"] == 20

    april = await _monthly(client, auth, NEXT_MONTH)
    assert april.status_code == 200, april.text
    body = april.json()
    assert body["month"] == "2026-04-01"
    # BR-44: the month starts on its first instant; t4 is the only attempt of April.
    assert body["participants"] == 1
    assert body["quizzes_completed"] == 1
    assert body["total_points"] == 10
    # t4 is on quiz 2 (20 total points) with a score of 10 -> 10 / 20 * 10 = 5.0.
    assert body["average_score_out_of_10"] == 5.0
    # No quiz was published in April -> the denominator is at least one (BR-43).
    assert body["quizzes_published"] == 0

    users = await _monthly_users(client, auth, NEXT_MONTH)
    assert users.json()["items"] == [
        {
            "rank": 1,
            "user_id": str(ids["a"]),
            "full_name": "Amr A",
            "avatar": None,
            "quizzes_completed": 1,
            "average_score_out_of_10": 5.0,
            "total_points": 10,
            "completion_rate": 100.0,  # 1 finished ÷ max(0, 1) published × 100
            "sparkline": [0, 0, 0, 0, 10, 10],  # March's 10 and April's 10
        }
    ]


@pytest.mark.asyncio
async def test_the_verse_overview_is_pinned(client: AsyncClient):
    await _seed()
    auth = await _admin_auth(client)

    response = await client.get("/api/v1/bible-verses/analytics/overview", headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()

    # Two published verses.
    assert body["total_posts"] == 2
    assert body["published"] == 2
    # BR-13: 3 opens (A twice, B once), 2 distinct readers.
    assert body["total_opens"] == 3
    assert body["total_reads"] == 2
    assert body["read_rate"] == 66.7  # round(2 / 3 * 100, 1)


@pytest.mark.asyncio
async def test_the_quiz_overview_is_pinned(client: AsyncClient):
    await _seed()
    auth = await _admin_auth(client)

    response = await client.get("/api/v1/quizzes/analytics/overview", headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["total_quizzes"] == 2
    assert body["published_quizzes"] == 2
    # All attempts of any status exist for members A and B.
    assert body["participants"] == 2
    # COMPLETED + AUTO_FINISHED = t1, t4, t2.
    assert body["completed"] == 3
    assert body["auto_finished"] == 1
    # The raw average of the four attempt scores (10, 10, 0, 10) = 7.5.
    assert body["average_score"] == 7.5


@pytest.mark.asyncio
async def test_the_per_quiz_analytics_of_quiz_1_are_pinned(client: AsyncClient):
    ids = await _seed()
    auth = await _admin_auth(client)

    response = await client.get(f"/api/v1/quizzes/{ids['q1']}/analytics", headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()

    # Finished attempts of quiz 1: t1 (COMPLETED); t3 IN_PROGRESS is out (BR-41).
    assert body["participants"] == 1
    assert body["completed"] == 1
    assert body["auto_finished"] == 0
    # BR-50: round(10 / 1 / 10 * 10, 1) = 10.0.
    assert body["average_score_out_of_10"] == 10.0
    assert body["highest_score"] == 10
    assert body["lowest_score"] == 10
    assert body["total_points_awarded"] == 10
    assert body["max_possible_points"] == 10
    # BR-46: only COMPLETED, so it is 100 % of the finished attempts.
    assert body["completion_status"] == [
        {"status": "COMPLETED", "users": 1, "percentage": 100.0},
        {"status": "AUTO_FINISHED", "users": 0, "percentage": 0.0},
    ]
    # The score densified from the max (10) down to 0.
    assert body["score_distribution"] == [
        {"score": 10, "users": 1},
        {"score": 9, "users": 0},
        {"score": 8, "users": 0},
        {"score": 7, "users": 0},
        {"score": 6, "users": 0},
        {"score": 5, "users": 0},
        {"score": 4, "users": 0},
        {"score": 3, "users": 0},
        {"score": 2, "users": 0},
        {"score": 1, "users": 0},
        {"score": 0, "users": 0},
    ]


@pytest.mark.asyncio
async def test_the_per_quiz_analytics_of_quiz_2_are_pinned(client: AsyncClient):
    ids = await _seed()
    auth = await _admin_auth(client)

    response = await client.get(f"/api/v1/quizzes/{ids['q2']}/analytics", headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()

    # The attempts of quiz 2 are t2 (AUTO_FINISHED) and t4 (COMPLETED) (BR-41).
    assert body["participants"] == 2
    assert body["completed"] == 1
    assert body["auto_finished"] == 1
    # BR-50: round(20 / 2 / 20 * 10, 1) = 5.0.
    assert body["average_score_out_of_10"] == 5.0
    assert body["highest_score"] == 10
    assert body["lowest_score"] == 10
    assert body["total_points_awarded"] == 20
    assert body["max_possible_points"] == 20
    assert body["completion_status"] == [
        {"status": "COMPLETED", "users": 1, "percentage": 50.0},
        {"status": "AUTO_FINISHED", "users": 1, "percentage": 50.0},
    ]
    assert body["score_distribution"] == [
        {"score": 10, "users": 2},
        {"score": 9, "users": 0},
        {"score": 8, "users": 0},
        {"score": 7, "users": 0},
        {"score": 6, "users": 0},
        {"score": 5, "users": 0},
        {"score": 4, "users": 0},
        {"score": 3, "users": 0},
        {"score": 2, "users": 0},
        {"score": 1, "users": 0},
        {"score": 0, "users": 0},
    ]


@pytest.mark.asyncio
async def test_the_per_quiz_users_tables_are_pinned(client: AsyncClient):
    ids = await _seed()
    auth = await _admin_auth(client)

    # Quiz 1: only t1 (t3 is IN_PROGRESS, it is out).
    response = await client.get(f"/api/v1/quizzes/{ids['q1']}/analytics/users", headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["items"] == [
        {
            "user_id": str(ids["a"]),
            "full_name": "Amr A",
            "email": "member-a@c.com",
            "avatar": None,
            "score": 10,
            "total_points": 10,
            "percentage": 100.0,
            "points_awarded": 10,
            "status": "COMPLETED",
            "finished_at": "2026-03-15T10:00:00Z",
            "time_taken_seconds": 3600,
        },
    ]

    # Quiz 2: t2 (AUTO_FINISHED) then t4 (COMPLETED) — same score, finished_at ascending.
    response = await client.get(f"/api/v1/quizzes/{ids['q2']}/analytics/users", headers=auth)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 2
    assert body["items"] == [
        {
            "user_id": str(ids["b"]),
            "full_name": "Basma B",
            "email": "member-b@c.com",
            "avatar": None,
            "score": 10,
            "total_points": 20,
            "percentage": 50.0,
            "points_awarded": 10,
            "status": "AUTO_FINISHED",
            "finished_at": "2026-03-20T10:00:00Z",
            "time_taken_seconds": 3600,
        },
        {
            "user_id": str(ids["a"]),
            "full_name": "Amr A",
            "email": "member-a@c.com",
            "avatar": None,
            "score": 10,
            "total_points": 20,
            "percentage": 50.0,
            "points_awarded": 10,
            "status": "COMPLETED",
            "finished_at": "2026-04-05T10:00:00Z",
            "time_taken_seconds": 3600,
        },
    ]


@pytest.mark.asyncio
async def test_the_per_quiz_export_carries_the_same_numbers(client: AsyncClient):
    ids = await _seed()
    auth = await _admin_auth(client)

    # BR-47: the quiz export uses the same query as the users table.
    response = await client.get(f"/api/v1/quizzes/{ids['q1']}/analytics/export", headers=auth)
    assert response.status_code == 200, response.text
    rows = _parse_csv(response.content)

    assert rows[0] == [
        "user_id",
        "full_name",
        "score",
        "total_points",
        "percentage",
        "status",
        "finished_at",
        "time_taken_seconds",
    ]
    # BR-47: header + the single finished attempt of quiz 1 (t1; t3 IN_PROGRESS is out).
    assert len(rows) == 2
    assert rows[1][:6] == [
        str(ids["a"]),
        "Amr A",
        "10",
        "10",
        "100.0",
        "COMPLETED",
    ]
