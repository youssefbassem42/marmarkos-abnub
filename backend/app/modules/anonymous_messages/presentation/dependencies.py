"""Shared FastAPI dependencies for the anonymous-messages router."""

from typing import Annotated

from fastapi import Depends, Header

from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.persistence.user_repository import UserRepository
from app.modules.users.presentation.dependencies import SessionDependency, require_role
from app.shared.security import jwt_service


def _bearer_token(authorization: str | None) -> str | None:
    """The token of an ``Authorization: Bearer <token>`` header."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


async def optional_current_user(
    session: SessionDependency,
    authorization: Annotated[
        str | None,
        Header(description="Optional bearer token of the signed-in member"),
    ] = None,
) -> User | None:
    """Resolve a caller softly: an absent or invalid token yields None.

    Anonymous submission is public (D-9); an expired bearer token from a
    stale session must never block a submission — it just means the
    per-user rate limit cannot apply.

    The header is read directly instead of through an ``HTTPBearer``
    dependency on purpose: a security scheme makes the OpenAPI schema
    advertise the route as authenticated (SEC-010), and OpenAPI has no
    way to say "this token is optional".
    """
    token = _bearer_token(authorization)
    if token is None:
        return None
    try:
        user_id = jwt_service.decode_access_token(token)
    except Exception:  # noqa: BLE001 - any token problem means anonymous
        return None
    return await UserRepository(session).get_by_id(user_id)


OptionalUser = Annotated[User | None, Depends(optional_current_user)]
AdminUser = Annotated[User, Depends(require_role(RoleName.ADMIN))]
