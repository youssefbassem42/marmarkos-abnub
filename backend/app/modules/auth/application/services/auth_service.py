import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.modules.auth.application.dto.login_request import LoginRequest
from app.modules.auth.application.dto.register_request import RegisterRequest
from app.modules.auth.infrastructure.persistence.models import RefreshToken
from app.modules.auth.infrastructure.security import (
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    jwt_service,
    verify_password,
)
from app.modules.auth.infrastructure.services.google_tokens import GoogleIdentity
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.domain.events import UserRegistered
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.services import generate_public_id
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


@dataclass(frozen=True)
class AuthResult:
    access_token: str
    refresh_token: str
    expires_in: int
    user: User


class RegistrationService:
    """Registers a user inside a single transaction and emits UserRegistered.

    The domain event is persisted into the outbox in the same commit,
    so downstream notifications (email/welcome) can never be lost.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._uow = UnitOfWork(session)

    async def register(self, request: RegisterRequest) -> User:
        if await self._uow.users.exists_by_email(request.email):
            raise ConflictError("An account with this email already exists")

        role = await self._uow.roles.get_by_name(RoleName.MEMBER)
        if role is None:
            raise RuntimeError("Default role is not configured")

        user = User(
            email=request.email,
            phone=request.phone,
            first_name=request.first_name,
            last_name=request.last_name,
            date_of_birth=request.date_of_birth,
            address=request.address,
            password_hash=hash_password(request.password),
            public_id=generate_public_id(),
            role=role,
        )
        await self._uow.users.add(user)
        self._uow.record(
            UserRegistered(
                aggregate_id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
            )
        )
        await self._uow.commit()
        return user


class AuthenticationService:
    def __init__(self, session: AsyncSession) -> None:
        self._uow = UnitOfWork(session)

    async def login(
        self, request: LoginRequest, user_agent: str | None = None, ip_address: str | None = None
    ) -> AuthResult:
        user = await self._uow.users.get_by_email(request.email)
        if user is None or not verify_password(request.password, user.password_hash):
            raise UnauthorizedError("Invalid credentials")
        if user.status is not UserStatus.ACTIVE:
            raise ForbiddenError("Account is not active")
        await self._uow.users.set_last_login(user, datetime.now(UTC))
        return await self._issue_tokens(user, user_agent, ip_address)

    async def google_login(
        self,
        identity: GoogleIdentity,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResult:
        """Sign in (or provision a first-time member) from a Google identity.

        Existing accounts keep their password and data; Google sign-in simply
        issues this app's tokens for them. New emails get an ACTIVE MEMBER
        account with an unusable random password.
        """
        email = identity.email.lower()

        user = await self._uow.users.get_by_email(email)
        if user is None:
            role = await self._uow.roles.get_by_name(RoleName.MEMBER)
            if role is None:
                raise RuntimeError("Default role is not configured")
            user = User(
                email=email,
                first_name=identity.first_name,
                last_name=identity.last_name,
                avatar=identity.picture,
                password_hash=hash_password(secrets.token_urlsafe(32)),
                public_id=generate_public_id(),
                role=role,
                has_password=False,
            )
            await self._uow.users.add(user)
            self._uow.record(
                UserRegistered(
                    aggregate_id=user.id,
                    email=user.email,
                    first_name=user.first_name,
                    last_name=user.last_name,
                )
            )

        if user.status is not UserStatus.ACTIVE:
            raise ForbiddenError("Account is not active")

        await self._uow.users.set_last_login(user, datetime.now(UTC))
        return await self._issue_tokens(user, user_agent, ip_address)

    async def refresh(
        self, refresh_token: str, user_agent: str | None = None, ip_address: str | None = None
    ) -> AuthResult:
        stored = await self._uow.refresh_tokens.get_by_hash(hash_refresh_token(refresh_token))
        if (
            stored is None
            or stored.revoked_at is not None
            or stored.expires_at <= datetime.now(UTC)
        ):
            raise UnauthorizedError("Invalid or expired refresh token")

        user = await self._uow.users.get_by_id(stored.user_id)
        if user is None or user.status is not UserStatus.ACTIVE:
            raise UnauthorizedError("Invalid or expired refresh token")

        await self._uow.refresh_tokens.revoke(stored, datetime.now(UTC))
        return await self._issue_tokens(user, user_agent, ip_address)

    async def logout(self, refresh_token: str) -> None:
        stored = await self._uow.refresh_tokens.get_by_hash(hash_refresh_token(refresh_token))
        if stored is not None and stored.revoked_at is None:
            await self._uow.refresh_tokens.revoke(stored, datetime.now(UTC))
            await self._uow.commit()

    async def _issue_tokens(
        self,
        user: User,
        user_agent: str | None,
        ip_address: str | None,
    ) -> AuthResult:
        refresh_token = generate_refresh_token()
        await self._uow.refresh_tokens.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_refresh_token(refresh_token),
                expires_at=datetime.now(UTC)
                + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
                user_agent=user_agent,
                ip_address=ip_address,
            )
        )
        await self._uow.commit()
        return AuthResult(
            access_token=jwt_service.create_access_token(user.id),
            refresh_token=refresh_token,
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user,
        )
