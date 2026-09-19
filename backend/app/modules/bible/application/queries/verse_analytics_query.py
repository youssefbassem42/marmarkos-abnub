"""Verse analytics query use cases (P5-033, §5.7, BR-13/BR-16/BR-37)."""

import uuid
from collections.abc import Sequence
from datetime import date, datetime, timedelta

from sqlalchemy import func, select

from app.core.exceptions import NotFoundError
from app.core.pagination import Page, PageParams
from app.core.time.clock import platform_timezone, today_local, to_local
from app.core.time.periods import iso_week_start, last_n_months
from app.modules.bible.application.dto.analytics_dto import (
    EngagementSeriesPoint,
    RelatedQuizSummary,
    VerseAnalyticsOverview,
    VerseAnalyticsResponse,
    VerseQuickStats,
    VerseUserEngagementItem,
)
from app.modules.bible.infrastructure.persistence.models import BibleVerse, VerseView
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import Role, User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


async def _member_role_id(uow: UnitOfWork) -> int:
    role = await uow.roles.get_by_name(RoleName.MEMBER)
    if role is None:
        raise NotFoundError("MEMBER role not seeded")
    return role.id


def _member_subquery(uow: UnitOfWork, member_role_id: int):
    return select(User.id).join(Role, Role.id == User.role_id).where(Role.id == member_role_id)


async def verse_analytics_overview_query(uow: UnitOfWork) -> VerseAnalyticsOverview:
    """Dashboard totals across all verses (BR-13)."""
    from app.modules.bible.domain.enums import VerseStatus

    member_role_id = await _member_role_id(uow)
    total_posts = int((await uow.session.execute(select(func.count(BibleVerse.id)))).scalar_one())
    published = int(
        (
            await uow.session.execute(
                select(func.count(BibleVerse.id)).where(BibleVerse.status == VerseStatus.PUBLISHED)
            )
        ).scalar_one()
    )
    opens = int(
        (
            await uow.session.execute(
                select(func.count()).where(
                    VerseView.user_id.in_(_member_subquery(uow, member_role_id))
                )
            )
        ).scalar_one()
    )
    reads = int(
        (
            await uow.session.execute(
                select(func.count(func.distinct(VerseView.user_id))).where(
                    VerseView.user_id.in_(_member_subquery(uow, member_role_id))
                )
            )
        ).scalar_one()
    )
    read_rate = round(reads / opens * 100, 1) if opens else 0.0
    return VerseAnalyticsOverview(
        total_posts=total_posts,
        published=published,
        total_opens=opens,
        total_reads=reads,
        read_rate=read_rate,
    )


async def _count_opens_since(uow: UnitOfWork, member_role_id: int, since: datetime) -> int:
    result = await uow.session.execute(
        select(func.count()).where(
            VerseView.user_id.in_(_member_subquery(uow, member_role_id)),
            VerseView.opened_at >= since,
        )
    )
    return int(result.scalar_one())


async def verse_quick_stats_query(uow: UnitOfWork) -> VerseQuickStats:
    """Real admin Quick-Stat card numbers (member opens, BR-13 filtered).

    Replaces the former static/seed values: opens during the current ISO
    week and month, the average member opens per opened verse, and the
    most-opened verse overall. All counts are zero-safe, so a deployment
    without engagement data renders "nothing to show yet".
    """
    member_role_id = await _member_role_id(uow)

    today = today_local()
    week_start = iso_week_start(today)
    month_start = today.replace(day=1)

    rows = (
        await uow.session.execute(
            select(VerseView.verse_id, func.count())
            .where(VerseView.user_id.in_(_member_subquery(uow, member_role_id)))
            .group_by(VerseView.verse_id)
        )
    ).all()
    totals = {verse_id: count for verse_id, count in rows}
    total_opens = sum(totals.values())
    distinct_verses = len(totals)
    avg_reads = round(total_opens / distinct_verses, 1) if distinct_verses else 0.0

    top_verse_id = max(totals, key=totals.get) if totals else None
    top_verse_opens = totals.get(top_verse_id, 0) if top_verse_id else 0
    top_verse_reference: str | None = None
    if top_verse_id is not None:
        top_verse = await uow.session.get(BibleVerse, top_verse_id)
        if top_verse is not None:
            top_verse_reference = top_verse.verse_reference

    return VerseQuickStats(
        this_week=await _count_opens_since(uow, member_role_id, _local_utc(week_start)),
        this_month=await _count_opens_since(uow, member_role_id, _local_utc(month_start)),
        avg_reads=avg_reads,
        top_verse_reference=top_verse_reference,
        top_verse_opens=top_verse_opens,
    )


async def verse_analytics_query(
    uow: UnitOfWork,
    verse_id: uuid.UUID,
    *,
    granularity: str = "daily",
    date_from: date | None = None,
    date_to: date | None = None,
) -> VerseAnalyticsResponse:
    """Per-verse KPIs + engagement series + related quiz performance."""
    verse = await uow.session.get(BibleVerse, verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")
    member_role_id = await _member_role_id(uow)

    stats = await uow.verse_views.member_open_read_stats(verse_id, member_role_id)
    unique_opens = stats["unique_opens"]
    read_rate = round(stats["total_reads"] / unique_opens * 100, 1) if unique_opens else 0.0

    default_from, default_to = _default_window()
    from_dt = _local_utc(date_from or default_from)
    to_dt = _local_utc((date_to or default_to) + timedelta(days=1))
    weekly = granularity == "weekly"
    open_list, read_list = await uow.verse_views.member_series(
        verse_id,
        member_role_id,
        date_from=from_dt,
        date_to=to_dt,
        weekly=weekly,
    )
    series = _gap_fill(open_list, read_list, from_dt, to_dt, weekly=weekly)

    quiz = await _related_quiz(uow, verse_id)

    return VerseAnalyticsResponse(
        verse_id=verse.id,
        title=verse.title,
        verse_reference=verse.verse_reference,
        total_opens=stats["total_opens"],
        unique_opens=unique_opens,
        total_reads=stats["total_reads"],
        unique_readers=stats["total_reads"],
        read_rate=read_rate,
        series=series,
        quiz=quiz,
    )


async def _related_quiz(uow: UnitOfWork, verse_id: uuid.UUID) -> RelatedQuizSummary | None:
    from app.modules.quiz.infrastructure.persistence.models import Quiz

    quiz = await uow.quizzes.get_by_verse(verse_id)
    if quiz is None:
        return None
    kpis = await uow.quiz_attempts.quiz_kpis(quiz.id)
    participants = int(kpis["participants"])
    max_possible = int(kpis["max_possible_points"])
    avg = 0.0
    if participants and max_possible:
        avg = round(float(kpis["total_points_awarded"]) / participants / max_possible * 10, 1)
    return RelatedQuizSummary(
        quiz_id=quiz.id,
        participants=participants,
        average_score_out_of_10=avg,
    )


async def verse_analytics_users_query(
    uow: UnitOfWork,
    verse_id: uuid.UUID,
    page: PageParams,
    *,
    q: str | None = None,
    read: str | None = None,
) -> Page[VerseUserEngagementItem]:
    verse = await uow.session.get(BibleVerse, verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")
    member_role_id = await _member_role_id(uow)
    rows, total = await uow.verse_views.user_engagement_rows(
        verse_id,
        member_role_id=member_role_id,
        q=q,
        limit=page.size,
        offset=page.offset,
    )
    items = [
        VerseUserEngagementItem(
            user_id=row["user_id"],
            full_name=_full_name(row.get("first_name"), row.get("last_name")),
            avatar=row.get("avatar"),
            opened_count=row["opened_count"],
            has_read=row.get("read_row") is not None,
            last_opened_at=row.get("last_opened_at"),
        )
        for row in rows
        if read is None or (read == "read") == (row.get("read_row") is not None)
    ]
    return Page.build(items, total, page)


def _full_name(first: str | None, last: str | None) -> str:
    return " ".join(n for n in (first, last) if n).strip() or "Unknown"


async def verse_analytics_users_export(
    uow: UnitOfWork,
    verse_id: uuid.UUID,
    *,
    q: str | None = None,
    read: str | None = None,
    max_rows: int,
) -> tuple[list[tuple[object, ...]], list[str]]:
    """All user-engagement rows for CSV export (P5-036, BR-40)."""
    from app.core.exceptions import ExportTooLargeError

    verse = await uow.session.get(BibleVerse, verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")
    member_role_id = await _member_role_id(uow)
    rows, _total = await uow.verse_views.user_engagement_rows(
        verse_id,
        member_role_id=member_role_id,
        q=q,
        limit=max_rows + 1,
        offset=0,
    )
    filtered = [
        row for row in rows if read is None or (read == "read") == (row.get("read_row") is not None)
    ]
    if len(filtered) > max_rows:
        raise ExportTooLargeError(max_rows)
    header = ["user_id", "full_name", "opened_count", "has_read", "last_opened_at"]
    out = [
        (
            row["user_id"],
            _full_name(row.get("first_name"), row.get("last_name")),
            row["opened_count"],
            "نعم" if row.get("read_row") is not None else "لا",
            row.get("last_opened_at"),
        )
        for row in filtered
    ]
    return out, header


def _local_utc(day: date) -> datetime:
    from datetime import UTC, time as dtime

    local = datetime.combine(day, dtime.min, tzinfo=platform_timezone())
    return local.astimezone(UTC)


def _default_window() -> tuple[date, date]:
    from app.core.time.clock import today_local

    today = today_local()
    return today - timedelta(days=30), today


def _gap_fill(
    open_list: Sequence[tuple[datetime, int]],
    read_list: Sequence[tuple[datetime, int]],
    from_dt: datetime,
    to_dt: datetime,
    *,
    weekly: bool,
) -> list[EngagementSeriesPoint]:
    open_map = {b: c for b, c in open_list}
    read_map = {b: c for b, c in read_list}
    buckets = sorted(set(open_map) | set(read_map))
    return [
        EngagementSeriesPoint(
            bucket=to_local(b).date(),
            opens=open_map.get(b, 0),
            reads=read_map.get(b, 0),
        )
        for b in buckets
        if from_dt <= b < to_dt
    ]
