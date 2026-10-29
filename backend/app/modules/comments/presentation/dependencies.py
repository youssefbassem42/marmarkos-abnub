"""Presentation dependencies of the comments module."""

from typing import Annotated

from fastapi import Depends

from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.presentation.dependencies import get_current_user

CurrentUser = Annotated[User, Depends(get_current_user)]
"""Any signed-in platform member."""
