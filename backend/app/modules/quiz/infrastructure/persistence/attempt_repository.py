"""Quiz attempt persistence (P5-006, BR-24..BR-30)."""

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.quiz.domain.enums import AttemptStatus
from app.modules.quiz.infrastructure.persistence.models import QuizAttempt


class QuizAttemptRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, attempt: QuizAttempt) -> None:
        self._session.add(attempt)
        await self._session.flush()

    async def get_by_id(self, attempt_id: uuid.UUID) -> QuizAttempt | None:
        result = await self._session.execute(
            select(QuizAttempt).where(QuizAttempt.id == attempt_id)
        )
        return result.scalar_one_or_none()

    async def get_for_user_and_quiz(
        self, quiz_id: uuid.UUID, user_id: uuid.UUID
    ) -> QuizAttempt | None:
        result = await self._session.execute(
            select(QuizAttempt).where(
                QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def finalise(
        self,
        attempt: QuizAttempt,
        *,
        status: AttemptStatus,
        finished_at: datetime,
        submitted_at: datetime | None = None,
        score: int,
        correct_count: int,
        incorrect_count: int,
    ) -> None:
        """Write the immutable grading snapshot (BR-27/BR-28)."""
        attempt.status = status
        attempt.finished_at = finished_at
        if submitted_at is not None:
            attempt.submitted_at = submitted_at
        attempt.score = score
        attempt.correct_count = correct_count
        attempt.incorrect_count = incorrect_count
        await self._session.flush()

    async def claim_expired(self, limit: int, now: datetime) -> list[QuizAttempt]:
        """Claim expired IN_PROGRESS attempts for batch auto-finish (BR-30)."""
        stmt = (
            select(QuizAttempt)
            .where(
                QuizAttempt.status == AttemptStatus.IN_PROGRESS,
                QuizAttempt.expires_at <= now,
            )
            .order_by(QuizAttempt.expires_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    # -- analytics aggregates (wave 5C; kept beside the table) -------------

    async def quiz_kpis(self, quiz_id: uuid.UUID) -> dict[str, object]:
        rows = await self._session.execute(
            select(
                func.count().label("participants"),
                func.sum(case((QuizAttempt.status == AttemptStatus.COMPLETED, 1), else_=0)),
                func.sum(case((QuizAttempt.status == AttemptStatus.AUTO_FINISHED, 1), else_=0)),
                func.max(QuizAttempt.score),
                func.min(QuizAttempt.score),
                func.coalesce(func.sum(QuizAttempt.score), 0),
                func.max(QuizAttempt.total_points),
            ).where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.status != AttemptStatus.IN_PROGRESS)
        )
        row = rows.one()
        participants = int(row.participants or 0)
        completed = int(row[1] or 0)
        auto_finished = int(row[2] or 0)
        highest = int(row[3] or 0)
        lowest = int(row[4] or 0)
        total_awarded = int(row[5] or 0)
        max_possible = int(row[6] or 0)
        return {
            "participants": participants,
            "completed": completed,
            "auto_finished": auto_finished,
            "highest_score": highest,
            "lowest_score": lowest if participants else 0,
            "total_points_awarded": total_awarded,
            "max_possible_points": max_possible,
        }

    async def score_distribution(self, quiz_id: uuid.UUID) -> list[tuple[int, int]]:
        rows = await self._session.execute(
            select(QuizAttempt.score, func.count())
            .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.status != AttemptStatus.IN_PROGRESS)
            .group_by(QuizAttempt.score)
        )
        return [(int(score), int(count)) for score, count in rows.all()]

    async def completion_status_counts(self, quiz_id: uuid.UUID) -> dict[str, int]:
        rows = await self._session.execute(
            select(QuizAttempt.status, func.count())
            .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.status != AttemptStatus.IN_PROGRESS)
            .group_by(QuizAttempt.status)
        )
        return {str(status): int(count) for status, count in rows.all()}

    async def finished_attempts_in_month(
        self, user_ids: Sequence[uuid.UUID] | None, window_start: datetime, window_end: datetime
    ) -> list[tuple[uuid.UUID, int]]:
        """(user_id, finished attempts) inside a UTC window — grouped."""
        conditions = [
            QuizAttempt.status != AttemptStatus.IN_PROGRESS,
            QuizAttempt.finished_at >= window_start,
            QuizAttempt.finished_at < window_end,
        ]
        if user_ids is not None:
            conditions.append(QuizAttempt.user_id.in_(user_ids))
        rows = await self._session.execute(
            select(QuizAttempt.user_id, func.count())
            .where(*conditions)
            .group_by(QuizAttempt.user_id)
        )
        return [(uid, int(count)) for uid, count in rows.all()]

    async def member_stats(self, user_id: uuid.UUID) -> dict[str, object]:
        """Finished-attempt count + average score/10 for the points card (P5-032)."""
        result = await self._session.execute(
            select(
                func.count().label("quizzes_completed"),
                func.coalesce(func.avg(QuizAttempt.score), 0).label("avg_score"),
                func.max(QuizAttempt.total_points).label("max_total"),
            ).where(
                QuizAttempt.user_id == user_id,
                QuizAttempt.status != AttemptStatus.IN_PROGRESS,
            )
        )
        row = result.one()
        count = int(row.quizzes_completed)
        max_total = int(row.max_total or 0)
        avg_score_out_of_10 = (
            round(float(row.avg_score) / max_total * 10, 1) if max_total else 0.0
        )
        return {
            "quizzes_completed": count,
            "average_score_out_of_10": avg_score_out_of_10,
        }

    async def bulk_auto_finish_mark(self, attempt_ids: Sequence[uuid.UUID]) -> None:
        if not attempt_ids:
            return
        await self._session.execute(
            update(QuizAttempt)
            .where(QuizAttempt.id.in_(attempt_ids))
            .values(status=AttemptStatus.AUTO_FINISHED)
        )

    async def results_page(
        self,
        quiz_id: uuid.UUID,
        *,
        q: str | None,
        score_min: int | None,
        score_max: int | None,
        status: AttemptStatus | None,
        date_from: datetime | None,
        date_to: datetime | None,
        limit: int,
        offset: int,
    ) -> tuple[list[dict[str, object]], int]:
        """Filtered/sorted user results page (P5-034) — one grouped query."""
        from app.modules.users.infrastructure.persistence.models import User

        conditions = [
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.status != AttemptStatus.IN_PROGRESS,
        ]
        if q:
            pattern = f"%{q}%"
            conditions.append(
                func.concat(User.first_name, " ", User.last_name).ilike(pattern)
                | User.email.ilike(pattern)
            )
        if score_min is not None:
            conditions.append(QuizAttempt.score >= score_min)
        if score_max is not None:
            conditions.append(QuizAttempt.score <= score_max)
        if status is not None:
            conditions.append(QuizAttempt.status == status)
        if date_from is not None:
            conditions.append(QuizAttempt.finished_at >= date_from)
        if date_to is not None:
            conditions.append(QuizAttempt.finished_at <= date_to)

        base = (
            select(
                QuizAttempt.user_id,
                User.first_name,
                User.last_name,
                User.email,
                User.avatar,
                QuizAttempt.score,
                QuizAttempt.total_points,
                QuizAttempt.status,
                QuizAttempt.finished_at,
                QuizAttempt.started_at,
                QuizAttempt.score.label("points_awarded"),
            )
            .join(User, User.id == QuizAttempt.user_id)
            .where(*conditions)
        )
        count_stmt = select(func.count()).select_from(
            select(QuizAttempt.id)
            .join(User, User.id == QuizAttempt.user_id)
            .where(*conditions)
            .subquery()
        )
        total = int((await self._session.execute(count_stmt)).scalar_one())
        rows = await self._session.execute(
            base.order_by(QuizAttempt.score.desc(), QuizAttempt.finished_at).limit(limit).offset(
                offset
            )
        )
        return [dict(r._mapping) for r in rows.all()], total

    async def manager_attempt(
        self, attempt_id: uuid.UUID
    ) -> tuple[dict[str, object] | None, dict[str, object]]:
        """(user_block, None) when found, else (None, {})."""
        from app.modules.users.infrastructure.persistence.models import User

        row = (
            await self._session.execute(
                select(
                    QuizAttempt.id,
                    QuizAttempt.quiz_id,
                    QuizAttempt.status,
                    QuizAttempt.score,
                    QuizAttempt.total_points,
                    QuizAttempt.correct_count,
                    QuizAttempt.incorrect_count,
                    QuizAttempt.question_count,
                    QuizAttempt.finished_at,
                    QuizAttempt.started_at,
                    User.id.label("user_id"),
                    User.first_name,
                    User.last_name,
                    User.email,
                    User.avatar,
                )
                .join(User, User.id == QuizAttempt.user_id)
                .where(QuizAttempt.id == attempt_id)
            )
        ).first()
        if row is None:
            return None, {}
        mapping = dict(row._mapping)
        user_block = {
            "user_id": mapping["user_id"],
            "full_name": _display_name(mapping.get("first_name"), mapping.get("last_name")),
            "email": mapping["email"],
            "avatar": mapping.get("avatar"),
        }
        return mapping, user_block


def _display_name(first: str | None, last: str | None) -> str:
    return " ".join(n for n in (first, last) if n).strip() or "Unknown"
