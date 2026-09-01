"""Verse query use cases: manager list, stats, detail, member feed (P5-010)."""

import uuid
from collections.abc import Mapping
from datetime import datetime

from app.core.exceptions import NotFoundError
from app.core.pagination import Page, PageParams
from app.modules.bible.application.dto.query_dto import PublishedFeedParams, VerseListParams
from app.modules.bible.application.dto.verse_dto import (
    QuizSummary,
    VerseAdminItem,
    VerseCard,
    VerseDetailResponse,
    VerseScheduleBrief,
    VerseStatsResponse,
)
from app.modules.bible.application.mappers.verse_mapper import (
    to_admin_item,
    to_card,
    to_detail,
)
from app.modules.bible.domain.enums import VerseStatus
from app.modules.bible.infrastructure.persistence.models import (
    BibleVerse,
    VersePublicationSchedule,
)
from app.modules.bible.infrastructure.persistence.verse_repository import (
    PublishedFilters,
    VerseAdminFilters,
)
from app.modules.quiz.domain.enums import AttemptStatus, QuizStatus
from app.modules.quiz.infrastructure.persistence.models import Quiz, QuizAttempt
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


class _QuizRef:
    """Typed quiz reference per verse (id + status) for card projections."""

    __slots__ = ("quiz_id", "status")

    def __init__(self, quiz_id: uuid.UUID, status: QuizStatus) -> None:
        self.quiz_id = quiz_id
        self.status = status


async def verse_stats_query(uow: UnitOfWork) -> VerseStatsResponse:
    """Five KPI counts in one grouped query (BR-37 style)."""
    counts = await uow.bible_verses.status_counts()
    total = sum(counts.values())
    return VerseStatsResponse(
        total=total,
        drafts=counts.get(VerseStatus.DRAFT, 0),
        scheduled=counts.get(VerseStatus.SCHEDULED, 0),
        published=counts.get(VerseStatus.PUBLISHED, 0),
        archived=counts.get(VerseStatus.ARCHIVED, 0),
    )


async def _quiz_state_map(
    uow: UnitOfWork, verse_ids: list[uuid.UUID]
) -> dict[uuid.UUID, _QuizRef]:
    """One grouped lookup of quiz presence/status per page of verses."""
    from sqlalchemy import select

    if not verse_ids:
        return {}
    rows = await uow.session.execute(
        select(Quiz.verse_id, Quiz.id, Quiz.status).where(Quiz.verse_id.in_(verse_ids))
    )
    return {row[0]: _QuizRef(row[1], row[2]) for row in rows.all()}


async def _schedule_map(
    uow: UnitOfWork, verse_ids: list[uuid.UUID]
) -> dict[uuid.UUID, VersePublicationSchedule]:
    """Latest schedule per verse for the manager table (one query)."""
    from sqlalchemy import func, select

    from app.modules.bible.infrastructure.persistence.models import VersePublicationSchedule

    if not verse_ids:
        return {}
    latest = (
        select(
            VersePublicationSchedule.verse_id.label("vid"),
            func.max(VersePublicationSchedule.created_at).label("max_created"),
        )
        .where(VersePublicationSchedule.verse_id.in_(verse_ids))
        .group_by(VersePublicationSchedule.verse_id)
        .subquery()
    )
    rows = await uow.session.execute(
        select(VersePublicationSchedule)
        .join(
            latest,
            (VersePublicationSchedule.verse_id == latest.c.vid)
            & (VersePublicationSchedule.created_at == latest.c.max_created),
        )
    )
    return {row.verse_id: row for row in rows.scalars().all()}


async def verse_list_query(
    uow: UnitOfWork, params: VerseListParams, page: PageParams
) -> Page[VerseAdminItem]:
    filters = VerseAdminFilters(
        status=params.status,
        q=params.q,
        created_by=params.created_by,
        date_from=params.date_from,
        date_to=params.date_to,
        has_quiz=params.has_quiz,
        sort=params.sort,
        order=params.order,
    )
    verses = await uow.bible_verses.list_for_manager(
        filters, limit=page.size, offset=page.offset
    )
    total = await uow.bible_verses.count_for_manager(filters)

    verse_ids = [verse.id for verse in verses]
    quiz_map = await _quiz_state_map(uow, verse_ids)
    schedules = await _schedule_map(uow, verse_ids)
    opens_map = await uow.verse_views.open_counts_for_verses(verse_ids)
    reads_map = await uow.verse_reads.read_counts_for_verses(verse_ids)

    items: list[VerseAdminItem] = []
    for verse in verses:
        schedule_row = schedules.get(verse.id)
        brief = None
        if schedule_row is not None:
            brief = VerseScheduleBrief(
                id=schedule_row.id,
                status=schedule_row.status,
                scheduled_at=schedule_row.scheduled_at,
                notification_status=schedule_row.notification_status.value,
            )
        items.append(
            to_admin_item(
                verse,
                has_quiz=verse.id in quiz_map,
                opens=opens_map.get(verse.id, 0),
                reads=reads_map.get(verse.id, 0),
                schedule=brief,
            )
        )
    return Page.build(items, total, page)


async def published_feed_query(
    uow: UnitOfWork, viewer: User, params: PublishedFeedParams, page: PageParams
) -> Page[VerseCard]:
    """Member feed with read-state and quiz-state flags (no N+1)."""
    feed_filters = PublishedFilters(
        q=params.q, read=params.read, has_quiz=params.has_quiz, user_id=viewer.id
    )
    verses = await uow.bible_verses.list_published(
        feed_filters, limit=page.size, offset=page.offset
    )

    verse_ids = [verse.id for verse in verses]
    read_map = await uow.verse_reads.read_map_for_verses(verse_ids, viewer.id)
    quiz_map = await _quiz_state_map(uow, verse_ids)
    attempts = await _viewer_attempt_map(uow, viewer, verse_ids)

    items: list[VerseCard] = []
    for verse in verses:
        quiz = quiz_map.get(verse.id)
        has_published_quiz = quiz is not None and quiz.status is QuizStatus.PUBLISHED
        items.append(
            to_card(
                verse,
                is_read=verse.id in read_map,
                has_quiz=bool(has_published_quiz),
                quiz_state=_card_quiz_state(quiz, read_map, attempts, verse.id),
            )
        )
    total = await uow.bible_verses.count_published(feed_filters)
    return Page.build(items, total, page)


def _card_quiz_state(
    quiz: _QuizRef | None,
    read_map: Mapping[uuid.UUID, datetime],
    attempts: Mapping[uuid.UUID, QuizAttempt],
    verse_id: uuid.UUID,
) -> str | None:
    """Card badge state for the related quiz (member projection)."""
    if quiz is None or quiz.status is not QuizStatus.PUBLISHED:
        return None
    attempt = attempts.get(quiz.quiz_id)
    if attempt is not None:
        return (
            "completed" if attempt.status != AttemptStatus.IN_PROGRESS else "in_progress"
        )
    if verse_id not in read_map:
        return "locked_read_required"
    return "available"


async def _viewer_attempt_map(
    uow: UnitOfWork, viewer: User, verse_ids: list[uuid.UUID]
) -> dict[uuid.UUID, QuizAttempt]:
    """The viewer's attempt (if any) per verse id — one joined query."""
    from sqlalchemy import select
    from sqlalchemy.orm import aliased

    if not verse_ids:
        return {}
    quiz_alias = aliased(Quiz)
    stmt = (
        select(QuizAttempt, quiz_alias.verse_id)
        .join(quiz_alias, QuizAttempt.quiz_id == quiz_alias.id)
        .where(quiz_alias.verse_id.in_(verse_ids), QuizAttempt.user_id == viewer.id)
    )
    result = await uow.session.execute(stmt)
    return {verse_id: attempt for attempt, verse_id in result.all()}


async def current_verse_query(uow: UnitOfWork, viewer: User) -> VerseCard | None:
    """The newest PUBLISHED verse ("This Week", D-2); None → HTTP 204."""
    verse = await uow.bible_verses.get_current_published()
    if verse is None:
        return None
    read_map = await uow.verse_reads.read_map_for_verses([verse.id], viewer.id)
    quiz_map = await _quiz_state_map(uow, [verse.id])
    attempts = await _viewer_attempt_map(uow, viewer, [verse.id])
    quiz = quiz_map.get(verse.id)
    has_published_quiz = quiz is not None and quiz.status is QuizStatus.PUBLISHED
    return to_card(
        verse,
        is_read=verse.id in read_map,
        has_quiz=has_published_quiz,
        quiz_state=_card_quiz_state(quiz, read_map, attempts, verse.id),
    )


async def verse_detail_query(
    uow: UnitOfWork, verse_id: uuid.UUID, viewer: User | None
) -> tuple[BibleVerse, VerseDetailResponse]:
    """Manager → full detail; MEMBER → public projection, 404 unless
    PUBLISHED (BR-3: never leak existence)."""
    from app.modules.users.domain.enums.role_name import RoleName

    is_manager = viewer is not None and viewer.role.name in (
        RoleName.ADMIN,
        RoleName.SERVANT,
    )
    verse = await uow.bible_verses.get_by_id(verse_id)
    if verse is None:
        raise NotFoundError("Verse not found")
    if not is_manager and verse.status is not VerseStatus.PUBLISHED:
        raise NotFoundError("Verse not found")

    read_map: Mapping[uuid.UUID, datetime] = {}
    if viewer is not None:
        read_map = await uow.verse_reads.read_map_for_verses([verse.id], viewer.id)

    opens = reads = None
    quiz_summary: QuizSummary | None = None
    schedule_brief = None
    if is_manager:
        opens_map = await uow.verse_views.open_counts_for_verses([verse.id])
        reads_map = await uow.verse_views.read_counts_for_verses([verse.id])
        opens = opens_map.get(verse.id, 0)
        reads = reads_map.get(verse.id, 0)
        schedule_row = (await _schedule_map(uow, [verse.id])).get(verse.id)
        if schedule_row is not None:
            schedule_brief = VerseScheduleBrief(
                id=schedule_row.id,
                status=schedule_row.status,
                scheduled_at=schedule_row.scheduled_at,
                notification_status=schedule_row.notification_status.value,
            )
        quiz_summary = await _quiz_info(uow, verse.id)

    response = to_detail(
        verse,
        manager_view=is_manager,
        is_read=verse.id in read_map,
        opens=opens,
        reads=reads,
        quiz_summary=quiz_summary,
        schedule=schedule_brief,
    )
    return verse, response


async def _quiz_info(uow: UnitOfWork, verse_id: uuid.UUID) -> QuizSummary | None:
    """Manager quiz summary from the quiz row + its questions."""
    quiz = await uow.quizzes.get_by_verse(verse_id)
    if quiz is None:
        return None
    question_count = await uow.quiz_questions.count_for_quiz(quiz.id)
    return QuizSummary(
        quiz_id=quiz.id,
        status=quiz.status.value,
        question_count=question_count,
        total_points=quiz.total_points,
        duration_seconds=quiz.duration_seconds,
    )
