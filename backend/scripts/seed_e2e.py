"""Seed the database for the end-to-end tests.

The E2E tests need a real member, a real admin, a published verse with
a quiz and an attendance PIN - the three golden paths of the platform
(sign in, take a quiz, check in).

The script is idempotent: it can be run again before every E2E run, and
it only touches the rows it owns (the two accounts and the verse of the
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
from datetime import UTC, datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.config import settings  # noqa: E402
from app.core.database import async_session_factory  # noqa: E402
from app.modules.bible.domain.enums.verse_status import VerseStatus  # noqa: E402
from app.modules.bible.infrastructure.persistence.models import BibleVerse  # noqa: E402
from app.modules.quiz.domain.enums.quiz_status import QuizStatus  # noqa: E402
from app.modules.quiz.infrastructure.persistence.models import (  # noqa: E402
    Quiz,
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

E2E_VERSE_REFERENCE = "E2E-1"


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


async def _seed_verse_with_quiz(session: AsyncSession) -> None:
    """A published verse with a published quiz and two questions."""
    verse = await session.scalar(
        select(BibleVerse).where(BibleVerse.verse_reference == E2E_VERSE_REFERENCE)
    )
    if verse is None:
        verse = BibleVerse(
            title="آية الاختبار",
            verse_reference=E2E_VERSE_REFERENCE,
            book=" exodus",
            chapter=1,
            verse_start=1,
            text="آية للاختبار الشامل.",
            status=VerseStatus.PUBLISHED,
            published_at=datetime.now(UTC),
        )
        session.add(verse)
        await session.flush()

    quiz = await session.scalar(select(Quiz).where(Quiz.verse_id == verse.id))
    if quiz is None:
        quiz = Quiz(
            verse_id=verse.id,
            title="اختبار الاختبار",
            description="اختبار المسار الكامل.",
            duration_seconds=600,
            status=QuizStatus.PUBLISHED,
            published_at=datetime.now(UTC),
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
        await _upsert_user(
            session,
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
            first_name="خادم",
            role=admin_role,
        )

        # The PIN of the member (the offline fallback of the QR code).
        from app.modules.users.application.services.attendance_pin import (
            hash_attendance_pin,
        )

        member.attendance_pin_hash = hash_attendance_pin(MEMBER_PIN)
        session.add(member)

        await _seed_verse_with_quiz(session)
        await session.commit()

    print("the E2E data is ready:")
    print(f"  member : {MEMBER_EMAIL} / {MEMBER_PASSWORD} (PIN {MEMBER_PIN})")
    print(f"  admin  : {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"  database: {settings.DATABASE_URL.split('/')[-1]}")


if __name__ == "__main__":  # pragma: no cover - the entry point
    asyncio.run(seed())
