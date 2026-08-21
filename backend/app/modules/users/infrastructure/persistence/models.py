"""SQLAlchemy ORM models for the users module.

User/Role/UserQrCode/UserBanRecord. These are infrastructure-level
persistence models; the domain layer (enums, interfaces, events) does
not depend on SQLAlchemy.
"""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.shared.infrastructure.persistence.base import (
    Base,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:
    from app.modules.attendance.infrastructure.persistence.models import AttendanceRecord
    from app.modules.attendance.infrastructure.persistence.weekly_models import (
        WeeklyAttendanceRecord,
    )
    from app.modules.auth.infrastructure.persistence.models import RefreshToken
    from app.modules.blog.infrastructure.persistence.models import (
        BlogPost,
        BlogPostLike,
    )
    from app.modules.comments.infrastructure.persistence.models import Comment
    from app.modules.notifications.infrastructure.persistence.models import Notification


class Role(Base):
    """Stable reference table of platform roles.

    Kept as a table (not a bare enum column) because the auth flow already
    resolves roles at runtime and future permission sets may attach to
    roles. Values are stable: MEMBER, SERVANT, ADMIN.
    """

    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[RoleName] = mapped_column(
        SAEnum(RoleName, name="role_name", native_enum=False, length=20),
        unique=True,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Platform user: church member, servant or administrator.

    Lifecycle is status-based (ACTIVE/SUSPENDED/BANNED/INACTIVE); users
    are never physically deleted. Ban history lives in
    ``user_ban_records``.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(80))
    last_name: Mapped[str | None] = mapped_column(String(80))
    date_of_birth: Mapped[date | None] = mapped_column(Date())
    address: Mapped[str | None] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Profile photo URL (e.g. the Google account picture); images themselves
    # are not stored locally — only a link.
    avatar: Mapped[str | None] = mapped_column(String(500))
    public_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        SAEnum(UserStatus, name="user_status", native_enum=False, length=20),
        default=UserStatus.ACTIVE,
        nullable=False,
    )
    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # False for accounts provisioned via Google that never chose a password;
    # such users may set one without supplying the current password.
    has_password: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true"), default=True
    )

    role: Mapped[Role] = relationship(back_populates="users")
    qr_code: Mapped["UserQrCode | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    ban_records: Mapped[list["UserBanRecord"]] = relationship(
        back_populates="user",
        foreign_keys="UserBanRecord.user_id",
        cascade="all, delete-orphan",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="user", foreign_keys="AttendanceRecord.user_id"
    )
    weekly_attendance_records: Mapped[list["WeeklyAttendanceRecord"]] = relationship(
        back_populates="user", foreign_keys="WeeklyAttendanceRecord.user_id"
    )
    blog_posts: Mapped[list["BlogPost"]] = relationship(back_populates="author")
    blog_likes: Mapped[list["BlogPostLike"]] = relationship(back_populates="user")
    comments: Mapped[list["Comment"]] = relationship(back_populates="author")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")


class UserQrCode(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Revocable QR identity token.

    The QR payload is a high-entropy opaque token; only its SHA-256 hash
    is stored. Revocation = ``is_active=False``; regeneration = new row
    (at most one active token per user, enforced by a partial unique
    index). No personal data is embedded in the QR code.
    """

    __tablename__ = "user_qr_codes"
    __table_args__ = (
        Index(
            "uq_user_qr_codes_active_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="qr_code")


class UserBanRecord(UUIDPrimaryKeyMixin, Base):
    """Ban/moderation history. The current state lives on users.status."""

    __tablename__ = "user_ban_records"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    banned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    banned_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(500))
    banned_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    lifted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lifted_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="ban_records", foreign_keys=[user_id])
    banned_by_user: Mapped[User | None] = relationship(foreign_keys=[banned_by])
    lifted_by_user: Mapped[User | None] = relationship(foreign_keys=[lifted_by])
