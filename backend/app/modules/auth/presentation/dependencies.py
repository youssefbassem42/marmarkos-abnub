from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.modules.auth.infrastructure.security import jwt_service
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.persistence.user_repository import UserRepository

_bearer_scheme = HTTPBearer(auto_error=False)

SessionDependency = Annotated[AsyncSession, Depends(get_db_session)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    session: SessionDependency,
) -> User:
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
    async def dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role.name not in roles:
            raise ForbiddenError("Insufficient permissions")
        return user

    return dependency
