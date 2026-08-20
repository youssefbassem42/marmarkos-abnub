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
from app.modules.auth.infrastructure.persistence.refresh_token_repository import (
    RefreshTokenRepository,
)
from app.modules.bible.infrastructure.persistence.bible_verse_repository import (
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
from app.modules.notifications.infrastructure.persistence.notification_repository import (
    NotificationRepository,
)
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
    def service_sessions(self) -> ServiceSessionRepository:
        return ServiceSessionRepository(self._session)

    @property
    def attendance(self) -> AttendanceRepository:
        return AttendanceRepository(self._session)

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
    def anonymous_messages(self) -> AnonymousMessageRepository:
        return AnonymousMessageRepository(self._session)

    @property
    def bible_verses(self) -> BibleVerseRepository:
        return BibleVerseRepository(self._session)

    @property
    def media(self) -> MediaRepository:
        return MediaRepository(self._session)

    @property
    def audit(self) -> AuditLogRepository:
        return AuditLogRepository(self._session)

    @property
    def outbox(self) -> OutboxRepository:
        return OutboxRepository(self._session)
