"""Seed the database for the end-to-end tests.

The E2E tests need real members and a real admin, a published verse with
a quiz, an attendance PIN, a completed attempt with points, a published
blog post and a notification. They are the data of the member journeys of
the platform (sign in, quiz, attendance, verse, points, blog and
notifications).

The script is idempotent: it can be run again before every E2E run, and
it only touches the rows it owns (the accounts and the content marked as
E2E).

Usage::

    python scripts/seed_e2e.py

It refuses to run against a database whose name does not contain "test"
(or "e2e") - a seeded production database would be a disaster.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import timedelta
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.config import settings  # noqa: E402
from app.core.database import async_session_factory  # noqa: E402
from app.core.time.clock import now_utc, today_local  # noqa: E402
from app.core.time.periods import iso_week_start, month_start  # noqa: E402
from app.modules.bible.domain.enums.verse_status import VerseStatus  # noqa: E402
from app.modules.bible.infrastructure.persistence.models import BibleVerse  # noqa: E402
from app.modules.blog.domain.enums.post_status import PostStatus  # noqa: E402
from app.modules.blog.infrastructure.persistence.models import BlogPost  # noqa: E402
from app.modules.notifications.domain.enums.notification_type import (  # noqa: E402
    NotificationType,
)
from app.modules.notifications.infrastructure.persistence.models import (  # noqa: E402
    Notification,
)
from app.modules.points.domain.enums.point_source import PointSource  # noqa: E402
from app.modules.points.infrastructure.persistence.models import PointTransaction  # noqa: E402
from app.modules.quiz.domain.enums.attempt_status import AttemptStatus  # noqa: E402
from app.modules.quiz.domain.enums.quiz_status import QuizStatus  # noqa: E402
from app.modules.quiz.infrastructure.persistence.models import (  # noqa: E402
    Quiz,
    QuizAttempt,
    QuizOption,
    QuizQuestion,
)
from app.modules.users.domain.enums.role_name import RoleName  # noqa: E402
from app.modules.users.domain.enums.user_status import UserStatus  # noqa: E402
from app.modules.users.infrastructure.persistence.models import Role, User  # noqa: E402
from app.shared.security import hash_password  # noqa: E402

MEMBER_EMAIL = "e2e-member@example.com"
MEMBER_PASSWORD = "E2eMember!2026"
MEMBER_PIN = "12345"

ADMIN_EMAIL = "e2e-admin@example.com"
ADMIN_PASSWORD = "E2eAdmin!2026"

POINTS_MEMBER_EMAIL = "e2e-points@example.com"
POINTS_MEMBER_PASSWORD = "e2e-PointsMember!2026"

E2E_VERSE_REFERENCE = "E2E-1"
E2E_VERSE_TITLE = "آية الاختبار"
E2E_VERSE_TEXT = "آية للاختبار الشامل."
E2E_VERSE_REFLECTION = "تأمل الاختبار الشامل."

E2E_PUBLISHED_POST_SLUG = "e2e-published-post"
E2E_PUBLISHED_POST_TITLE = "منشور الاختبار"
E2E_DRAFT_POST_SLUG = "e2e-draft-post"
E2E_DRAFT_POST_TITLE = "مسودة الاختبار"

E2E_NOTIFICATION_TITLE = "إشعار الاختبار"
E2E_NOTIFICATION_MESSAGE = "هذه رسالة إشعار الاختبار."


def _guard_database() -> None:
    """Never seed a database that is not a test database."""
    url = settings.DATABASE_URL
    if "test" not in url and "e2e" not in url:
        raise SystemExit(
            f"refusing to seed {url!r}: the name of the database must contain 'test' or 'e2e'"
        )


async def _upsert_role(session: AsyncSession, name: RoleName) -> Role:
    role = await session.scalar(select(Role).where(Role.name == name))
    if role is None:
        role = Role(name=name, description=f"{name} role")
        session.add(role)
        await session.flush()
    return role


async def _upsert_user(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    first_name: str,
    role: Role,
    pin: str | None = None,
) -> User:
    user = await session.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            first_name=first_name,
            last_name="E2E",
            password_hash=hash_password(password),
            public_id=f"e2e-{uuid.uuid4().hex[:16]}",
            status=UserStatus.ACTIVE,
            role_id=role.id,
            has_password=True,
            email_verified=True,
            attendance_pin_hash=None,
        )
        session.add(user)
    else:
        user.password_hash = hash_password(password)
        user.status = UserStatus.ACTIVE
        user.role_id = role.id
        user.email_verified = True
        user.has_password = True
    await session.flush()
    return user


async def _remove_previous_e2e_users(session: AsyncSession) -> None:
    """Delete the accounts of a previous run.

    The PIN of a member is unique in the database: without the cleanup,
    a second run would collide with the hash of the first one.
    """
    previous = list(await session.scalars(select(User).where(User.email.like("e2e-%"))))
    for user in previous:
        await session.delete(user)
    if previous:
        await session.flush()
        print(f"removed {len(previous)} account(s) of the previous run")


async def _seed_verse_with_quiz(session: AsyncSession) -> Quiz:
    """A published verse with a published quiz and two questions."""
    verse = await session.scalar(
        select(BibleVerse).where(BibleVerse.verse_reference == E2E_VERSE_REFERENCE)
    )
    if verse is None:
        verse = BibleVerse(
            title=E2E_VERSE_TITLE,
            verse_reference=E2E_VERSE_REFERENCE,
            book="exodus",
            chapter=1,
            verse_start=1,
            text=E2E_VERSE_TEXT,
            reflection=E2E_VERSE_REFLECTION,
            status=VerseStatus.PUBLISHED,
            published_at=now_utc(),
        )
        session.add(verse)
        await session.flush()
    else:
        verse.title = E2E_VERSE_TITLE
        verse.text = E2E_VERSE_TEXT
        verse.reflection = E2E_VERSE_REFLECTION
        verse.status = VerseStatus.PUBLISHED
        if verse.published_at is None:
            verse.published_at = now_utc()
        await session.flush()

    quiz = await session.scalar(select(Quiz).where(Quiz.verse_id == verse.id))
    if quiz is None:
        quiz = Quiz(
            verse_id=verse.id,
            title="اختبار الاختبار",
            description="اختبار المسار الكامل.",
            duration_seconds=600,
            status=QuizStatus.PUBLISHED,
            published_at=now_utc(),
            total_points=2,
        )
        session.add(quiz)
        await session.flush()

        for index in range(2):
            question = QuizQuestion(
                quiz_id=quiz.id,
                question=f"السؤال {index + 1}",
                points=1,
                position=index,
            )
            session.add(question)
            await session.flush()
            for option_index, text in enumerate(("صح", "خطأ")):
                session.add(
                    QuizOption(
                        question_id=question.id,
                        option_text=text,
                        is_correct=option_index == 0,
                        position=option_index,
                    )
                )
        await session.flush()
    return quiz


async def _seed_points(
    session: AsyncSession,
    *,
    member: User,
    quiz: Quiz,
) -> None:
    """A completed attempt and the matching point-ledger row."""
    attempt = await session.scalar(
        select(QuizAttempt).where(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == member.id,
        )
    )
    if attempt is None:
        finished_at = now_utc()
        started_at = finished_at - timedelta(minutes=5)
        attempt = QuizAttempt(
            quiz_id=quiz.id,
            user_id=member.id,
            started_at=started_at,
            budget_remaining_seconds=0,
            last_heartbeat_at=started_at,
            submitted_at=finished_at,
            finished_at=finished_at,
            status=AttemptStatus.COMPLETED,
            duration_seconds=quiz.duration_seconds,
            total_points=quiz.total_points,
            question_count=2,
            score=quiz.total_points,
            correct_count=2,
            incorrect_count=0,
        )
        session.add(attempt)
        await session.flush()

    transaction = await session.scalar(
        select(PointTransaction).where(
            PointTransaction.quiz_attempt_id == attempt.id,
        )
    )
    if transaction is None:
        today = today_local()
        session.add(
            PointTransaction(
                user_id=member.id,
                quiz_attempt_id=attempt.id,
                source=PointSource.QUIZ.value,
                points=quiz.total_points,
                awarded_at=attempt.finished_at or now_utc(),
                period_week_start=iso_week_start(today),
                period_month=month_start(today),
            )
        )
        await session.flush()


async def _seed_blog_posts(session: AsyncSession, *, admin: User) -> None:
    """One published post for the public feed and one hidden draft."""
    published = await session.scalar(
        select(BlogPost).where(BlogPost.slug == E2E_PUBLISHED_POST_SLUG)
    )
    if published is None:
        published = BlogPost(
            author_id=admin.id,
            title=E2E_PUBLISHED_POST_TITLE,
            slug=E2E_PUBLISHED_POST_SLUG,
            excerpt="مقتطف منشور الاختبار.",
            content="<p>نص منشور الاختبار.</p>",
            status=PostStatus.PUBLISHED,
            published_at=now_utc() - timedelta(minutes=1),
        )
        session.add(published)
    else:
        published.author_id = admin.id
        published.title = E2E_PUBLISHED_POST_TITLE
        published.excerpt = "مقتطف منشور الاختبار."
        published.content = "<p>نص منشور الاختبار.</p>"
        published.status = PostStatus.PUBLISHED
        if published.published_at is None:
            published.published_at = now_utc() - timedelta(minutes=1)

    draft = await session.scalar(select(BlogPost).where(BlogPost.slug == E2E_DRAFT_POST_SLUG))
    if draft is None:
        session.add(
            BlogPost(
                author_id=admin.id,
                title=E2E_DRAFT_POST_TITLE,
                slug=E2E_DRAFT_POST_SLUG,
                excerpt="مقتطف مسودة الاختبار.",
                content="<p>نص مسودة الاختبار.</p>",
                status=PostStatus.DRAFT,
            )
        )
    else:
        draft.author_id = admin.id
        draft.title = E2E_DRAFT_POST_TITLE
        draft.status = PostStatus.DRAFT
        draft.published_at = None
    await session.flush()


async def _seed_notification(session: AsyncSession, *, member: User) -> None:
    """One unread announcement in the personal feed of the member."""
    notification = await session.scalar(
        select(Notification).where(
            Notification.user_id == member.id,
            Notification.title == E2E_NOTIFICATION_TITLE,
        )
    )
    if notification is None:
        session.add(
            Notification(
                user_id=member.id,
                type=NotificationType.ANNOUNCEMENT,
                title=E2E_NOTIFICATION_TITLE,
                message=E2E_NOTIFICATION_MESSAGE,
                title_en="E2E notification",
                message_en="This is the E2E notification.",
                data={"icon": "Bell"},
            )
        )
        await session.flush()


async def seed() -> None:
    _guard_database()

    async with async_session_factory() as session:
        await _remove_previous_e2e_users(session)

        member_role = await _upsert_role(session, RoleName.MEMBER)
        admin_role = await _upsert_role(session, RoleName.ADMIN)

        member = await _upsert_user(
            session,
            email=MEMBER_EMAIL,
            password=MEMBER_PASSWORD,
            first_name="عضو",
            role=member_role,
        )
        admin = await _upsert_user(
            session,
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
            first_name="خادم",
            role=admin_role,
        )
        points_member = await _upsert_user(
            session,
            email=POINTS_MEMBER_EMAIL,
            password=POINTS_MEMBER_PASSWORD,
            first_name="عضو",
            role=member_role,
        )

        # The PIN of the member (the offline fallback of the QR code).
        from app.modules.users.application.services.attendance_pin import (
            hash_attendance_pin,
        )

        member.attendance_pin_hash = hash_attendance_pin(MEMBER_PIN)
        session.add(member)

        quiz = await _seed_verse_with_quiz(session)
        await _seed_points(session, member=points_member, quiz=quiz)
        await _seed_blog_posts(session, admin=admin)
        await _seed_notification(session, member=member)
        await session.commit()

    print("the E2E data is ready:")
    print(f"  member : {MEMBER_EMAIL} / {MEMBER_PASSWORD} (PIN {MEMBER_PIN})")
    print(f"  points : {POINTS_MEMBER_EMAIL} / {POINTS_MEMBER_PASSWORD}")
    print(f"  admin  : {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"  database: {settings.DATABASE_URL.split('/')[-1]}")


if __name__ == "__main__":  # pragma: no cover - the entry point
    asyncio.run(seed())
