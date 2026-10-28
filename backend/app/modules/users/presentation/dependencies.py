"""The guard of the current member.

The guard answers one question: **who is calling?** It decodes the
access token, loads the member and checks that the account is active.

It lives in the **users** module because the member is what it
returns, and the users module owns the member (ARCH-001, Phase 4.4).
The auth module owns the *token* (the password, the refresh, the
verification); it does not own the member. The dependency now flows
one way - auth knows users, users does not know auth - and the last
import cycle of the module graph is gone.

The old path (``app.modules.auth.presentation.dependencies``) still
works: it re-exports the very same objects, so every caller outside
this repository keeps working for one release.
"""

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.persistence.user_repository import UserRepository
from app.shared.security import jwt_service

_bearer_scheme = HTTPBearer(auto_error=False)

SessionDependency = Annotated[AsyncSession, Depends(get_db_session)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    session: SessionDependency,
) -> User:
    """The member that calls, or an error."""
    if credentials is None:
        raise UnauthorizedError("Not authenticated")
    user_id = jwt_service.decode_access_token(credentials.credentials)
    user = await UserRepository(session).get_by_id(user_id)
    if user is None:
        raise UnauthorizedError("Invalid or expired token")
    if user.status is not UserStatus.ACTIVE:
        raise ForbiddenError("Account is not active")
    return user


def require_role(*roles: RoleName) -> Callable[..., Awaitable[User]]:
    """The member that calls, when he holds one of the roles."""

    async def dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role.name not in roles:
            raise ForbiddenError("Insufficient permissions")
        return user

    return dependency
