"""Authorization for the internal scheduler tick (P5-019).

Accepts either the shared cron secret or an ADMIN bearer token. The
secret is compared with ``secrets.compare_digest`` and never logged.

Matrix (Part 1 §5.8 / P5-019 acceptance):
- correct ``X-Cron-Secret`` while ``CRON_SECRET`` set → allowed (cron).
- wrong secret → 401.
- no secret header, ADMIN bearer → allowed (manual trigger).
- SERVANT/MEMBER bearer → 403.
- ``CRON_SECRET`` unset and no ADMIN bearer → 503 scheduler_disabled.
"""

import secrets
from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_db_session
from app.core.exceptions import (
    ForbiddenError,
    SchedulerDisabledError,
    UnauthorizedError,
)
from app.modules.auth.infrastructure.security import jwt_service
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.persistence.user_repository import UserRepository

_bearer_scheme = HTTPBearer(auto_error=False)


async def require_cron_or_admin(
    x_cron_secret: Annotated[
        str | None, Header(description="Shared secret matching CRON_SECRET")
    ] = None,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
    ] = None,
    session: Annotated[AsyncSession | None, Depends(get_db_session)] = None,
) -> User | None:
    """Return the acting ADMIN user, or ``None`` for a valid cron call."""
    secret_configured = settings.CRON_SECRET is not None

    if secret_configured and x_cron_secret is not None:
        if secrets.compare_digest(x_cron_secret, str(settings.CRON_SECRET)):
            return None
        raise UnauthorizedError("Invalid scheduler credentials")

    if credentials is not None:
        try:
            user_id = jwt_service.decode_access_token(credentials.credentials)
        except Exception:
            raise UnauthorizedError("Invalid or expired token") from None
        user = await UserRepository(session).get_by_id(user_id) if session else None
        if user is None:
            raise UnauthorizedError("Invalid or expired token")
        if user.role.name is RoleName.ADMIN and user.status is UserStatus.ACTIVE:
            return user
        raise ForbiddenError("Insufficient permissions")
        # pragma: no cover - unreachable

    if secret_configured:
        raise UnauthorizedError("Not authenticated")
    raise SchedulerDisabledError()


CronOrAdmin = Annotated[User | None, Depends(require_cron_or_admin)]
