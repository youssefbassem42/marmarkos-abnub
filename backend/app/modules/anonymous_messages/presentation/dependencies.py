"""Shared FastAPI dependencies for the anonymous-messages router."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.modules.auth.infrastructure.security import jwt_service
from app.modules.auth.presentation.dependencies import SessionDependency, require_role
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.persistence.user_repository import UserRepository

_bearer_scheme = HTTPBearer(auto_error=False)


async def optional_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    session: SessionDependency,
) -> User | None:
    """Resolve a caller softly: an absent or invalid token yields None.

    Anonymous submission is public (D-9); an expired bearer token from a
    stale session must never block a submission — it just means the
    per-user rate limit cannot apply.
    """
    if credentials is None:
        return None
    try:
        user_id = jwt_service.decode_access_token(credentials.credentials)
    except Exception:  # noqa: BLE001 - any token problem means anonymous
        return None
    return await UserRepository(session).get_by_id(user_id)


OptionalUser = Annotated[User | None, Depends(optional_current_user)]
AdminUser = Annotated[User, Depends(require_role(RoleName.ADMIN))]
