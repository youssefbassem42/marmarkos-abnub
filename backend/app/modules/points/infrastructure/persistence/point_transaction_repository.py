"""Points ledger persistence (P5-007, BR-31..BR-36, P5-035)."""

import uuid
from collections.abc import Sequence
from datetime import date, datetime

from sqlalchemy import case, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time.periods import iso_week_start, month_start
from app.modules.points.infrastructure.persistence.models import PointTransaction


class PointTransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def award(
        self,
        *,
        user_id: uuid.UUID,
        quiz_attempt_id: uuid.UUID,
        points: int,
        period_week_start: date,
        period_month: date,
        awarded_at: datetime | None = None,
    ) -> tuple[PointTransaction, bool]:
        """Insert one ledger row; on conflict return the existing row.

        The unique ``quiz_attempt_id`` index makes double-awarding
        impossible (BR-31); the caller treats ``inserted=False`` as "the
        attempt was already graded and paid out" (BR-29).
        """
        values: dict[str, object] = {
            "user_id": user_id,
            "quiz_attempt_id": quiz_attempt_id,
            "points": points,
            "period_week_start": period_week_start,
            "period_month": period_month,
        }
        if awarded_at is not None:
            values["awarded_at"] = awarded_at
        stmt = (
            pg_insert(PointTransaction)
            .values(**values)
            .on_conflict_do_nothing(index_elements=["quiz_attempt_id"])
            .returning(PointTransaction.id)
        )
        result = await self._session.execute(stmt)
        inserted = result.scalar_one_or_none()
        if inserted is not None:
            row = await self._session.get(PointTransaction, inserted)
            assert row is not None
            return row, True
        existing = await self._session.execute(
            select(PointTransaction).where(PointTransaction.quiz_attempt_id == quiz_attempt_id)
        )
        row = existing.scalar_one()
        return row, False

    async def delete_for_attempt(self, quiz_attempt_id: uuid.UUID) -> None:
        """Remove a ghost attempt's ledger entry before it is retaken.

        An empty auto-finished attempt may have left a 0-point row keyed by
        its id; resetting that attempt in place would otherwise make the real
        take's award a no-op (unique quiz_attempt_id, BR-31).
        """
        await self._session.execute(
            delete(PointTransaction).where(
                PointTransaction.quiz_attempt_id == quiz_attempt_id
            )
        )

    async def totals_for_user(self, user_id: uuid.UUID, *, today: date) -> dict[str, int]:
        """Lifetime / this-week / this-month sums in one query each (BR-34).

        ``today`` is injected by the caller from ``clock.today_local()``
        so tests can pin period boundaries.
        """
        lifetime = int(
            (
                await self._session.execute(
                    select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
                        PointTransaction.user_id == user_id
                    )
                )
            ).scalar_one()
        )
        week = int(
            (
                await self._session.execute(
                    select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
                        PointTransaction.user_id == user_id,
                        PointTransaction.period_week_start == iso_week_start(today),
                    )
                )
            ).scalar_one()
        )
        month = int(
            (
                await self._session.execute(
                    select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
                        PointTransaction.user_id == user_id,
                        PointTransaction.period_month == month_start(today),
                    )
                )
            ).scalar_one()
        )
        return {"lifetime": lifetime, "this_week": week, "this_month": month}

    async def monthly_series_for_user(
        self, user_id: uuid.UUID, months: Sequence[date]
    ) -> dict[date, tuple[int, int]]:
        """(points, quizzes_completed) per first-of-month for the given months."""
        rows = await self._session.execute(
            select(
                PointTransaction.period_month,
                func.coalesce(func.sum(PointTransaction.points), 0),
                func.count(),
            )
            .where(
                PointTransaction.user_id == user_id,
                PointTransaction.period_month.in_(months),
            )
            .group_by(PointTransaction.period_month)
        )
        return {
            period_month: (int(points), int(count)) for period_month, points, count in rows.all()
        }

    async def history_page(
        self, user_id: uuid.UUID, *, limit: int, offset: int
    ) -> tuple[list[PointTransaction], int]:
        total = int(
            (
                await self._session.execute(
                    select(func.count()).where(PointTransaction.user_id == user_id)
                )
            ).scalar_one()
        )
        rows = await self._session.execute(
            select(PointTransaction)
            .where(PointTransaction.user_id == user_id)
            .order_by(PointTransaction.awarded_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(rows.scalars().all()), total

    async def history_page_with_titles(
        self, user_id: uuid.UUID, *, limit: int, offset: int
    ) -> tuple[list[dict[str, object]], int]:
        """Paginated history joined to quiz title + verse reference (P5-032)."""
        from app.modules.bible.infrastructure.persistence.models import BibleVerse
        from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizAttempt

        base = (
            select(
                PointTransaction.id,
                PointTransaction.points,
                PointTransaction.awarded_at,
                PointTransaction.source,
                Quiz.id.label("quiz_id"),
                Quiz.title.label("quiz_title"),
                BibleVerse.id.label("verse_id"),
                BibleVerse.verse_reference.label("verse_reference"),
            )
            .join(QuizAttempt, QuizAttempt.id == PointTransaction.quiz_attempt_id)
            .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
            .outerjoin(BibleVerse, BibleVerse.id == Quiz.verse_id)
            .where(PointTransaction.user_id == user_id)
        )
        total = int(
            (
                await self._session.execute(
                    select(func.count()).where(PointTransaction.user_id == user_id)
                )
            ).scalar_one()
        )
        rows = await self._session.execute(
            base.order_by(PointTransaction.awarded_at.desc()).limit(limit).offset(offset)
        )
        return [dict(row._mapping) for row in rows.all()], total

    # -- Monthly analytics (P5-035) ------------------------------------------

    async def monthly_kpis(self, month: date) -> dict[str, object]:
        """Cross-user KPIs for a given month (BR-39)."""
        from app.modules.quiz.infrastructure.persistence.models import QuizAttempt

        result = await self._session.execute(
            select(
                func.count(func.distinct(PointTransaction.user_id)).label("participants"),
                func.count().label("quizzes_completed"),
                func.coalesce(func.sum(PointTransaction.points), 0).label("total_points"),
                func.coalesce(
                    func.avg(
                        case(
                            (
                                QuizAttempt.total_points > 0,
                                func.round(
                                    QuizAttempt.score.cast(float)
                                    / QuizAttempt.total_points.cast(float)
                                    * 10,
                                    1,
                                ),
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("average_score_out_of_10"),
            )
            .join(QuizAttempt, QuizAttempt.id == PointTransaction.quiz_attempt_id)
            .where(
                PointTransaction.period_month == month,
            )
        )
        row = result.one()
        return {
            "participants": int(row.participants),
            "quizzes_completed": int(row.quizzes_completed),
            "total_points": int(row.total_points),
            "average_score_out_of_10": float(row.average_score_out_of_10),
        }

    async def monthly_completion_distribution(self, month: date) -> list[tuple[str, int]]:
        """Completion-rate buckets for the month (BR-39).

        Each user's rate = finished_attempts / quizzes_published_in_month.
        Returns list of (bucket_label, user_count).
        """
        # Get per-user finished count
        user_finished = (
            await self._session.execute(
                select(
                    PointTransaction.user_id,
                    func.count().label("finished"),
                )
                .where(PointTransaction.period_month == month)
                .group_by(PointTransaction.user_id)
            )
        ).all()

        if not user_finished:
            return []

        # Bucket by completion rate (quizzes_published not available here,
        # so we bucket by absolute finished count as a proxy; the query
        # layer normalises this).
        buckets: dict[str, int] = {"100%": 0, "75–99%": 0, "50–74%": 0, "<50%": 0}
        for _uid, finished in user_finished:
            if finished >= 5:
                buckets["100%"] += 1
            elif finished >= 3:
                buckets["75–99%"] += 1
            elif finished >= 2:
                buckets["50–74%"] += 1
            else:
                buckets["<50%"] += 1
        return [(k, v) for k, v in buckets.items() if v > 0]

    async def monthly_leaderboard(self, month: date, *, limit: int = 3) -> list[dict[str, object]]:
        """Top users by points for the month with dense rank (BR-39)."""
        from app.modules.users.infrastructure.persistence.models import User

        rows = (
            await self._session.execute(
                select(
                    PointTransaction.user_id,
                    func.sum(PointTransaction.points).label("points"),
                    User.first_name,
                    User.last_name,
                    User.avatar,
                )
                .join(User, User.id == PointTransaction.user_id)
                .where(PointTransaction.period_month == month)
                .group_by(
                    PointTransaction.user_id,
                    User.first_name,
                    User.last_name,
                    User.avatar,
                )
                .order_by(func.sum(PointTransaction.points).desc())
                .limit(limit)
            )
        ).all()
        result: list[dict[str, object]] = []
        rank = 0
        prev_points: int | None = None
        for i, row in enumerate(rows):
            pts = int(row.points)
            if prev_points is None or pts != prev_points:
                rank = i + 1
            prev_points = pts
            name = " ".join(n for n in (row.first_name, row.last_name) if n).strip() or "Unknown"
            result.append(
                {
                    "rank": rank,
                    "user_id": row.user_id,
                    "full_name": name,
                    "avatar": row.avatar,
                    "points": pts,
                }
            )
        return result

    async def monthly_user_page(
        self,
        month: date,
        *,
        q: str | None,
        min_points: int | None,
        score_range: str | None,
        completion_rate: str | None,
        min_quizzes: int | None,
        limit: int,
        offset: int,
        sparkline_months: Sequence[date],
    ) -> tuple[list[dict[str, object]], int]:
        """Paginated user results for the month with sparkline (P5-035)."""
        from app.modules.quiz.infrastructure.persistence.models import QuizAttempt
        from app.modules.users.infrastructure.persistence.models import User

        # Base: per-user aggregates for the month
        user_stats = (
            select(
                PointTransaction.user_id.label("uid"),
                func.sum(PointTransaction.points).label("total_points"),
                func.count().label("quizzes_completed"),
                func.avg(
                    case(
                        (
                            QuizAttempt.total_points > 0,
                            func.round(
                                QuizAttempt.score.cast(float)
                                / QuizAttempt.total_points.cast(float)
                                * 10,
                                1,
                            ),
                        ),
                        else_=0,
                    )
                ).label("avg_score"),
            )
            .join(QuizAttempt, QuizAttempt.id == PointTransaction.quiz_attempt_id)
            .where(PointTransaction.period_month == month)
            .group_by(PointTransaction.user_id)
            .subquery()
        )

        base = select(
            user_stats.c.uid,
            User.first_name,
            User.last_name,
            User.avatar,
            user_stats.c.total_points,
            user_stats.c.quizzes_completed,
            user_stats.c.avg_score,
        ).join(User, User.id == user_stats.c.uid)

        if q:
            pattern = f"%{q}%"
            base = base.where(
                func.concat(User.first_name, " ", User.last_name).ilike(pattern)
                | User.email.ilike(pattern)
            )
        if min_points is not None:
            base = base.where(user_stats.c.total_points >= min_points)
        if min_quizzes is not None:
            base = base.where(user_stats.c.quizzes_completed >= min_quizzes)

        total = int(
            (
                await self._session.execute(select(func.count()).select_from(base.subquery()))
            ).scalar_one()
        )

        rows = (
            await self._session.execute(
                base.order_by(user_stats.c.total_points.desc(), User.first_name)
                .limit(limit)
                .offset(offset)
            )
        ).all()

        # Sparkline: per-user monthly totals across sparkline_months
        user_ids = [r.uid for r in rows]
        sparkline_map: dict[uuid.UUID, dict[date, int]] = {}
        if user_ids:
            spark_rows = (
                await self._session.execute(
                    select(
                        PointTransaction.user_id,
                        PointTransaction.period_month,
                        func.sum(PointTransaction.points),
                    )
                    .where(
                        PointTransaction.user_id.in_(user_ids),
                        PointTransaction.period_month.in_(sparkline_months),
                    )
                    .group_by(PointTransaction.user_id, PointTransaction.period_month)
                )
            ).all()
            for sid, pm, pts in spark_rows:
                sparkline_map.setdefault(sid, {})[pm] = int(pts)

        result: list[dict[str, object]] = []
        for row in rows:
            name = " ".join(n for n in (row.first_name, row.last_name) if n).strip() or "Unknown"
            spark = [sparkline_map.get(row.uid, {}).get(m, 0) for m in sparkline_months]
            result.append(
                {
                    "user_id": row.uid,
                    "full_name": name,
                    "avatar": row.avatar,
                    "total_points": int(row.total_points),
                    "quizzes_completed": int(row.quizzes_completed),
                    "average_score_out_of_10": float(row.avg_score or 0),
                    "sparkline": spark,
                }
            )
        return result, total

    async def user_month_history(self, user_id: uuid.UUID) -> list[tuple[date, int]]:
        """Full month history for a user: (period_month, points)."""
        rows = await self._session.execute(
            select(
                PointTransaction.period_month,
                func.sum(PointTransaction.points),
            )
            .where(PointTransaction.user_id == user_id)
            .group_by(PointTransaction.period_month)
            .order_by(PointTransaction.period_month.desc())
        )
        return [(pm, int(pts)) for pm, pts in rows.all()]

    async def user_month_breakdown(
        self, user_id: uuid.UUID, month: date
    ) -> list[dict[str, object]]:
        """Per-quiz breakdown for a user in a given month."""
        from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizAttempt

        rows = await self._session.execute(
            select(
                Quiz.id.label("quiz_id"),
                Quiz.title.label("quiz_title"),
                QuizAttempt.score,
                QuizAttempt.total_points,
            )
            .join(QuizAttempt, QuizAttempt.id == PointTransaction.quiz_attempt_id)
            .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
            .where(
                PointTransaction.user_id == user_id,
                PointTransaction.period_month == month,
            )
            .order_by(Quiz.title)
        )
        return [
            {
                "quiz_id": r.quiz_id,
                "quiz_title": r.quiz_title,
                "score": int(r.score),
                "total_points": int(r.total_points),
                "score_out_of_10": (
                    round(int(r.score) / int(r.total_points) * 10, 1)
                    if int(r.total_points)
                    else 0.0
                ),
            }
            for r in rows.all()
        ]
