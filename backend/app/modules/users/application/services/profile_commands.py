import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError
from app.modules.auth.infrastructure.security import hash_password, verify_password
from app.modules.users.application.dto.profile_update import (
    ChangePasswordRequest,
    UpdateProfileRequest,
)
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork


class ProfileCommandService:
    """Updates the authenticated user's own profile, password and photo."""

    def __init__(self, session: AsyncSession) -> None:
        self._uow = UnitOfWork(session)

    async def update_profile(self, user: User, request: UpdateProfileRequest) -> User:
        changes = request.model_dump(exclude_unset=True)

        if "phone" in changes and changes["phone"] is not None:
            phone = changes["phone"]
            existing = await self._uow.users.get_by_phone(phone)
            if existing is not None and existing.id != user.id:
                raise ConflictError("This phone number is already registered")

        for field, value in changes.items():
            setattr(user, field, value)

        await self._uow.commit()
        return user

    async def change_password(self, user: User, request: ChangePasswordRequest) -> None:
        if user.has_password:
            if request.current_password is None or not verify_password(
                request.current_password, user.password_hash
            ):
                raise UnauthorizedError("Current password is incorrect")

        user.password_hash = hash_password(request.new_password)
        user.has_password = True

        # Password changed: every issued refresh token is invalidated so other
        # devices are signed out of the account.
        await self._uow.refresh_tokens.revoke_all_for_user(user.id, datetime.now(UTC))
        await self._uow.commit()

    async def set_avatar(self, user_id: uuid.UUID, avatar_url: str) -> User:
        user = await self._uow.users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")
        user.avatar = avatar_url
        await self._uow.commit()
        return user


def ensure_can_manage(user: User, target_id: uuid.UUID) -> None:
    """Users may only modify their own account."""
    if user.id != target_id:
        raise ForbiddenError("Insufficient permissions")
