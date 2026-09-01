"""Publication schedule persistence (P5-005, BR-9..BR-12)."""

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import ColumnElement, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.bible.domain.enums import (
    NotificationDeliveryStatus,
    ScheduleStatus,
)
from app.modules.bible.infrastructure.persistence.models import VersePublicationSchedule


class VerseScheduleRepository:
    """Claim-and-complete scheduling with ``FOR UPDATE SKIP LOCKED``.

    A claimed row is owned by exactly one tick; completion flips it to
    PUBLISHED inside the same transaction as the verse status change, so
    a second tick can never publish the same schedule twice (BR-10).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, schedule: VersePublicationSchedule) -> None:
        self._session.add(schedule)
        await self._session.flush()

    async def get_by_id(self, schedule_id: uuid.UUID) -> VersePublicationSchedule | None:
        result = await self._session.execute(
            select(VersePublicationSchedule).where(VersePublicationSchedule.id == schedule_id)
        )
        return result.scalar_one_or_none()

    async def get_active_for_verse(self, verse_id: uuid.UUID) -> VersePublicationSchedule | None:
        result = await self._session.execute(
            select(VersePublicationSchedule).where(
                VersePublicationSchedule.verse_id == verse_id,
                VersePublicationSchedule.status == ScheduleStatus.SCHEDULED,
            )
        )
        return result.scalar_one_or_none()

    async def get_latest_for_verse(self, verse_id: uuid.UUID) -> VersePublicationSchedule | None:
        result = await self._session.execute(
            select(VersePublicationSchedule)
            .where(VersePublicationSchedule.verse_id == verse_id)
            .order_by(VersePublicationSchedule.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def claim_due(self, limit: int, now: datetime) -> list[VersePublicationSchedule]:
        """Atomically claim due rows for this worker (BR-10/BR-11).

        Uses ``SELECT … FOR UPDATE SKIP LOCKED`` to serialise concurrent
        claimants, then marks each claimed row so later ticks skip it.
        """
        unclaimed = (
            (VersePublicationSchedule.claimed_at.is_(None))
            | (VersePublicationSchedule.claimed_at < now)
        )
        retryable_failed = (
            (VersePublicationSchedule.status == ScheduleStatus.FAILED)
            & (VersePublicationSchedule.attempts < 5)
        )
        due = (
            VersePublicationSchedule.scheduled_at <= now
        ) & (
            (VersePublicationSchedule.status == ScheduleStatus.SCHEDULED)
            | retryable_failed
        )

        lock_stmt = (
            select(VersePublicationSchedule.id)
            .where(due & unclaimed)
            .order_by(VersePublicationSchedule.scheduled_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await self._session.execute(lock_stmt)
        claimed_ids = [row[0] for row in result.fetchall()]

        if not claimed_ids:
            return []

        await self._session.execute(
            update(VersePublicationSchedule)
            .where(VersePublicationSchedule.id.in_(claimed_ids))
            .values(claimed_at=now)
        )

        rows = await self._session.execute(
            select(VersePublicationSchedule)
            .where(VersePublicationSchedule.id.in_(claimed_ids))
        )
        return list(rows.scalars().all())

    async def mark_published(
        self, schedule: VersePublicationSchedule, published_at: datetime
    ) -> None:
        schedule.status = ScheduleStatus.PUBLISHED
        schedule.published_at = published_at
        schedule.claimed_at = None
        await self._session.flush()

    async def mark_failed(self, schedule: VersePublicationSchedule, error: str) -> None:
        """Record one publication failure (BR-11). The row keeps status
        FAILED; ``claim_due`` picks it up again while ``attempts < 5``."""
        schedule.status = ScheduleStatus.FAILED
        schedule.attempts += 1
        schedule.last_error = error[:2000]
        schedule.claimed_at = None
        await self._session.flush()

    async def mark_cancelled(self, schedule: VersePublicationSchedule) -> None:
        schedule.status = ScheduleStatus.CANCELLED
        schedule.claimed_at = None
        await self._session.flush()

    async def set_notification_status(
        self,
        schedule: VersePublicationSchedule,
        status: NotificationDeliveryStatus,
        *,
        notified_at: datetime | None = None,
    ) -> None:
        schedule.notification_status = status
        if notified_at is not None:
            schedule.notified_at = notified_at
        await self._session.flush()

    async def bump_notification_attempts(self, schedule: VersePublicationSchedule) -> int:
        schedule.notification_attempts += 1
        await self._session.flush()
        return schedule.notification_attempts

    async def list_for_manager(
        self,
        *,
        status: ScheduleStatus | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int,
        offset: int,
    ) -> tuple[list[VersePublicationSchedule], int]:
        stmt = select(VersePublicationSchedule).options(
            selectinload(VersePublicationSchedule.verse)
        )
        conditions: list[ColumnElement[bool]] = []
        if status is not None:
            conditions.append(VersePublicationSchedule.status == status)
        if date_from is not None:
            conditions.append(VersePublicationSchedule.scheduled_at >= date_from)
        if date_to is not None:
            conditions.append(VersePublicationSchedule.scheduled_at <= date_to)
        if conditions:
            stmt = stmt.where(*conditions)
        total = int(
            (
                await self._session.execute(
                    select(func.count()).select_from(VersePublicationSchedule).where(*conditions)
                )
            ).scalar_one()
        )
        stmt = (
            stmt.order_by(VersePublicationSchedule.scheduled_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows: Sequence[VersePublicationSchedule] = (
            (await self._session.execute(stmt)).scalars().all()
        )
        return list(rows), total
