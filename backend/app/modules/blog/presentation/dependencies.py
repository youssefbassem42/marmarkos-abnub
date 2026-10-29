"""Presentation dependencies of the blog module."""

from typing import Annotated

from fastapi import Depends

from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.presentation.dependencies import get_current_user, require_role

CurrentUser = Annotated[User, Depends(get_current_user)]
"""Any signed-in platform member."""

BlogManager = Annotated[User, Depends(require_role(RoleName.ADMIN, RoleName.SERVANT))]
"""An administrator or a servant; both may write posts (D-6)."""
