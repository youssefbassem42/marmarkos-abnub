"""Email verification and password recovery use cases.

Both flows share the same single-use ``auth_tokens`` mechanics: issue
a hashed token, email its raw value as a frontend link, consume it on
return. Emails are sent *after* commit so an SMTP hiccup can never roll
back the database change; the UI always offers a resend.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError, UnauthorizedError
from app.modules.auth.application.dto.forgot_password_request import ForgotPasswordRequest
from app.modules.auth.application.dto.reset_password_request import ResetPasswordRequest
from app.modules.auth.domain.enums.auth_token_purpose import AuthTokenPurpose
from app.modules.auth.infrastructure.persistence.models import AuthToken
from app.modules.auth.infrastructure.security import (
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
)
from app.modules.notifications.infrastructure.email import EmailService
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)


def _frontend_origin() -> str:
    url = settings.FRONTEND_URL.rstrip("/")
    return url if url.startswith(("http://", "https://")) else f"https://{url}"


def _issue_token(
    user_id: uuid.UUID, purpose: AuthTokenPurpose, lifetime: timedelta
) -> tuple[str, AuthToken]:
    """Build (but do not persist) a single-use token pair."""
    raw = generate_refresh_token()
    token = AuthToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw),
        purpose=purpose,
        expires_at=datetime.now(UTC) + lifetime,
    )
    return raw, token


class EmailVerificationService:
    """Keeps dummy sign-ups out: no verified address → no usable account.

    Uses the constructor-path ``UnitOfWork(session)`` where ``session`` is
    owned by the FastAPI ``get_db_session`` dependency (auto-rollback on
    unhandled exceptions). Every write path calls ``await self._uow.commit()``
    explicitly before returning.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._uow = UnitOfWork(session)
        self._email = EmailService()

    async def send_verification_email(self, user: User) -> None:
        await self._uow.auth_tokens.invalidate_all_for_user(
            user.id, AuthTokenPurpose.EMAIL_VERIFICATION, datetime.now(UTC)
        )
        raw, token = _issue_token(
            user.id,
            AuthTokenPurpose.EMAIL_VERIFICATION,
            timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS),
        )
        await self._uow.auth_tokens.add(token)
        await self._uow.commit()

        verify_url = f"{_frontend_origin()}/verify-email/confirm?token={raw}"
        sent = await self._email.send_verification_email(
            to_email=user.email,
            first_name=user.first_name,
            verify_url=verify_url,
            expire_hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS,
        )
        if not sent:
            logger.warning("Verification email could not be delivered to %s", user.email)

    async def resend(self, email: str) -> None:
        """Re-send the link; silently succeeds for unknown/unverified-proof emails."""
        user = await self._uow.users.get_by_email(email.lower())
        if user is None:
            return
        if user.email_verified:
            return
        await self.send_verification_email(user)

    async def confirm(self, raw_token: str) -> None:
        now = datetime.now(UTC)
        stored = await self._uow.auth_tokens.get_valid(
            hash_refresh_token(raw_token), AuthTokenPurpose.EMAIL_VERIFICATION, now
        )
        if stored is None:
            raise UnauthorizedError("This verification link is invalid or has expired")

        user = await self._uow.users.get_by_id(stored.user_id)
        if user is None:
            raise UnauthorizedError("This verification link is invalid or has expired")

        await self._uow.auth_tokens.mark_used(stored, now)
        user.email_verified = True
        await self._uow.session.flush()
        await self._uow.commit()


class PasswordResetService:
    """Email a reset link and consume it to update the password.

    Uses the constructor-path ``UnitOfWork(session)`` where ``session`` is
    owned by the FastAPI ``get_db_session`` dependency (auto-rollback on
    unhandled exceptions). Every write path calls ``await self._uow.commit()``
    explicitly before returning.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._uow = UnitOfWork(session)
        self._email = EmailService()

    async def request_reset(self, request: ForgotPasswordRequest) -> None:
        """Always returns quietly to avoid leaking which emails exist."""
        user = await self._uow.users.get_by_email(request.email.lower())
        if user is None or not user.email_verified:
            return

        await self._uow.auth_tokens.invalidate_all_for_user(
            user.id, AuthTokenPurpose.PASSWORD_RESET, datetime.now(UTC)
        )
        raw, token = _issue_token(
            user.id,
            AuthTokenPurpose.PASSWORD_RESET,
            timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        )
        await self._uow.auth_tokens.add(token)
        await self._uow.commit()

        reset_url = f"{_frontend_origin()}/reset-password?token={raw}"
        await self._email.send_password_reset_email(
            to_email=user.email,
            first_name=user.first_name,
            reset_url=reset_url,
            expire_minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
        )

    async def reset(self, request: ResetPasswordRequest) -> None:
        now = datetime.now(UTC)
        stored = await self._uow.auth_tokens.get_valid(
            hash_refresh_token(request.token), AuthTokenPurpose.PASSWORD_RESET, now
        )
        if stored is None:
            raise UnauthorizedError("This reset link is invalid or has expired")

        user = await self._uow.users.get_by_id(stored.user_id)
        if user is None:
            raise NotFoundError("Account not found")

        await self._uow.auth_tokens.mark_used(stored, now)
        user.password_hash = hash_password(request.password)
        user.has_password = True
        await self._uow.session.flush()
        # A password reset means any stolen session must die.
        await self._uow.refresh_tokens.revoke_all_for_user(user.id, now)
        await self._uow.commit()
