"""Verse engagement persistence: opens and reads (P5-005, BR-13..BR-16)."""

import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import func, insert, literal, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.bible.infrastructure.persistence.models import VerseRead, VerseView


class VerseEngagementRepository:
    """High-volume append-only tracking with race-safe dedupe.

    ``record_open`` is a single conditional ``INSERT … SELECT … WHERE NOT
    EXISTS`` so concurrent opens cannot inflate the count without taking
    a lock (D-16). ``mark_read`` relies on the unique pair index with
    ``ON CONFLICT DO NOTHING`` (BR-14).
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record_open(
        self, verse_id: uuid.UUID, user_id: uuid.UUID, *, dedupe_seconds: int
    ) -> bool:
        """Insert one open unless the same user opened the same verse
        within the dedupe window. Returns True when a row was inserted."""
        from app.core.time.clock import now_utc

        now = now_utc()
        recent = (
            select(1)
            .where(
                VerseView.verse_id == verse_id,
                VerseView.user_id == user_id,
                VerseView.opened_at > now - timedelta(seconds=dedupe_seconds),
            )
            .exists()
        )
        stmt = (
            insert(VerseView)
            .from_select(
                [VerseView.verse_id, VerseView.user_id, VerseView.opened_at],
                # Literals, not column refs: selecting the table's columns
                # would turn this into a scan of verse_views itself.
                select(
                    literal(verse_id),
                    literal(user_id),
                    func.now(),
                ).where(~recent),
            )
            .returning(VerseView.id)
        )
        result = await self._session.execute(stmt)
        return result.first() is not None

    async def mark_read(
        self, verse_id: uuid.UUID, user_id: uuid.UUID, *, read_at: datetime | None = None
    ) -> tuple[datetime, bool]:
        """Idempotent read marker. Returns ``(read_at, already_read)``."""
        stmt = (
            pg_insert(VerseRead)
            .values(verse_id=verse_id, user_id=user_id)
            .on_conflict_do_nothing(index_elements=["verse_id", "user_id"])
            .returning(VerseRead.read_at)
        )
        if read_at is not None:
            stmt = (
                pg_insert(VerseRead)
                .values(verse_id=verse_id, user_id=user_id, read_at=read_at)
                .on_conflict_do_nothing(index_elements=["verse_id", "user_id"])
                .returning(VerseRead.read_at)
            )
        result = await self._session.execute(stmt)
        row = result.first()
        if row is not None:
            return row.read_at, False
        existing = await self._session.execute(
            select(VerseRead.read_at).where(
                VerseRead.verse_id == verse_id, VerseRead.user_id == user_id
            )
        )
        stored = existing.scalar_one()
        return stored, True

    async def has_read(self, verse_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(VerseRead.id).where(
                VerseRead.verse_id == verse_id, VerseRead.user_id == user_id
            )
        )
        return result.first() is not None

    async def read_map_for_verses(
        self, verse_ids: Sequence[uuid.UUID], user_id: uuid.UUID
    ) -> dict[uuid.UUID, datetime]:
        """One grouped lookup of the caller's reads for a whole page."""
        if not verse_ids:
            return {}
        result = await self._session.execute(
            select(VerseRead.verse_id, VerseRead.read_at).where(
                VerseRead.verse_id.in_(verse_ids), VerseRead.user_id == user_id
            )
        )
        return {verse_id: read_at for verse_id, read_at in result.all()}

    async def latest_open_before(
        self, verse_id: uuid.UUID, user_id: uuid.UUID, *, now: datetime, dedupe_seconds: int
    ) -> datetime | None:
        result = await self._session.execute(
            select(func.max(VerseView.opened_at)).where(
                VerseView.verse_id == verse_id,
                VerseView.user_id == user_id,
                VerseView.opened_at > now - timedelta(seconds=dedupe_seconds),
            )
        )
        return result.scalar_one_or_none()

    # -- analytics aggregates (BR-16, used from wave 5C) -------------------

    async def open_counts_for_verses(self, verse_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not verse_ids:
            return {}
        result = await self._session.execute(
            select(VerseView.verse_id, func.count())
            .where(VerseView.verse_id.in_(verse_ids))
            .group_by(VerseView.verse_id)
        )
        return {verse_id: int(count) for verse_id, count in result.all()}

    async def read_counts_for_verses(self, verse_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not verse_ids:
            return {}
        result = await self._session.execute(
            select(VerseRead.verse_id, func.count())
            .where(VerseRead.verse_id.in_(verse_ids))
            .group_by(VerseRead.verse_id)
        )
        return {verse_id: int(count) for verse_id, count in result.all()}

    async def unique_opens(self, verse_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(func.distinct(VerseView.user_id))).where(
                VerseView.verse_id == verse_id
            )
        )
        return int(result.scalar_one())

    async def total_opens(self, verse_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count()).where(VerseView.verse_id == verse_id)
        )
        return int(result.scalar_one())

    async def total_reads(self, verse_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count()).where(VerseRead.verse_id == verse_id)
        )
        return int(result.scalar_one())

    async def read_rate(self, verse_id: uuid.UUID) -> float:
        """``unique_readers / unique_opens * 100`` rounded to 0.1 (BR-16)."""
        unique = await self.unique_opens(verse_id)
        if unique == 0:
            return 0.0
        readers = await self.total_reads(verse_id)
        return round(readers / unique * 100, 1)

    async def engagement_series(
        self,
        verse_id: uuid.UUID,
        *,
        date_from: datetime,
        date_to: datetime,
    ) -> list[tuple[datetime, int, int]]:
        """Daily (opens, reads) buckets over a window, in one query each.

        Gap-filling to calendar days happens in the analytics query layer.
        """
        opens = await self._session.execute(
            select(
                func.date_trunc("day", VerseView.opened_at).label("bucket"),
                func.count(),
            )
            .where(
                VerseView.verse_id == verse_id,
                VerseView.opened_at >= date_from,
                VerseView.opened_at < date_to,
            )
            .group_by("bucket")
            .order_by("bucket")
        )
        reads = await self._session.execute(
            select(
                func.date_trunc("day", VerseRead.read_at).label("bucket"),
                func.count(),
            )
            .where(
                VerseRead.verse_id == verse_id,
                VerseRead.read_at >= date_from,
                VerseRead.read_at < date_to,
            )
            .group_by("bucket")
            .order_by("bucket")
        )
        open_map = {bucket: int(count) for bucket, count in opens.all()}
        read_map = {bucket: int(count) for bucket, count in reads.all()}
        buckets = sorted(set(open_map) | set(read_map))
        return [(b, open_map.get(b, 0), read_map.get(b, 0)) for b in buckets]

    async def user_engagement_rows(
        self,
        verse_id: uuid.UUID,
        *,
        member_role_id: int | None = None,
        q: str | None = None,
        limit: int,
        offset: int,
    ) -> tuple[list[dict[str, object]], int]:
        """Per-user engagement page (wave 5C): opened count, has_read,
        last_opened_at — one grouped query joining users."""
        from app.modules.users.infrastructure.persistence.models import Role, User

        base = (
            select(
                User.id.label("user_id"),
                User.first_name,
                User.last_name,
                User.avatar,
                func.count(VerseView.id).label("opened_count"),
                func.max(VerseView.opened_at).label("last_opened_at"),
                VerseRead.id.label("read_row"),
            )
            .join(Role, Role.id == User.role_id)
            .where(User.id.in_(select(VerseView.user_id).where(VerseView.verse_id == verse_id)))
            .group_by(User.id, User.first_name, User.last_name, User.avatar, VerseRead.id)
        )
        if member_role_id is not None:
            base = base.where(Role.id == member_role_id)
        if q:
            pattern = f"%{q}%"
            base = base.where(
                func.concat(User.first_name, " ", User.last_name).ilike(pattern)
                | User.email.ilike(pattern)
            )
        subquery = base.subquery()
        total = int(
            (
                await self._session.execute(select(func.count()).select_from(subquery))
            ).scalar_one()
        )
        rows = (
            await self._session.execute(base.order_by("opened_count").limit(limit).offset(offset))
        ).all()
        return [dict(row._mapping) for row in rows], total

    # -- role-filtered aggregates (P5-033, BR-13: exclude managers) --------

    async def member_open_read_stats(
        self, verse_id: uuid.UUID, member_role_id: int
    ) -> dict[str, int]:
        """Member-only opens, unique openers, readers/unique readers."""

        def _member_join(src_uid_col):
            return src_uid_col.in_(
                select(User.id)
                .join(Role, Role.id == User.role_id)
                .where(Role.id == member_role_id)
            )

        from app.modules.users.infrastructure.persistence.models import Role, User

        total_opens = int(
            (
                await self._session.execute(
                    select(func.count())
                    .where(
                        VerseView.verse_id == verse_id,
                        VerseView.user_id.in_(
                            select(User.id).join(Role, Role.id == User.role_id).where(
                                Role.id == member_role_id
                            )
                        ),
                    )
                )
            ).scalar_one()
        )
        unique_opens = int(
            (
                await self._session.execute(
                    select(func.count(func.distinct(VerseView.user_id))).where(
                        VerseView.verse_id == verse_id,
                        VerseView.user_id.in_(
                            select(User.id).join(Role, Role.id == User.role_id).where(
                                Role.id == member_role_id
                            )
                        ),
                    )
                )
            ).scalar_one()
        )
        total_reads = int(
            (
                await self._session.execute(
                    select(func.count(func.distinct(VerseRead.user_id))).where(
                        VerseRead.verse_id == verse_id,
                        VerseRead.user_id.in_(
                            select(User.id).join(Role, Role.id == User.role_id).where(
                                Role.id == member_role_id
                            )
                        ),
                    )
                )
            ).scalar_one()
        )
        return {
            "total_opens": total_opens,
            "unique_opens": unique_opens,
            "total_reads": total_reads,
        }

    async def member_series(
        self,
        verse_id: uuid.UUID,
        member_role_id: int,
        *,
        date_from: datetime,
        date_to: datetime,
        weekly: bool = False,
    ) -> tuple[list[tuple[datetime, int, int]], list[tuple[datetime, int, int]]]:
        """Member opens/reads bucketed daily or weekly (BR-13)."""
        from app.modules.users.infrastructure.persistence.models import Role, User

        member_subq = (
            select(User.id)
            .join(Role, Role.id == User.role_id)
            .where(Role.id == member_role_id)
        )
        trunc = "week" if weekly else "day"

        opens = await self._session.execute(
            select(
                func.date_trunc(trunc, VerseView.opened_at).label("bucket"),
                func.count(),
            )
            .where(
                VerseView.verse_id == verse_id,
                VerseView.user_id.in_(member_subq),
                VerseView.opened_at >= date_from,
                VerseView.opened_at < date_to,
            )
            .group_by("bucket")
            .order_by("bucket")
        )
        reads = await self._session.execute(
            select(
                func.date_trunc(trunc, VerseRead.read_at).label("bucket"),
                func.count(),
            )
            .where(
                VerseRead.verse_id == verse_id,
                VerseRead.user_id.in_(member_subq),
                VerseRead.read_at >= date_from,
                VerseRead.read_at < date_to,
            )
            .group_by("bucket")
            .order_by("bucket")
        )
        open_list = [(b, int(c)) for b, c in opens.all()]
        read_list = [(b, int(c)) for b, c in reads.all()]
        return open_list, read_list

    async def member_open_and_read_totals_overall(
        self, member_role_id: int
    ) -> tuple[int, int]:
        """Dashboard totals across all verses (BR-13, BR-16)."""
        from app.modules.users.infrastructure.persistence.models import Role, User

        member_subq = (
            select(User.id)
            .join(Role, Role.id == User.role_id)
            .where(Role.id == member_role_id)
        )
        opens = int(
            (
                await self._session.execute(
                    select(func.count()).where(VerseView.user_id.in_(member_subq))
                )
            ).scalar_one()
        )
        reads = int(
            (
                await self._session.execute(
                    select(func.count(func.distinct(VerseRead.user_id))).where(
                        VerseRead.user_id.in_(member_subq)
                    )
                )
            ).scalar_one()
        )
        return opens, reads
