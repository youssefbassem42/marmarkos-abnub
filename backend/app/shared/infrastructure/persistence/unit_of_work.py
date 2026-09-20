"""Lightweight Unit of Work coordinating repositories and transactions.

The application service (use case) controls the transaction boundary:
``UnitOfWork.commit()`` persists aggregate changes *and* any recorded
domain events (as outbox rows) atomically. Repositories never commit on
their own.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.admin.infrastructure.persistence.audit_log_repository import (
    AuditLogRepository,
)
from app.modules.anonymous_messages.infrastructure.persistence.anonymous_message_repository import (
    AnonymousMessageRepository,
)
from app.modules.attendance.infrastructure.persistence.attendance_repository import (
    AttendanceRepository,
)
from app.modules.attendance.infrastructure.persistence.service_session_repository import (
    ServiceSessionRepository,
)
from app.modules.attendance.infrastructure.persistence.weekly_attendance_repository import (
    WeeklyAttendanceRepository,
)
from app.modules.auth.infrastructure.persistence.auth_token_repository import (
    AuthTokenRepository,
)
from app.modules.auth.infrastructure.persistence.refresh_token_repository import (
    RefreshTokenRepository,
)
from app.modules.bible.infrastructure.persistence.engagement_repository import (
    VerseEngagementRepository,
)
from app.modules.bible.infrastructure.persistence.schedule_repository import (
    VerseScheduleRepository,
)
from app.modules.bible.infrastructure.persistence.verse_repository import (
    BibleVerseRepository,
)
from app.modules.blog.infrastructure.persistence.blog_post_repository import (
    BlogPostRepository,
)
from app.modules.blog.infrastructure.persistence.category_repository import (
    BlogCategoryRepository,
)
from app.modules.blog.infrastructure.persistence.like_repository import (
    BlogPostLikeRepository,
)
from app.modules.comments.infrastructure.persistence.comment_repository import (
    CommentRepository,
)
from app.modules.media.infrastructure.persistence.media_repository import MediaRepository
from app.modules.notifications.infrastructure.persistence.notification_read_repository import (
    NotificationReadRepository,
)
from app.modules.notifications.infrastructure.persistence.notification_repository import (
    NotificationRepository,
)
from app.modules.points.infrastructure.persistence.point_transaction_repository import (
    PointTransactionRepository,
)
from app.modules.quiz.infrastructure.persistence.answer_repository import (
    QuizAnswerRepository,
)
from app.modules.quiz.infrastructure.persistence.attempt_repository import (
    QuizAttemptRepository,
)
from app.modules.quiz.infrastructure.persistence.question_repository import (
    QuizOptionRepository,
    QuizQuestionRepository,
)
from app.modules.quiz.infrastructure.persistence.quiz_repository import QuizRepository
from app.modules.users.infrastructure.persistence.qr_code_repository import (
    UserQrCodeRepository,
)
from app.modules.users.infrastructure.persistence.role_repository import RoleRepository
from app.modules.users.infrastructure.persistence.user_repository import UserRepository
from app.shared.domain.events import DomainEvent
from app.shared.infrastructure.persistence.outbox import OutboxEvent, OutboxRepository


class UnitOfWork:
    """Coordinates a single database transaction across module repositories.

    Usage::

        uow = await UnitOfWork.create(session_factory)
        async with uow:
            uow.users.add(user)
            uow.record(UserRegistered(...))
            await uow.commit()
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._events: list[DomainEvent] = []
        self._committed = False

    @classmethod
    @asynccontextmanager
    async def create(
        cls, session_factory: async_sessionmaker[AsyncSession]
    ) -> AsyncIterator["UnitOfWork"]:
        """Open a fresh session and roll back automatically on errors."""
        async with session_factory() as session:
            uow = cls(session)
            try:
                yield uow
            except BaseException:
                await session.rollback()
                raise
            else:
                if not uow._committed:
                    if uow._events:
                        for event in uow._events:
                            session.add(OutboxEvent.from_domain_event(event))
                        uow._events.clear()
                    await session.commit()

    @property
    def session(self) -> AsyncSession:
        return self._session

    def record(self, event: DomainEvent) -> None:
        """Record a domain event; persisted into the outbox on commit."""
        self._events.append(event)

    async def commit(self) -> None:
        if self._events:
            for event in self._events:
                self._session.add(OutboxEvent.from_domain_event(event))
            self._events.clear()
        await self._session.commit()
        self._committed = True

    async def rollback(self) -> None:
        self._events.clear()
        await self._session.rollback()

    # -- repositories ----------------------------------------------------

    @property
    def users(self) -> UserRepository:
        return UserRepository(self._session)

    @property
    def roles(self) -> RoleRepository:
        return RoleRepository(self._session)

    @property
    def qr_codes(self) -> UserQrCodeRepository:
        return UserQrCodeRepository(self._session)

    @property
    def refresh_tokens(self) -> RefreshTokenRepository:
        return RefreshTokenRepository(self._session)

    @property
    def auth_tokens(self) -> AuthTokenRepository:
        return AuthTokenRepository(self._session)

    @property
    def service_sessions(self) -> ServiceSessionRepository:
        return ServiceSessionRepository(self._session)

    @property
    def attendance(self) -> AttendanceRepository:
        return AttendanceRepository(self._session)

    @property
    def weekly_attendance(self) -> WeeklyAttendanceRepository:
        return WeeklyAttendanceRepository(self._session)

    @property
    def blog_posts(self) -> BlogPostRepository:
        return BlogPostRepository(self._session)

    @property
    def blog_categories(self) -> BlogCategoryRepository:
        return BlogCategoryRepository(self._session)

    @property
    def blog_likes(self) -> BlogPostLikeRepository:
        return BlogPostLikeRepository(self._session)

    @property
    def comments(self) -> CommentRepository:
        return CommentRepository(self._session)

    @property
    def notifications(self) -> NotificationRepository:
        return NotificationRepository(self._session)

    @property
    def notification_reads(self) -> NotificationReadRepository:
        return NotificationReadRepository(self._session)

    @property
    def anonymous_messages(self) -> AnonymousMessageRepository:
        return AnonymousMessageRepository(self._session)

    @property
    def bible_verses(self) -> BibleVerseRepository:
        return BibleVerseRepository(self._session)

    @property
    def verse_schedules(self) -> VerseScheduleRepository:
        return VerseScheduleRepository(self._session)

    @property
    def verse_views(self) -> VerseEngagementRepository:
        """Verse open-tracking (VerseView rows).

        Both ``verse_views`` and ``verse_reads`` return the same
        ``VerseEngagementRepository`` because that single repo manages both
        the ``verse_views`` and ``verse_reads`` tables.  Use the semantic
        property name that matches what you are doing:
        * ``uow.verse_views``  → call ``record_open`` / ``open_counts_*``
        * ``uow.verse_reads``  → call ``mark_read`` / ``read_counts_*``
        """
        return VerseEngagementRepository(self._session)

    @property
    def verse_reads(self) -> VerseEngagementRepository:
        """Verse read-tracking (VerseRead rows).

        See ``verse_views`` for the shared-repository rationale.
        """
        return VerseEngagementRepository(self._session)

    @property
    def quizzes(self) -> QuizRepository:
        return QuizRepository(self._session)

    @property
    def quiz_questions(self) -> QuizQuestionRepository:
        return QuizQuestionRepository(self._session)

    @property
    def quiz_options(self) -> QuizOptionRepository:
        return QuizOptionRepository(self._session)

    @property
    def quiz_attempts(self) -> QuizAttemptRepository:
        return QuizAttemptRepository(self._session)

    @property
    def quiz_answers(self) -> QuizAnswerRepository:
        return QuizAnswerRepository(self._session)

    @property
    def point_transactions(self) -> PointTransactionRepository:
        return PointTransactionRepository(self._session)

    @property
    def media(self) -> MediaRepository:
        return MediaRepository(self._session)

    @property
    def audit(self) -> AuditLogRepository:
        return AuditLogRepository(self._session)

    @property
    def outbox(self) -> OutboxRepository:
        return OutboxRepository(self._session)
