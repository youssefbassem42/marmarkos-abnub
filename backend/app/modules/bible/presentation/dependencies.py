"""Shared presentation dependencies for the bible module (P5-008)."""

from typing import Annotated

from fastapi import Depends

from app.modules.auth.presentation.dependencies import get_current_user, require_role
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User

CurrentUser = Annotated[User, Depends(get_current_user)]
"""Any authenticated user (member, servant or admin)."""

BibleManager = Annotated[
    User, Depends(require_role(RoleName.ADMIN, RoleName.SERVANT))
]
"""Verse/quiz content manager: ADMIN or SERVANT (Part 1 §3.1)."""
