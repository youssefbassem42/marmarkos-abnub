"""Scheduler tick endpoint integration tests (P5-019 acceptance)."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from httpx import AsyncClient

from app.config import settings
from app.core.database import async_session_factory
from app.modules.bible.infrastructure.persistence.models import (
    BibleVerse,
    VersePublicationSchedule,
)
from app.modules.users.domain.enums.role_name import RoleName
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork
from tests.utils import bearer, create_user_direct, login, register_and_login

TICK_URL = "/api/v1/internal/scheduler/tick"


async def _schedule_one_verse() -> None:
    async with UnitOfWork.create(async_session_factory) as uow:
        verse = BibleVerse(
            title="Psalm 23",
            verse_reference="Psalm 23:1",
            book="Psalms",
            chapter=23,
            verse_start=1,
            text="The Lord is my shepherd",
        )
        await uow.bible_verses.add(verse)
        schedule = VersePublicationSchedule(
            verse_id=verse.id,
            scheduled_at=datetime.now(UTC) - timedelta(minutes=2),
        )
        await uow.verse_schedules.add(schedule)
        verse.status = "SCHEDULED"
        await uow.commit()


async def test_wrong_secret_is_unauthorized(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "CRON_SECRET", "correct-secret")
    response = await client.post(TICK_URL, headers={"X-Cron-Secret": "wrong-secret"})
    assert response.status_code == 401


async def test_servant_and_member_bearers_are_forbidden(client: AsyncClient, db_engine) -> None:
    monkeypatch_secret = None
    del monkeypatch_secret
    settings.CRON_SECRET = None  # force the bearer path
    try:
        await create_user_direct(
            engine=db_engine,
            email="tick-servant@example.com",
            role_name=RoleName.SERVANT,
        )
        auth = await login(client, email="tick-servant@example.com")
        response = await client.post(TICK_URL, headers=bearer(auth["access_token"]))
        assert response.status_code == 403

        member_auth, _ = await register_and_login(client)
        response = await client.post(TICK_URL, headers=bearer(member_auth["access_token"]))
        assert response.status_code == 403
    finally:
        settings.CRON_SECRET = None


async def test_unset_secret_without_bearer_is_scheduler_disabled(client: AsyncClient) -> None:
    assert settings.CRON_SECRET is None
    response = await client.post(TICK_URL)
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "scheduler_disabled"


async def test_correct_secret_publishes_and_returns_counters(client: AsyncClient, db_engine) -> None:
    secret = "tick-secret-123"
    settings.CRON_SECRET = secret
    try:
        await _schedule_one_verse()
        with patch(
            "app.shared.application.outbox_dispatcher.EVENT_HANDLERS",
            {},
        ):
            response = await client.post(TICK_URL, headers={"X-Cron-Secret": secret})

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["published"] == 1
        assert body["auto_finished_attempts"] == 0

        # Idempotent: a second tick publishes nothing.
        second = await client.post(TICK_URL, headers={"X-Cron-Secret": secret})
        assert second.json()["published"] == 0

        async with UnitOfWork.create(async_session_factory) as uow:
            from sqlalchemy import select

            verses = (await uow.session.execute(select(BibleVerse))).scalars().all()
            assert verses[0].status == "PUBLISHED"
    finally:
        settings.CRON_SECRET = None


async def test_admin_bearer_can_trigger_tick(client: AsyncClient, db_engine) -> None:
    await create_user_direct(
        engine=db_engine, email="tick-admin2@example.com", role_name=RoleName.ADMIN
    )
    auth = await login(client, email="tick-admin2@example.com")
    response = await client.post(TICK_URL, headers=bearer(auth["access_token"]))
    assert response.status_code == 200
