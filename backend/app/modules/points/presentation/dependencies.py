"""Shared presentation dependencies for the points module (P5-008)."""

from typing import Annotated

from fastapi import Depends

from app.modules.auth.presentation.dependencies import get_current_user, require_role
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User

CurrentUser = Annotated[User, Depends(get_current_user)]
AnalyticsViewer = Annotated[
    User, Depends(require_role(RoleName.ADMIN, RoleName.SERVANT))
]
