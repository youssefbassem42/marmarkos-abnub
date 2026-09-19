"""Verse ORM → DTO mappers (P5-010)."""

import uuid
from datetime import datetime

from app.modules.bible.application.dto.verse_dto import (
    CreatorBrief,
    QuizSummary,
    VerseAdminItem,
    VerseCard,
    VerseDetailResponse,
    VerseScheduleBrief,
)
from app.modules.bible.domain.enums import ScheduleStatus
from app.modules.bible.infrastructure.persistence.models import BibleVerse


def _full_name(first_name: str | None, last_name: str | None) -> str | None:
    name = " ".join(part for part in (first_name, last_name) if part)
    return name or None


def to_detail(
    verse: BibleVerse,
    *,
    manager_view: bool,
    is_read: bool = False,
    opens: int | None = None,
    reads: int | None = None,
    quiz_summary: QuizSummary | None = None,
    schedule: VerseScheduleBrief | None = None,
) -> VerseDetailResponse:
    """Public projection; manager extras only when ``manager_view``."""
    creator = None
    if manager_view and verse.created_by_user is not None:
        user = verse.created_by_user
        creator = CreatorBrief(
            id=user.id,
            full_name=_full_name(user.first_name, user.last_name),
            email=user.email,
        )
    return VerseDetailResponse(
        id=verse.id,
        title=verse.title,
        subtitle=verse.subtitle,
        verse_reference=verse.verse_reference,
        book=verse.book,
        chapter=verse.chapter,
        verse_start=verse.verse_start,
        verse_end=verse.verse_end,
        text=verse.text,
        reflection=verse.reflection,
        image=verse.image,
        translation=verse.translation,
        status=verse.status,
        published_at=verse.published_at,
        week_start_date=verse.week_start_date,
        is_read=is_read,
        opens=opens if manager_view else None,
        reads=reads if manager_view else None,
        created_by_user=creator,
        schedule=schedule if manager_view else None,
        quiz_summary=quiz_summary,
    )


def to_admin_item(
    verse: BibleVerse,
    *,
    has_quiz: bool,
    opens: int,
    reads: int,
    schedule: VerseScheduleBrief | None,
) -> VerseAdminItem:
    user = verse.created_by_user
    return VerseAdminItem(
        id=verse.id,
        title=verse.title,
        verse_reference=verse.verse_reference,
        status=verse.status,
        schedule=schedule,
        has_quiz=has_quiz,
        opens=opens,
        reads=reads,
        created_by_user=(
            CreatorBrief(
                id=user.id,
                full_name=_full_name(user.first_name, user.last_name),
                email=user.email,
            )
            if user is not None
            else None
        ),
        created_at=verse.created_at,
        published_at=verse.published_at,
    )


def to_card(
    verse: BibleVerse,
    *,
    is_read: bool,
    has_quiz: bool,
    quiz_state: str | None,
) -> VerseCard:
    return VerseCard(
        id=verse.id,
        title=verse.title,
        verse_reference=verse.verse_reference,
        excerpt=_excerpt(verse.text),
        image=verse.image,
        published_at=verse.published_at,
        week_start_date=verse.week_start_date,
        is_read=is_read,
        has_quiz=has_quiz,
        quiz_state=quiz_state,
    )


def _excerpt(text_value: str, limit: int = 180) -> str:
    cleaned = " ".join(text_value.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def schedule_brief(
    *,
    schedule_id: uuid.UUID,
    status: ScheduleStatus,
    scheduled_at: datetime,
    notification_status: str,
) -> VerseScheduleBrief:
    return VerseScheduleBrief(
        id=schedule_id,
        status=status,
        scheduled_at=scheduled_at,
        notification_status=notification_status,
    )
